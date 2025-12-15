const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Notebook operations
  notebooks: {
    list: () => ipcRenderer.invoke('notebooks:list'),
    create: (name) => ipcRenderer.invoke('notebooks:create', name),
    delete: (id) => ipcRenderer.invoke('notebooks:delete', id),
    get: (id) => ipcRenderer.invoke('notebooks:get', id),
    rename: (id, name) => ipcRenderer.invoke('notebooks:rename', id, name)
  },
  
  // Knowledge operations
  knowledge: {
    list: (notebookId) => ipcRenderer.invoke('knowledge:list', notebookId),
    add: (notebookId, data) => ipcRenderer.invoke('knowledge:add', notebookId, data),
    delete: (notebookId, knowledgeId) => ipcRenderer.invoke('knowledge:delete', notebookId, knowledgeId),
    ingest: (notebookId, knowledgeId) => ipcRenderer.invoke('knowledge:ingest', notebookId, knowledgeId)
  },
  
  // Chat operations
  chat: {
    send: (notebookId, query, detailLevel) => ipcRenderer.invoke('chat:send', notebookId, query, detailLevel),
    getHistory: (notebookId) => ipcRenderer.invoke('chat:getHistory', notebookId),
    saveMessage: (notebookId, role, content) => ipcRenderer.invoke('chat:saveMessage', notebookId, role, content),
    clear: (notebookId) => ipcRenderer.invoke('chat:clear', notebookId)
  },
  
  // File operations
  files: {
    selectPDF: () => ipcRenderer.invoke('files:selectPDF')
  }
});
