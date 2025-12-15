import electron from 'electron';
const { ipcMain, dialog } = electron;
import { NotebookManager } from '../core/notebook-manager.js';
import { KnowledgeManager } from '../core/knowledge-manager.js';
import { ChatManager } from '../core/chat-manager.js';
import { IngestionEngine } from '../rag/ingestion.js';
import { ChatEngine } from '../rag/chat-engine.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

let config = null;

async function loadConfig() {
  if (!config) {
    const configPath = path.join(__dirname, '../../config/default.json');
    const content = await fs.readFile(configPath, 'utf-8');
    config = JSON.parse(content);
    
    // Override with environment variables
    if (process.env.OPENAI_API_KEY) {
      config.llm = config.llm || {};
      config.llm.apiKey = process.env.OPENAI_API_KEY;
    }
    if (process.env.COHERE_API_KEY) {
      config.cohere = config.cohere || {};
      config.cohere.apiKey = process.env.COHERE_API_KEY;
    }
  }
  return config;
}

export function setupIpcHandlers() {
  const notebookManager = new NotebookManager();
  const knowledgeManager = new KnowledgeManager();
  const chatManager = new ChatManager(notebookManager);
  
  // Notebook handlers
  ipcMain.handle('notebooks:list', async () => {
    try {
      return await notebookManager.listNotebooks();
    } catch (error) {
      throw new Error(`Failed to list notebooks: ${error.message}`);
    }
  });
  
  ipcMain.handle('notebooks:create', async (event, name) => {
    try {
      return await notebookManager.createNotebook(name);
    } catch (error) {
      throw new Error(`Failed to create notebook: ${error.message}`);
    }
  });
  
  ipcMain.handle('notebooks:delete', async (event, id) => {
    try {
      await notebookManager.deleteNotebook(id);
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to delete notebook: ${error.message}`);
    }
  });
  
  ipcMain.handle('notebooks:get', async (event, id) => {
    try {
      return await notebookManager.getNotebook(id);
    } catch (error) {
      throw new Error(`Failed to get notebook: ${error.message}`);
    }
  });

  ipcMain.handle('notebooks:rename', async (event, id, name) => {
    try {
      return await notebookManager.updateNotebook(id, { name });
    } catch (error) {
      throw new Error(`Failed to rename notebook: ${error.message}`);
    }
  });
  
  // Knowledge handlers
  ipcMain.handle('knowledge:list', async (event, notebookId) => {
    try {
      return await knowledgeManager.getKnowledgeItems(notebookId);
    } catch (error) {
      throw new Error(`Failed to list knowledge items: ${error.message}`);
    }
  });
  
  ipcMain.handle('knowledge:add', async (event, notebookId, data) => {
    try {
      return await knowledgeManager.addKnowledgeItem(notebookId, data);
    } catch (error) {
      throw new Error(`Failed to add knowledge item: ${error.message}`);
    }
  });
  
  ipcMain.handle('knowledge:delete', async (event, notebookId, knowledgeId) => {
    try {
      await knowledgeManager.deleteKnowledgeItem(notebookId, knowledgeId);
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to delete knowledge item: ${error.message}`);
    }
  });
  
  ipcMain.handle('knowledge:ingest', async (event, notebookId, knowledgeId) => {
    try {
      const cfg = await loadConfig();
      if (!cfg.llm || !cfg.llm.apiKey) {
        throw new Error('LLM API key not configured. Please set it in config/default.json');
      }
      
      const ingestion = new IngestionEngine(cfg);
      
      if (knowledgeId) {
        const item = await knowledgeManager.getKnowledgeItem(notebookId, knowledgeId);
        if (!item) {
          throw new Error(`Knowledge item ${knowledgeId} not found`);
        }
        return await ingestion.ingestKnowledgeItem(notebookId, knowledgeId, item);
      } else {
        return await ingestion.reingestNotebook(notebookId);
      }
    } catch (error) {
      console.error('Ingestion error:', error);
      throw new Error(`Failed to ingest knowledge: ${error.message}`);
    }
  });
  
  // Chat handlers
  ipcMain.handle('chat:getHistory', async (event, notebookId) => {
    try {
      return await chatManager.getChatHistory(notebookId);
    } catch (error) {
      console.error('Get chat history error:', error);
      throw new Error(`Failed to get chat history: ${error.message}`);
    }
  });

  ipcMain.handle('chat:saveMessage', async (event, notebookId, role, content) => {
    try {
      return await chatManager.addMessage(notebookId, role, content);
    } catch (error) {
      console.error('Save message error:', error);
      throw new Error(`Failed to save message: ${error.message}`);
    }
  });

  ipcMain.handle('chat:clear', async (event, notebookId) => {
    try {
      return await chatManager.clearChat(notebookId);
    } catch (error) {
      console.error('Clear chat error:', error);
      throw new Error(`Failed to clear chat: ${error.message}`);
    }
  });

  ipcMain.handle('chat:send', async (event, notebookId, query, detailLevel = 'normal') => {
    try {
      const cfg = await loadConfig();
      if (!cfg.llm || !cfg.llm.apiKey) {
        throw new Error('LLM API key not configured. Please set it in config/default.json');
      }
      
      // Get chat history for context
      const chatHistory = await chatManager.getChatHistory(notebookId);
      
      const chatEngine = new ChatEngine(cfg);
      return await chatEngine.chat(query, { notebookId, chatHistory, detailLevel });
    } catch (error) {
      console.error('Chat error:', error);
      throw new Error(`Failed to send chat message: ${error.message}`);
    }
  });
  
  
  // File handlers
  ipcMain.handle('files:selectPDF', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'PDF Files', extensions: ['pdf'] }
      ]
    });
    
    if (result.canceled) {
      return null;
    }
    
    return result.filePaths[0];
  });
}
