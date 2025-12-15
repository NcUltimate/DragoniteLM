import { randomUUID } from 'crypto';
import { Storage } from './storage.js';

export class NotebookManager {
  constructor(storage = new Storage()) {
    this.storage = storage;
  }

  async initialize() {
    await this.storage.ensureDirectories();
  }

  async listNotebooks() {
    await this.initialize();
    const files = await this.storage.listFiles(this.storage.notebooksDir);
    const notebooks = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const notebookId = file.replace('.json', '');
        const notebook = await this.getNotebook(notebookId);
        if (notebook) {
          notebooks.push(notebook);
        }
      }
    }
    
    return notebooks.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  async getNotebook(notebookId) {
    await this.initialize();
    const filePath = this.storage.getNotebookPath(notebookId);
    return await this.storage.readJSON(filePath);
  }

  async createNotebook(name) {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new Error('Notebook name is required');
    }

    await this.initialize();
    const notebook = {
      id: randomUUID(),
      name: name.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      knowledgeItems: []
    };
    
    try {
      const filePath = this.storage.getNotebookPath(notebook.id);
      await this.storage.writeJSON(filePath, notebook);
      
      // Create files directory for this notebook
      const filesDir = this.storage.getNotebookFilesDir(notebook.id);
      await this.storage.ensureDirectories();
      
      return notebook;
    } catch (error) {
      throw new Error(`Failed to create notebook: ${error.message}`);
    }
  }

  async updateNotebook(notebookId, updates) {
    await this.initialize();
    const notebook = await this.getNotebook(notebookId);
    if (!notebook) {
      throw new Error(`Notebook ${notebookId} not found`);
    }
    
    const updated = {
      ...notebook,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    const filePath = this.storage.getNotebookPath(notebookId);
    await this.storage.writeJSON(filePath, updated);
    
    return updated;
  }

  async deleteNotebook(notebookId) {
    await this.initialize();
    const filePath = this.storage.getNotebookPath(notebookId);
    await this.storage.deleteFile(filePath);
    
    // Delete files directory
    const filesDir = this.storage.getNotebookFilesDir(notebookId);
    await this.storage.deleteDirectory(filesDir);
  }
}
