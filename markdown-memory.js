#!/usr/bin/env node

/**
 * Markdown-based Local Memory System
 * Writes conversation logs to Coding-Notes/qwen-chats/projects/
 * Periodically batch-submits to AEN via normalize script
 */

import { writeFileSync, appendFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const CONFIG = {
  codingNotesPath: '/data/data/com.termux/files/home/projects/Coding-Notes',
  chatLogPath: '/data/data/com.termux/files/home/projects/Coding-Notes/qwen-chats/projects',
  batchSize: 20000,  // Lines before batch submit
  sessionPrefix: 'micro-nanobot',
};

class MarkdownMemory {
  constructor(options = {}) {
    this.config = { ...CONFIG, ...options };
    this.currentSession = this.createSessionPath();
    this.lineCount = 0;
    this.pendingLogs = [];
    
    // Ensure directories exist
    this.ensureDirectories();
  }

  /**
   * Create session file path with date
   */
  createSessionPath() {
    const date = new Date().toISOString().split('T')[0];
    const sessionName = `${this.config.sessionPrefix}-${date}.md`;
    return `${this.config.chatLogPath}/${sessionName}`;
  }

  /**
   * Ensure directories exist
   */
  ensureDirectories() {
    if (!existsSync(this.config.chatLogPath)) {
      mkdirSync(this.config.chatLogPath, { recursive: true });
    }
  }

  /**
   * Log conversation turn to markdown
   */
  logTurn(input, output, metadata = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = this.formatAsMarkdown(input, output, timestamp, metadata);
    
    // Append to session file
    appendFileSync(this.currentSession, logEntry);
    this.lineCount++;
    this.pendingLogs.push(logEntry);
    
    // Check if batch threshold reached
    if (this.pendingLogs.length >= this.config.batchSize) {
      this.triggerBatchSubmit();
    }
    
    return logEntry;
  }

  /**
   * Format as markdown (Qwen terminal format)
   */
  formatAsMarkdown(input, output, timestamp, metadata = {}) {
    return `
---
timestamp: ${timestamp}
source: micro-nanobot
project: ${metadata.projectId || 'general'}
---

## 👤 User
${input}

## 🤖 Agent
${output}

`;
  }

  /**
   * Trigger batch submission to AEN
   */
  async triggerBatchSubmit() {
    console.log(`📦 Batch threshold reached (${this.pendingLogs.length} logs), submitting to AEN...`);
    
    try {
      // Run normalize script
      const normalizeScript = `${this.config.codingNotesPath}/sessions/scripts/chat_normalize.js`;
      const tempFile = `${this.config.chatLogPath}/batch-${Date.now()}.md`;
      
      // Write batch to temp file
      writeFileSync(tempFile, this.pendingLogs.join('\n'));
      
      // Run normalize script
      await execAsync(`node ${normalizeScript} ${tempFile}`);
      
      console.log(`✅ Batch submitted successfully`);
      
      // Clear pending logs
      this.pendingLogs = [];
      this.lineCount = 0;
      
    } catch (error) {
      console.error(`❌ Batch submit failed: ${error.message}`);
      // Keep logs in pending for retry
    }
  }

  /**
   * Get recent logs from current session
   */
  getRecentLogs(limit = 10) {
    if (!existsSync(this.currentSession)) {
      return [];
    }
    
    const content = readFileSync(this.currentSession, 'utf-8');
    const entries = content.split('---').filter(e => e.trim());
    
    return entries.slice(-limit).map(entry => {
      const match = entry.match(/## 👤 User\n([\s\S]*?)\n## 🤖 Agent\n([\s\S]*?)(?=\n---|$)/);
      if (match) {
        return {
          input: match[1].trim(),
          output: match[2].trim(),
        };
      }
      return null;
    }).filter(Boolean);
  }

  /**
   * Get session stats
   */
  getStats() {
    const stats = {
      currentSession: this.currentSession,
      lineCount: this.lineCount,
      pendingLogs: this.pendingLogs.length,
      exists: existsSync(this.currentSession),
    };
    
    if (stats.exists) {
      const content = readFileSync(this.currentSession, 'utf-8');
      stats.totalTurns = (content.match(/## 👤 User/g) || []).length;
      stats.fileSize = `${(content.length / 1024).toFixed(2)} KB`;
    }
    
    return stats;
  }

  /**
   * Rotate session (new day or manual)
   */
  rotateSession() {
    const oldSession = this.currentSession;
    this.currentSession = this.createSessionPath();
    
    console.log(`📁 Rotated session: ${oldSession} → ${this.currentSession}`);
    
    // Auto-submit pending if any
    if (this.pendingLogs.length > 0) {
      this.triggerBatchSubmit();
    }
    
    return oldSession;
  }
}

export default MarkdownMemory;
