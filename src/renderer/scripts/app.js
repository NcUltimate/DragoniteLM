let currentNotebookId = null;

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
  await loadNotebooks();
  setupEventListeners();
});

function setupEventListeners() {
  // Create notebook button
  document.getElementById('create-notebook-btn').addEventListener('click', () => {
    showCreateNotebookModal();
  });

  // Create notebook modal
  document.getElementById('create-notebook-submit').addEventListener('click', async () => {
    const name = document.getElementById('notebook-name-input').value.trim();
    if (name) {
      await createNotebook(name);
      hideCreateNotebookModal();
    }
  });

  document.getElementById('create-notebook-cancel').addEventListener('click', () => {
    hideCreateNotebookModal();
  });

  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      switchTab(tabName);
    });
  });

  // Add knowledge button
  document.getElementById('add-knowledge-btn').addEventListener('click', () => {
    showAddKnowledgeModal();
  });

  // Knowledge type selector
  document.getElementById('knowledge-type-select').addEventListener('change', (e) => {
    const type = e.target.value;
    const contentInput = document.getElementById('knowledge-content-input');
    const pdfBtn = document.getElementById('select-pdf-btn');
    
    if (type === 'pdf') {
      contentInput.classList.add('hidden');
      pdfBtn.classList.remove('hidden');
    } else {
      contentInput.classList.remove('hidden');
      pdfBtn.classList.add('hidden');
    }
  });

  // Select PDF button
  document.getElementById('select-pdf-btn').addEventListener('click', async () => {
    const filePath = await window.electronAPI.files.selectPDF();
    if (filePath) {
      document.getElementById('knowledge-content-input').value = filePath;
    }
  });

  // Add knowledge modal
  document.getElementById('add-knowledge-submit').addEventListener('click', async () => {
    await addKnowledgeItem();
    hideAddKnowledgeModal();
  });

  document.getElementById('add-knowledge-cancel').addEventListener('click', () => {
    hideAddKnowledgeModal();
  });

  // Rename notebook modal
  document.getElementById('rename-notebook-submit').addEventListener('click', async () => {
    await submitRenameNotebook();
  });

  document.getElementById('rename-notebook-cancel').addEventListener('click', () => {
    hideRenameNotebookModal();
  });

  document.getElementById('rename-notebook-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      submitRenameNotebook();
    }
  });

  // Delete notebook button
  document.getElementById('delete-notebook-btn').addEventListener('click', async () => {
    if (currentNotebookId && confirm('Are you sure you want to delete this notebook?')) {
      await deleteNotebook(currentNotebookId);
    }
  });
}

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`${tabName}-tab`).classList.add('active');
}

function showCreateNotebookModal() {
  document.getElementById('create-notebook-modal').classList.remove('hidden');
  document.getElementById('notebook-name-input').value = '';
  document.getElementById('notebook-name-input').focus();
}

function hideCreateNotebookModal() {
  document.getElementById('create-notebook-modal').classList.add('hidden');
}

function showAddKnowledgeModal() {
  document.getElementById('add-knowledge-modal').classList.remove('hidden');
  document.getElementById('knowledge-title-input').value = '';
  document.getElementById('knowledge-content-input').value = '';
  document.getElementById('knowledge-type-select').value = 'note';
  document.getElementById('knowledge-content-input').classList.remove('hidden');
  document.getElementById('select-pdf-btn').classList.add('hidden');
}

function hideAddKnowledgeModal() {
  document.getElementById('add-knowledge-modal').classList.add('hidden');
}

function showRenameNotebookModal(notebookId, currentName) {
  window.renameNotebookId = notebookId;
  document.getElementById('rename-notebook-modal').classList.remove('hidden');
  document.getElementById('rename-notebook-input').value = currentName;
  document.getElementById('rename-notebook-input').focus();
  document.getElementById('rename-notebook-input').select();
}

function hideRenameNotebookModal() {
  document.getElementById('rename-notebook-modal').classList.add('hidden');
  window.renameNotebookId = null;
}

async function submitRenameNotebook() {
  const notebookId = window.renameNotebookId;
  if (!notebookId) return;

  const newName = document.getElementById('rename-notebook-input').value.trim();
  if (!newName) {
    alert('Please enter a notebook name');
    return;
  }

  try {
    await window.electronAPI.notebooks.rename(notebookId, newName);
    await loadNotebooks();
    
    // Update the title if it's the currently selected notebook
    if (notebookId === currentNotebookId) {
      document.getElementById('notebook-title').textContent = newName;
    }
    
    hideRenameNotebookModal();
  } catch (error) {
    alert(`Error renaming notebook: ${error.message}`);
  }
}

async function createNotebook(name) {
  try {
    const notebook = await window.electronAPI.notebooks.create(name);
    await loadNotebooks();
    selectNotebook(notebook.id);
  } catch (error) {
    alert(`Error creating notebook: ${error.message}`);
  }
}

async function deleteNotebook(notebookId) {
  try {
    await window.electronAPI.notebooks.delete(notebookId);
    currentNotebookId = null;
    await loadNotebooks();
    showEmptyState();
  } catch (error) {
    alert(`Error deleting notebook: ${error.message}`);
  }
}

