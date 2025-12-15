import pdfParse from 'pdf-parse';
import fs from 'fs/promises';

export class DocumentProcessor {
  async processPDF(filePath) {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdfParse(dataBuffer);
      return {
        text: data.text,
        metadata: {
          pages: data.numpages,
          info: data.info
        }
      };
    } catch (error) {
      throw new Error(`Failed to process PDF: ${error.message}`);
    }
  }

  async processText(content) {
    return {
      text: content,
      metadata: {}
    };
  }

  async processURL(url) {
    // For now, just return the URL as text
    // In a full implementation, you'd fetch and parse the webpage
    return {
      text: `URL: ${url}`,
      metadata: { url }
    };
  }

  async processKnowledgeItem(knowledgeItem) {
    switch (knowledgeItem.type) {
      case 'pdf':
        return await this.processPDF(knowledgeItem.content);
      case 'note':
        return await this.processText(knowledgeItem.content);
      case 'url':
      case 'article':
        return await this.processURL(knowledgeItem.content);
      default:
        throw new Error(`Unsupported knowledge item type: ${knowledgeItem.type}`);
    }
  }
}
