import { randomUUID } from 'crypto';
import { Storage } from './storage.js';
import path from 'path';

export class KnowledgeManager {
  constructor(storage = new Storage()) {
    this.storage = storage;
  }

  async initialize() {
    await this.storage.ensureDirectories();
  }

  async getKnowledgeItems(notebookId) {
    await this.initialize();
    const notebook = await this.getNotebook(notebookId);
    if (!notebook) {
      throw new Error(`Notebook ${notebookId} not found`);
    }
    
    return notebook.knowledgeItems || [];
  }

  async getKnowledgeItem(notebookId, knowledgeId) {
    await this.initialize();
    const items = await this.getKnowledgeItems(notebookId);
    return items.find(item => item.id === knowledgeId) || null;
  }

  async addKnowledgeItem(notebookId, knowledgeData) {
    if (!notebookId) {
      throw new Error('Notebook ID is required');
    }
    if (!knowledgeData || !knowledgeData.type) {
      throw new Error('Knowledge item type is required');
    }

    await this.initialize();
    const notebook = await this.getNotebook(notebookId);
    if (!notebook) {
      throw new Error(`Notebook ${notebookId} not found`);
    }
    
    try {
      const knowledgeItem = {
        id: randomUUID(),
        notebookId,
        type: knowledgeData.type,
        title: knowledgeData.title || '',
        content: knowledgeData.content || '',
        metadata: knowledgeData.metadata || {},
        createdAt: new Date().toISOString(),
        embedded: false
      };
      
      // Handle file uploads
      if (knowledgeData.type === 'pdf' && knowledgeData.filePath) {
        const filesDir = this.storage.getNotebookFilesDir(notebookId);
        await this.storage.ensureDirectories();
        const fileName = path.basename(knowledgeData.filePath);
        const destPath = path.join(filesDir, fileName);
        
        // Copy file to notebook's files directory
        const fs = await import('fs/promises');
        try {
          await fs.copyFile(knowledgeData.filePath, destPath);
          knowledgeItem.content = destPath;
        } catch (error) {
          throw new Error(`Failed to copy file: ${error.message}`);
        }
      }
      
      if (!notebook.knowledgeItems) {
        notebook.knowledgeItems = [];
      }
      
      notebook.knowledgeItems.push(knowledgeItem);
      notebook.updatedAt = new Date().toISOString();
      
      const filePath = this.storage.getNotebookPath(notebookId);
      await this.storage.writeJSON(filePath, notebook);
      
      return knowledgeItem;
    } catch (error) {
      throw new Error(`Failed to add knowledge item: ${error.message}`);
    }
  }

  async updateKnowledgeItem(notebookId, knowledgeId, updates) {
    await this.initialize();
    const notebook = await this.getNotebook(notebookId);
    if (!notebook) {
      throw new Error(`Notebook ${notebookId} not found`);
    }
    
    if (!notebook.knowledgeItems) {
      throw new Error(`Knowledge item ${knowledgeId} not found`);
    }
    
    const index = notebook.knowledgeItems.findIndex(item => item.id === knowledgeId);
    if (index === -1) {
      throw new Error(`Knowledge item ${knowledgeId} not found`);
    }
    
    notebook.knowledgeItems[index] = {
      ...notebook.knowledgeItems[index],
      ...updates,
    };
    
    notebook.updatedAt = new Date().toISOString();
    
    const filePath = this.storage.getNotebookPath(notebookId);
    await this.storage.writeJSON(filePath, notebook);
    
    return notebook.knowledgeItems[index];
  }

  async deleteKnowledgeItem(notebookId, knowledgeId) {
    await this.initialize();
    const notebook = await this.getNotebook(notebookId);
    if (!notebook) {
      throw new Error(`Notebook ${notebookId} not found`);
    }
    
    if (!notebook.knowledgeItems) {
      return;
    }
    
    const item = notebook.knowledgeItems.find(item => item.id === knowledgeId);
    if (item && item.type === 'pdf' && item.content) {
      // Delete associated file
      try {
        await this.storage.deleteFile(item.content);
      } catch (error) {
        // Ignore file deletion errors
      }
    }
    
    notebook.knowledgeItems = notebook.knowledgeItems.filter(item => item.id !== knowledgeId);
    notebook.updatedAt = new Date().toISOString();
    
    const filePath = this.storage.getNotebookPath(notebookId);
    await this.storage.writeJSON(filePath, notebook);
  }

  async getNotebook(notebookId) {
    const filePath = this.storage.getNotebookPath(notebookId);
    return await this.storage.readJSON(filePath);
  }
}
