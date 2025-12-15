import { OpenAIEmbeddings } from '@langchain/openai';
import { VectorStore } from './vector-store.js';
import { CohereClient } from 'cohere-ai';

export class RetrievalEngine {
  constructor(config = {}) {
    this.config = config;
    this.vectorStore = new VectorStore(config.vectorDb);
    this.embeddings = null;
    this.cohere = null;
  }

  async initialize() {
    if (!this.embeddings) {
      this.embeddings = new OpenAIEmbeddings({
        model: this.config.embeddings?.model || 'text-embedding-3-small',
        openAIApiKey: this.config.llm?.apiKey
      });
    }
    if (!this.cohere && this.config.cohere?.apiKey) {
      this.cohere = new CohereClient({ token: this.config.cohere.apiKey });
    }
    await this.vectorStore.initialize();
  }

  async rerankDocuments(query, documents, topK = 15) {
    if (!this.cohere || documents.length === 0) {
      return documents.slice(0, topK);
    }

    try {
      const result = await this.cohere.rerank({
        model: 'rerank-v4.0-pro',
        query: query,
        documents: documents.map(d => d.content),
        topN: Math.min(topK, documents.length)
      });
      
      const finalResult = result.results.map(r => documents[r.index]);
      console.log('[Reranked Documents]', finalResult);
      return finalResult;
    } catch (error) {
      console.warn('Reranking failed, using original order:', error.message);
      return documents.slice(0, topK);
    }
  }

  async retrieve(query, options = {}) {
    await this.initialize();
    
    const {
      notebookId = null,
      topK = 15,
      useReranking = true
    } = options;
    
    // Retrieve more documents than needed for reranking
    const retrievalCount = useReranking && this.cohere ? topK * 4 : topK;
    
    // Generate query embedding
    const queryEmbedding = await this.embeddings.embedQuery(query);
    
    // Search vector store
    const results = await this.vectorStore.query(queryEmbedding, {
      nResults: retrievalCount,
      notebookId
    });
    
    // Format results
    const documents = results.documents.map((doc, index) => ({
      content: doc,
      metadata: results.metadatas[index],
      distance: results.distances[index],
      id: results.ids[index]
    }));
    
    // Rerank if enabled and Cohere is configured
    if (useReranking && this.cohere && documents.length > 0) {
      return await this.rerankDocuments(query, documents, topK);
    }
    
    return documents.slice(0, topK);
  }
}
