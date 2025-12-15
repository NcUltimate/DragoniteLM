import { ChromaClient } from 'chromadb';

export class VectorStore {
  constructor(config = {}) {
    this.config = config;
    this.client = null;
    this.collectionName = 'dragonitelm_documents';
  }

  async initialize() {
    if (this.client) {
      return;
    }

    const serverUrl = this.config.path || 'http://localhost:8000';
    
    this.client = new ChromaClient({ path: serverUrl });

    try {
      await this.client.getCollection({ name: this.collectionName });
    } catch (error) {
      await this.client.createCollection({
        name: this.collectionName,
        metadata: { description: 'DragoniteLM document embeddings' }
      });
    }
  }

  async getCollection() {
    await this.initialize();
    return await this.client.getCollection({ name: this.collectionName });
  }

  async addDocuments(embeddings, documents, metadatas, ids) {
    await this.initialize();
    const collection = await this.getCollection();
    
    await collection.add({
      ids,
      embeddings,
      documents,
      metadatas
    });
  }

  async query(queryEmbedding, options = {}) {
    await this.initialize();
    const collection = await this.getCollection();
    
    const {
      nResults = 15,
      notebookId = null,
      where = {}
    } = options;

    // Build where clause for filtering
    const whereClause = { ...where };
    if (notebookId) {
      whereClause.notebookId = notebookId;
    }

    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults,
      where: Object.keys(whereClause).length > 0 ? whereClause : undefined
    });

    return {
      ids: results.ids[0] || [],
      documents: results.documents[0] || [],
      metadatas: results.metadatas[0] || [],
      distances: results.distances[0] || []
    };
  }

  async deleteByNotebook(notebookId) {
    await this.initialize();
    const collection = await this.getCollection();
    
    await collection.delete({
      where: { notebookId }
    });
  }

  async deleteByKnowledgeItem(notebookId, knowledgeId) {
    await this.initialize();
    const collection = await this.getCollection();
    
    await collection.delete({
      where: {
        notebookId,
        knowledgeId
      }
    });
  }
}