async function addKnowledgeItem() {
  if (!currentNotebookId) return;

  const type = document.getElementById('knowledge-type-select').value;
  const title = document.getElementById('knowledge-title-input').value.trim();
  const content = document.getElementById('knowledge-content-input').value.trim();

  if (!title) {
    alert('Please enter a title');
    return;
  }

  try {
    const data = { type, title, content };
    if (type === 'pdf') {
      data.filePath = content;
    }
    
    const newItem = await window.electronAPI.knowledge.add(currentNotebookId, data);
    await loadKnowledgeItems();
    
    // Auto-ingest the newly added item
    if (newItem && newItem.id) {
      ingestKnowledgeItemAuto(newItem.id);
    }
  } catch (error) {
    alert(`Error adding knowledge item: ${error.message}`);
  }
}

function showEmptyState() {
  document.getElementById('notebook-view').classList.add('hidden');
  document.getElementById('empty-state').classList.remove('hidden');
}

function hideEmptyState() {
  document.getElementById('notebook-view').classList.remove('hidden');
  document.getElementById('empty-state').classList.add('hidden');
}

async function loadNotebooks() {
  try {
    const notebooks = await window.electronAPI.notebooks.list();
    renderNotebooks(notebooks || []);
  } catch (error) {
    console.error('Error loading notebooks:', error);
    renderNotebooks([]);
  }
}

function renderNotebooks(notebooks) {
  const list = document.getElementById('notebooks-list');
  list.innerHTML = '';

  if (!notebooks || !Array.isArray(notebooks)) {
    return;
  }

  notebooks.forEach(notebook => {
    const item = document.createElement('div');
    item.className = 'notebook-item';
    if (notebook.id === currentNotebookId) {
      item.classList.add('active');
    }
    
    // Make the entire item clickable
    item.addEventListener('click', () => selectNotebook(notebook.id));
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'notebook-name';
    nameSpan.textContent = notebook.name;
    
    const menuBtn = document.createElement('button');
    menuBtn.className = 'notebook-menu-btn';
    menuBtn.innerHTML = '⋮';
    menuBtn.setAttribute('data-notebook-id', notebook.id);
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleNotebookMenu(notebook.id);
    });
    
    const menu = document.createElement('div');
    menu.className = 'notebook-menu hidden';
    menu.id = `notebook-menu-${notebook.id}`;
    menu.innerHTML = `
      <button class="menu-item" onclick="event.stopPropagation(); renameNotebook('${notebook.id}')">Rename</button>
      <button class="menu-item delete" onclick="event.stopPropagation(); deleteNotebookFromMenu('${notebook.id}')">Delete</button>
    `;
    
    item.appendChild(nameSpan);
    item.appendChild(menuBtn);
    item.appendChild(menu);
    list.appendChild(item);
  });
}

function toggleNotebookMenu(notebookId) {
  // Close all other menus
  document.querySelectorAll('.notebook-menu').forEach(menu => {
    if (menu.id !== `notebook-menu-${notebookId}`) {
      menu.classList.add('hidden');
    }
  });
  
  // Toggle the clicked menu
  const menu = document.getElementById(`notebook-menu-${notebookId}`);
  if (menu) {
    menu.classList.toggle('hidden');
  }
}

// Close menus when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.notebook-menu-btn') && !e.target.closest('.notebook-menu')) {
    document.querySelectorAll('.notebook-menu').forEach(menu => {
      menu.classList.add('hidden');
    });
  }
});

window.renameNotebook = async function(notebookId) {
  const notebook = await window.electronAPI.notebooks.get(notebookId);
  if (!notebook) return;
  
  // Hide the menu
  document.getElementById(`notebook-menu-${notebookId}`).classList.add('hidden');
  
  // Show the rename modal
  showRenameNotebookModal(notebookId, notebook.name);
};

window.deleteNotebookFromMenu = async function(notebookId) {
  if (confirm('Are you sure you want to delete this notebook?')) {
    try {
      await window.electronAPI.notebooks.delete(notebookId);
      if (currentNotebookId === notebookId) {
        currentNotebookId = null;
        showEmptyState();
      }
      await loadNotebooks();
    } catch (error) {
      alert(`Error deleting notebook: ${error.message}`);
    }
  }
  
  // Hide the menu
  const menu = document.getElementById(`notebook-menu-${notebookId}`);
  if (menu) {
    menu.classList.add('hidden');
  }
};

async function selectNotebook(notebookId) {
  currentNotebookId = notebookId;
  
  try {
    const notebook = await window.electronAPI.notebooks.get(notebookId);
    document.getElementById('notebook-title').textContent = notebook.name;
    hideEmptyState();
    await loadKnowledgeItems();
    renderNotebooks(await window.electronAPI.notebooks.list());
    
    // Dispatch event for chat to load history
    window.dispatchEvent(new CustomEvent('notebookChanged', { 
      detail: { notebookId } 
    }));
  } catch (error) {
    alert(`Error loading notebook: ${error.message}`);
  }
}

