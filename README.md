# LMnade - RAG-Powered Notebook

An Electron desktop application for managing knowledge with AI-powered chat using advanced RAG. Motivated by NotebookLM, though I've had the idea for longer and have been wanting to build it.

Your knowledge stays on your system. No Cloud storage provider needed. An eventual minor upgrade would be allowing selection of multiple system files for a given notebook.

## Quick Start

```bash
# Clone the repository
git clone https://github.com/NcUltimate/LM-RAG-Notebook.git
cd LM-RAG-Notebook

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY (required)
# Optionally add COHERE_API_KEY for reranking support

# Start the application (runs ChromaDB + Electron)
npm start
```

## Overview

LMnade is an Electron-based desktop application that combines note-taking with powerful AI chat capabilities. It uses advanced RAG techniques to provide contextual answers from your knowledge base, with persistent chat history and configurable response detail levels.

## Core Technologies

| Technology | Purpose |
|------------|---------|
| **Electron** | Cross-platform desktop application framework |
| **LangChain** | LLM orchestration and RAG pipeline |
| **OpenAI GPT-4** | Language model for chat completions |
| **ChromaDB** | Vector database for embeddings storage |
| **Cohere** | Reranking API for improved retrieval |
| **OpenAI Embeddings** | Text embedding model (text-embedding-3-small) |
| **pdf-parse** | PDF document processing |
| **dotenv** | Environment variable management |

## RAG Techniques Implemented

### Multi-Query Retrieval
- Generates multiple query variations for comprehensive search
- Retrieves documents for each variation independently
- Deduplicates and combines results before reranking
- Improves recall for complex or ambiguous queries

### HyDE (Hypothetical Document Embeddings)
- Alternative retrieval strategy to Multi-Query
- Generates a hypothetical answer to the query
- Uses the hypothetical answer for semantic search
- Effective for bridging vocabulary gaps

### Reranking with Cohere
- Two-stage retrieval: initial vector search + reranking
- Retrieves 4x documents initially, reranks to top-k
- Significantly improves relevance of final results
- Cross-encoder model considers query-document interaction

### Conversation Context
- Maintains last 20 messages for contextual understanding
- Passes conversation history to query generation and chat
- Enables natural follow-up questions and multi-turn dialogue

### Configurable Detail Levels
- Brief: Concise, direct answers
- Normal: Balanced responses with context
- Detailed: Comprehensive answers with examples
- Meticulous: Exhaustive, carefully organized responses

## Features

- **Notebook Organization**: Create and manage multiple knowledge notebooks
- **Knowledge Ingestion**: Add notes, PDFs, URLs, and articles
- **Automatic Chunking**: Configurable chunk size (1000) and overlap (200)
- **Batch Processing**: Handles large documents (e.g., Moby Dick) with batched embedding
- **Persistent Chat**: Conversation history saved per notebook
- **Visual Feedback**: Loading spinners, success/error indicators for ingestion
- **Responsive UI**: Modern interface with click-anywhere targets

## Architecture

```
src/
├── core/           # Core business logic
│   ├── chat-manager.js       # Chat history persistence
│   ├── knowledge-manager.js  # Knowledge item CRUD
│   ├── notebook-manager.js   # Notebook management
│   ├── storage.js           # JSON file storage
│   └── document-processor.js # Document parsing
├── rag/            # RAG pipeline
│   ├── chat-engine.js       # Main chat orchestration
│   ├── retrieval.js         # Retrieval & reranking
│   ├── ingestion.js         # Document chunking & embedding
│   └── vector-store.js      # ChromaDB interface
├── main/           # Electron main process
│   ├── main.js             # App entry point
│   ├── ipc-handlers.js     # IPC communication
│   └── preload.js          # Context bridge
└── renderer/       # UI
    ├── index.html
    ├── scripts/
    └── styles/
```

## Configuration

Edit `config/default.json` for RAG parameters:

- **Chunking**: Adjust chunk size and overlap
- **Model**: Change LLM model (default: gpt-4o-mini)
- **Temperature**: Control response creativity (default: 0.7)
- **Embeddings**: Configure embedding model and dimensions

API keys are managed via `.env` file:
- `OPENAI_API_KEY`: **Required** - Used for LLM chat completions and embeddings
- `COHERE_API_KEY`: **Optional** - Only needed if you want to enable reranking for improved retrieval accuracy

## Development

```bash
# Run with dev tools
npm run electron:dev

# Build for production
npm run build        # All platforms
npm run build:linux  # Linux only
npm run build:mac    # macOS only
npm run build:win    # Windows only
```

## Data Storage

- **Notebooks**: `data/notebooks/{id}.json`
- **Vector DB**: `data/chroma/`
- **Files**: `data/notebooks/{id}/files/`

All data is stored locally on your machine.

## License

MIT

