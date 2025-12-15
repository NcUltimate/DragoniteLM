import { randomUUID } from 'crypto';
import { NotebookManager } from './notebook-manager.js';

export class ChatManager {
  constructor(notebookManager = new NotebookManager()) {
    this.notebookManager = notebookManager;
  }

  async getChatHistory(notebookId) {
    if (!notebookId) {
      throw new Error('Notebook ID is required');
    }

    const notebook = await this.notebookManager.getNotebook(notebookId);
    if (!notebook) {
      throw new Error(`Notebook ${notebookId} not found`);
    }

    // Return chat messages or empty array if not present (backward compatibility)
    return notebook.chatMessages || [];
  }

  async addMessage(notebookId, role, content) {
    if (!notebookId) {
      throw new Error('Notebook ID is required');
    }
    if (!role || !['user', 'assistant'].includes(role)) {
      throw new Error('Role must be "user" or "assistant"');
    }
    if (!content || typeof content !== 'string') {
      throw new Error('Content is required');
    }

    const notebook = await this.notebookManager.getNotebook(notebookId);
    if (!notebook) {
      throw new Error(`Notebook ${notebookId} not found`);
    }

    // Initialize chatMessages array if it doesn't exist
    if (!notebook.chatMessages) {
      notebook.chatMessages = [];
    }

    const message = {
      id: randomUUID(),
      role,
      content,
      timestamp: new Date().toISOString()
    };

    notebook.chatMessages.push(message);

    await this.notebookManager.updateNotebook(notebookId, {
      chatMessages: notebook.chatMessages
    });

    return message;
  }

  async clearChat(notebookId) {
    if (!notebookId) {
      throw new Error('Notebook ID is required');
    }

    const notebook = await this.notebookManager.getNotebook(notebookId);
    if (!notebook) {
      throw new Error(`Notebook ${notebookId} not found`);
    }

    await this.notebookManager.updateNotebook(notebookId, {
      chatMessages: []
    });

    return { success: true };
  }

  getRecentMessages(messages, limit = 20) {
    if (!Array.isArray(messages)) {
      return [];
    }
    // Get the last N messages
    return messages.slice(-limit);
  }
}