async function loadKnowledgeItems() {
  if (!currentNotebookId) return;

  try {
    const items = await window.electronAPI.knowledge.list(currentNotebookId);
    renderKnowledgeItems(items || []);
  } catch (error) {
    console.error('Error loading knowledge items:', error);
    renderKnowledgeItems([]);
  }
}

function renderKnowledgeItems(items) {
  const list = document.getElementById('knowledge-list');
  list.innerHTML = '';

  if (!items || !Array.isArray(items) || items.length === 0) {
    list.innerHTML = '<p style="color: #999; text-align: center; padding: 2rem;">No knowledge items yet. Add some to get started!</p>';
    return;
  }

  items.forEach(item => {
    const element = document.createElement('div');
    element.className = 'knowledge-item';
    element.id = `knowledge-item-${item.id}`;
    
    // Determine status icon
    let statusIcon = '';
    const status = item.ingestionStatus || (item.embedded ? 'success' : 'pending');
    
    if (status === 'ingesting') {
      statusIcon = '<div class="status-icon loading"><div class="spinner"></div></div>';
    } else if (status === 'success') {
      statusIcon = '<div class="status-icon success">✓</div>';
    } else if (status === 'error') {
      statusIcon = '<div class="status-icon error">✕</div>';
    } else {
      statusIcon = '<div class="status-icon pending">⋯</div>';
    }
    
    const statusText = status === 'ingesting' ? 'Ingesting...' : 
                      status === 'success' ? 'Ready' : 
                      status === 'error' ? 'Failed' : 
                      'Pending';
    
    element.innerHTML = `
      <div class="knowledge-item-header">
        <div>
          <div class="knowledge-item-title">${escapeHtml(item.title)}</div>
          <div class="knowledge-item-meta">${item.type} • ${statusText}</div>
        </div>
        <div class="knowledge-item-actions">
          ${statusIcon}
          ${status === 'error' || status === 'pending' ? `<button class="btn btn-small btn-secondary" onclick="ingestKnowledgeItemManual('${item.id}')">Retry</button>` : ''}
          <button class="btn btn-small btn-danger" onclick="deleteKnowledgeItem('${item.id}')">Delete</button>
        </div>
      </div>
    `;
    list.appendChild(element);
  });
}

function updateKnowledgeItemStatus(knowledgeId, status) {
  const element = document.getElementById(`knowledge-item-${knowledgeId}`);
  if (!element) return;
  
  // Update the UI immediately without reloading all items
  const statusIconContainer = element.querySelector('.status-icon');
  const metaText = element.querySelector('.knowledge-item-meta');
  
  if (statusIconContainer) {
    if (status === 'ingesting') {
      statusIconContainer.className = 'status-icon loading';
      statusIconContainer.innerHTML = '<div class="spinner"></div>';
    } else if (status === 'success') {
      statusIconContainer.className = 'status-icon success';
      statusIconContainer.innerHTML = '✓';
    } else if (status === 'error') {
      statusIconContainer.className = 'status-icon error';
      statusIconContainer.innerHTML = '✕';
    }
  }
  
  if (metaText) {
    const parts = metaText.textContent.split(' • ');
    const statusText = status === 'ingesting' ? 'Ingesting...' : 
                      status === 'success' ? 'Ready' : 
                      status === 'error' ? 'Failed' : 
                      'Pending';
    metaText.textContent = `${parts[0]} • ${statusText}`;
  }
}

async function ingestKnowledgeItemAuto(knowledgeId) {
  if (!currentNotebookId) return;
  
  updateKnowledgeItemStatus(knowledgeId, 'ingesting');
  
  try {
    await window.electronAPI.knowledge.ingest(currentNotebookId, knowledgeId);
    updateKnowledgeItemStatus(knowledgeId, 'success');
    // Reload to get the updated embedded status
    setTimeout(() => loadKnowledgeItems(), 1000);
  } catch (error) {
    console.error('Auto-ingestion error:', error);
    updateKnowledgeItemStatus(knowledgeId, 'error');
  }
}

window.ingestKnowledgeItemManual = async function(knowledgeId) {
  if (!currentNotebookId) return;
  
  updateKnowledgeItemStatus(knowledgeId, 'ingesting');
  
  try {
    await window.electronAPI.knowledge.ingest(currentNotebookId, knowledgeId);
    updateKnowledgeItemStatus(knowledgeId, 'success');
    // Reload to get the updated embedded status
    setTimeout(() => loadKnowledgeItems(), 1000);
  } catch (error) {
    alert(`Error ingesting knowledge item: ${error.message}`);
    updateKnowledgeItemStatus(knowledgeId, 'error');
  }
};

window.deleteKnowledgeItem = async function(knowledgeId) {
  if (!currentNotebookId) return;

  if (!confirm('Are you sure you want to delete this knowledge item?')) {
    return;
  }

  try {
    await window.electronAPI.knowledge.delete(currentNotebookId, knowledgeId);
    await loadKnowledgeItems();
  } catch (error) {
    alert(`Error deleting knowledge item: ${error.message}`);
  }
};

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Export for other scripts
window.appState = {
  getCurrentNotebookId: () => currentNotebookId,
  loadKnowledgeItems
};
