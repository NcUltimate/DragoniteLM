import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');

export class Storage {
  constructor(dataDir = DATA_DIR) {
    this.dataDir = dataDir;
    this.notebooksDir = path.join(dataDir, 'notebooks');
  }

  async ensureDirectories() {
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.mkdir(this.notebooksDir, { recursive: true });
  }

  async readJSON(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async writeJSON(filePath, data) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async listFiles(dirPath) {
    try {
      const files = await fs.readdir(dirPath);
      return files;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async deleteFile(filePath) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async deleteDirectory(dirPath) {
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  getNotebookPath(notebookId) {
    return path.join(this.notebooksDir, `${notebookId}.json`);
  }

  getNotebookFilesDir(notebookId) {
    return path.join(this.notebooksDir, notebookId, 'files');
  }
}
