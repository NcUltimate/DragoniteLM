import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from '@langchain/openai';
import { DocumentProcessor } from '../core/document-processor.js';
import { VectorStore } from './vector-store.js';
import { KnowledgeManager } from '../core/knowledge-manager.js';

export class IngestionEngine {
  constructor(config = {}) {
    this.config = config;
    this.documentProcessor = new DocumentProcessor();
    this.vectorStore = new VectorStore(config.vectorDb);
    this.embeddings = null;
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: config.chunking?.chunkSize || 1000,
      chunkOverlap: config.chunking?.chunkOverlap || 200
    });
  }

  async initialize() {
    if (!this.embeddings) {
      this.embeddings = new OpenAIEmbeddings({
        model: this.config.embeddings?.model || 'text-embedding-3-small',
        openAIApiKey: this.config.llm?.apiKey
      });
    }
    await this.vectorStore.initialize();
  }

  async ingestKnowledgeItem(notebookId, knowledgeId, knowledgeItem) {
    if (!notebookId || !knowledgeId || !knowledgeItem) {
      throw new Error('Notebook ID, knowledge ID, and knowledge item are required');
    }

    try {
      await this.initialize();
      
      // Process the document based on type
      const processed = await this.documentProcessor.processKnowledgeItem(knowledgeItem);
      
      if (!processed.text || processed.text.trim().length === 0) {
        throw new Error('No text content found in knowledge item');
      }
      
      // Split into chunks
      const chunks = await this.textSplitter.createDocuments(
        [processed.text],
        [{ notebookId, knowledgeId, ...processed.metadata }]
      );
      
      if (chunks.length === 0) {
        throw new Error('No chunks created from document');
      }
      
      console.log(`[Ingestion] Processing ${chunks.length} chunks for ${knowledgeItem.title}`);
      
      // Process in batches to avoid "Payload too large" errors
      const BATCH_SIZE = 100;
      const texts = chunks.map(chunk => chunk.pageContent);
      
      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batchEnd = Math.min(i + BATCH_SIZE, chunks.length);
        const batchTexts = texts.slice(i, batchEnd);
        const batchChunks = chunks.slice(i, batchEnd);
        
        console.log(`[Ingestion] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)}`);
        
        // Generate embeddings for this batch
        const batchEmbeddings = await this.embeddings.embedDocuments(batchTexts);
        
        // Prepare metadata (ChromaDB only accepts strings, numbers, booleans)
        const batchMetadatas = batchChunks.map((chunk, index) => ({
          notebookId: String(notebookId),
          knowledgeId: String(knowledgeId),
          chunkIndex: i + index,
          title: String(knowledgeItem.title || ''),
          type: String(knowledgeItem.type || '')
        }));
        
        // Generate IDs
        const batchIds = batchChunks.map((_, index) => `${notebookId}_${knowledgeId}_${i + index}`);
        
        // Store in vector database
        await this.vectorStore.addDocuments(
          batchEmbeddings,
          batchTexts,
          batchMetadatas,
          batchIds
        );
      }
      
      // Update knowledge item to mark as embedded
      const knowledgeManager = new KnowledgeManager();
      await knowledgeManager.updateKnowledgeItem(notebookId, knowledgeId, {
        embedded: true
      });
      
      return {
        chunks: chunks.length,
        embedded: true
      };
    } catch (error) {
      throw new Error(`Failed to ingest knowledge item: ${error.message}`);
    }
  }

  async reingestNotebook(notebookId) {
    await this.initialize();
    const knowledgeManager = new KnowledgeManager();
    const items = await knowledgeManager.getKnowledgeItems(notebookId);
    
    const results = [];
    for (const item of items) {
      try {
        const result = await this.ingestKnowledgeItem(notebookId, item.id, item);
        results.push({ knowledgeId: item.id, ...result });
      } catch (error) {
        results.push({ knowledgeId: item.id, error: error.message });
      }
    }
    
    return results;
  }
}
