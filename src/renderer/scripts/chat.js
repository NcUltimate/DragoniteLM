let messageIdCounter = 0;
let currentDetailLevel = 'normal';

document.addEventListener('DOMContentLoaded', () => {
  setupChatListeners();
  
  // Listen for notebook changes to load chat history
  window.addEventListener('notebookChanged', async (e) => {
    const notebookId = e.detail.notebookId;
    await loadChatHistory(notebookId);
  });
});

function setupChatListeners() {
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send-btn');
  const clearBtn = document.getElementById('chat-clear-btn');

  sendBtn.addEventListener('click', sendMessage);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });
  
  if (clearBtn) {
    clearBtn.addEventListener('click', clearChatHistory);
  }
  
  // Detail level selector
  const detailBtns = document.querySelectorAll('.detail-btn');
  detailBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active from all buttons
      detailBtns.forEach(b => b.classList.remove('active'));
      // Add active to clicked button
      btn.classList.add('active');
      // Update current detail level
      currentDetailLevel = btn.dataset.level;
    });
  });
}

function getDetailLevelPrompt(level) {
  // For now, just return the level word - user will customize later
  return level;
}

async function loadChatHistory(notebookId) {
  // Clear the UI
  const messagesContainer = document.getElementById('chat-messages');
  
  if (!messagesContainer) {
    console.error('Chat messages container not found');
    return;
  }
  
  messagesContainer.innerHTML = '';
  messageIdCounter = 0;
  
  if (!notebookId) {
    return;
  }
  
  try {
    // Load chat history from backend
    const history = await window.electronAPI.chat.getHistory(notebookId);
    
    // Display all messages
    for (const msg of history) {
      await addMessage(msg.role, msg.content, false); // false = don't save to backend
    }
  } catch (error) {
    console.error('Failed to load chat history:', error);
  }
}

async function clearChatHistory() {
  const notebookId = window.appState.getCurrentNotebookId();
  if (!notebookId) {
    alert('Please select a notebook first');
    return;
  }
  
  if (!confirm('Are you sure you want to clear the chat history? This cannot be undone.')) {
    return;
  }
  
  try {
    await window.electronAPI.chat.clear(notebookId);
    
    // Clear the UI
    const messagesContainer = document.getElementById('chat-messages');
    if (messagesContainer) {
      messagesContainer.innerHTML = '';
      messageIdCounter = 0;
    }
  } catch (error) {
    alert(`Failed to clear chat: ${error.message}`);
  }
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const query = input.value.trim();
  
  if (!query) return;

  const notebookId = window.appState.getCurrentNotebookId();
  if (!notebookId) {
    alert('Please select a notebook first');
    return;
  }

  // Add user message to chat and save it
  const userMsgId = await addMessage('user', query, true);
  if (userMsgId === null) {
    alert('Failed to add message. Please make sure you are on the Chat tab.');
    return;
  }
  
  input.value = '';

  // Show loading indicator
  const loadingId = await addMessage('assistant', 'Thinking...', false);
  
  if (loadingId === null) {
    console.error('Failed to create loading message element');
    alert('Failed to create message element. Please make sure you are on the Chat tab.');
    return;
  }
  
  const loadingElement = document.getElementById(`message-${loadingId}`);
  
  if (!loadingElement) {
    console.error('Loading element not found after creation');
    return;
  }

  try {
    // Get response with detail level
    const response = await window.electronAPI.chat.send(notebookId, query, currentDetailLevel);
    
    // Replace "Thinking..." with actual response
    if (loadingElement) {
      loadingElement.innerHTML = ''; // Clear the loading spinner
      loadingElement.textContent = response;
      loadingElement.classList.remove('loading');
    }
    
    // Save assistant message to backend
    await window.electronAPI.chat.saveMessage(notebookId, 'assistant', response);
  } catch (error) {
    if (loadingElement) {
      loadingElement.innerHTML = ''; // Clear the loading spinner
      loadingElement.textContent = `Error: ${error.message}`;
      loadingElement.classList.remove('loading');
      loadingElement.classList.add('error');
    }
  }
}

async function addMessage(role, content, saveToBackend = true) {
  const messagesContainer = document.getElementById('chat-messages');
  
  if (!messagesContainer) {
    console.error('Chat messages container not found');
    return null;
  }
  
  const messageId = ++messageIdCounter;
  
  const message = document.createElement('div');
  message.id = `message-${messageId}`;
  message.className = `message ${role}`;
  
  if (content === 'Thinking...') {
    message.classList.add('loading');
    // Add spinner for loading state
    message.innerHTML = `
      <div class="message-loading">
        <div class="spinner"></div>
        <span>Thinking...</span>
      </div>
    `;
  } else {
    message.textContent = content;
  }
  
  messagesContainer.appendChild(message);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  // Save to backend if requested
  if (saveToBackend && content !== 'Thinking...') {
    const notebookId = window.appState.getCurrentNotebookId();
    if (notebookId) {
      try {
        await window.electronAPI.chat.saveMessage(notebookId, role, content);
      } catch (error) {
        console.error('Failed to save message:', error);
      }
    }
  }
  
  return messageId;
}
