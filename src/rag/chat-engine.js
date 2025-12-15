import { ChatOpenAI } from '@langchain/openai';
import { RetrievalEngine } from './retrieval.js';
import { PromptTemplate } from '@langchain/core/prompts';
import { HumanMessage } from '@langchain/core/messages';

export class ChatEngine {
  constructor(config = {}) {
    this.config = config;
    this.llm = null;
    this.retrievalEngine = new RetrievalEngine(config);
  }

  async initialize() {
    if (!this.llm) {ChatEngine
      this.llm = new ChatOpenAI({
        model: this.config.llm?.model || 'gpt-5-mini',
        temperature: this.config.llm?.temperature || 1,
        openAIApiKey: this.config.llm?.apiKey
      });
    }
    await this.retrievalEngine.initialize();
  }

  async generateHypotheticalAnswer(query, chatHistory = []) {
    await this.initialize();
    
    // Get the last 20 messages for context
    const recentHistory = chatHistory.slice(-20);
    const chatContext = recentHistory.length > 0
      ? `\n\nConversation context:\n${recentHistory.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n')}\n`
      : '';
    
    const hydePrompt = `Generate a brief, factual answer to the following question. Write as if you're providing information from a document.${chatContext}

Question: ${query}

Hypothetical answer:`;
    
    const response = await this.llm.invoke([new HumanMessage(hydePrompt)]);
    console.log('[HyDE]', response.content);
    return response.content;
  }

  async generateQueryVariations(query, chatHistory = []) {
    await this.initialize();
    
    // Get the last 20 messages for context
    const recentHistory = chatHistory.slice(-20);
    const chatContext = recentHistory.length > 0
      ? `\n\nConversation context:\n${recentHistory.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n')}\n`
      : '';
    
    const variationsPrompt = `Generate 4 alternative phrasings of this question that would help find relevant information. Consider the conversation context to make the variations more specific and relevant.${chatContext}

Original: ${query}

1.`;
    
    const response = await this.llm.invoke([new HumanMessage(variationsPrompt)]);
    const variations = response.content
      .split('\n')
      .filter(line => line.trim().match(/^\d+\./))
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .filter(v => v.length > 0);

     console.log('[Query Variations]', variations);
    
    return [query, ...variations];
  }

  getDetailLevelPrompt(level) {
    switch (level) {
      case 'brief':
        return 'Provide a compact answer that directly addresses the request with minimal setup. Prefer one clear conclusion and only the most essential supporting points. When listing examples, include just a few representative items rather than trying to be exhaustive. If quantities matter, summarize them (e.g., “several key factors”) instead of enumerating every item.';
      case 'detailed':
        return 'Provide a comprehensive answer that covers all relevant aspects and includes detailed explanations. Include multiple supporting points, examples, and tradeoffs when appropriate. If quantities matter, enumerate every item in the list. When listing examples, include a few representative items rather than trying to be exhaustive.';
      case 'meticulous':
        return 'Provide an exhaustive, carefully organized response that aims to anticipate follow-up questions. Enumerate items as fully as possible (within the user’s constraints), and only collapse lists into counts when repetition would add no value. State assumptions explicitly, explore alternative interpretations, and address edge cases, counterexamples, and failure modes. Use precise terminology, include validation steps or checks when applicable, and end with a concise recap of key takeaways and any remaining uncertainties.';
      case 'normal':
      default:
        return 'Provide a clear, complete answer that covers the main points a typical user would expect. Include enough context to understand the reasoning, but avoid long digressions. Use short lists when they improve readability, and include a handful of examples when helpful. If the topic is complex, mention the most important tradeoffs or caveats without exploring every edge case.';
    }
  }

  async chat(query, options = {}) {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new Error('Query is required');
    }

    try {
      await this.initialize();
      
      const {
        notebookId = null,
        topK = 15,
        useMultiQuery = true,
        chatHistory = [],
        detailLevel = 'normal'
      } = options;
      
      // Get the last 20 messages from chat history for context
      const recentHistory = chatHistory.slice(-20);
      
      let retrievedDocs;
      
      if (useMultiQuery) {
        // Multi-Query: Generate query variations with chat context
        const queries = await this.generateQueryVariations(query, recentHistory);
        console.log('[Multi-Query]', queries);
        
        // Retrieve for each query variation
        const allDocs = [];
        const seenIds = new Set();
        
        for (const q of queries) {
          const docs = await this.retrievalEngine.retrieve(q, {
            notebookId,
            topK: topK * 2,
            useReranking: false
          });
          
          // Deduplicate
          for (const doc of docs) {
            if (!seenIds.has(doc.id)) {
              seenIds.add(doc.id);
              allDocs.push(doc);
            }
          }
        }
        
        // Rerank combined results
        retrievedDocs = await this.retrievalEngine.rerankDocuments(query, allDocs, topK);
      } else {
        // HyDE: Generate hypothetical answer for better retrieval with chat context
        const hypotheticalAnswer = await this.generateHypotheticalAnswer(query, recentHistory);
        
        // Retrieve relevant context using hypothetical answer
        retrievedDocs = await this.retrievalEngine.retrieve(hypotheticalAnswer, {
          notebookId,
          topK
        });
      }
      
      // Build context from retrieved documents
      const context = retrievedDocs
        .map((doc, index) => `[Document ${index + 1}]\n${doc.content}`)
        .join('\n\n');
      
      // Format chat history for the final prompt
      const chatHistoryText = recentHistory.length > 0
        ? recentHistory.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n\n')
        : '';
      
      console.log(`[Chat History] Including ${recentHistory.length} previous messages in all stages`);
      
      // Get detail level instruction
      const detailInstruction = this.getDetailLevelPrompt(detailLevel);
      
      // Create prompt template with chat history and detail level
      const promptTemplate = PromptTemplate.fromTemplate(`
You are a helpful assistant that answers questions based on the following context from the user's knowledge base.

Context:
{context}

{chatHistory}

Question: {question}

Response detail level: {detailLevel}

IMPORTANT: Provide your answer in PLAIN TEXT ONLY. Do NOT use any formatting such as:
- Markdown (no **, *, #, [], (), \`, etc.)
- HTML tags (no <b>, <i>, <p>, etc.)
- XML or other markup languages
- Bullet points or numbered lists with special characters
- Code blocks or inline code formatting

Simply write your answer as natural, unformatted text. If the context doesn't contain enough information to answer the question, say so.
`);
      
      const prompt = await promptTemplate.format({
        context: context || 'No relevant context found.',
        chatHistory: chatHistoryText ? `Previous conversation:\n${chatHistoryText}\n` : '',
        question: query.trim(),
        detailLevel: detailInstruction
      });

      console.log('[Prompt]', prompt); 
      
      const message = new HumanMessage(prompt);
      const response = await this.llm.invoke([message]);
      return response.content;
    } catch (error) {
      if (error.message.includes('API key')) {
        throw new Error('LLM API key not configured. Please set it in config/default.json');
      }
      throw new Error(`Failed to process chat query: ${error.message}`);
    }
  }
}
