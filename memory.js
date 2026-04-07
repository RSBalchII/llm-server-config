#!/usr/bin/env node

/**
 * Hybrid Memory Management Layer
 * - Short-term: In-memory sliding window (10 turns)
 * - Medium-term: Markdown logs in Coding-Notes
 * - Long-term: AEN persistent storage (batch submitted)
 */

import AENClient from './aen-client.js';
import MarkdownMemory from './markdown-memory.js';

class MemoryManager {
  constructor(options = {}) {
    this.aen = new AENClient(options.aen);
    this.markdown = new MarkdownMemory(options.markdown);
    this.sessionId = `session-${Date.now()}`;
    this.projectId = options.projectId || null;
    this.shortTermMemory = [];
    this.maxShortTerm = options.maxShortTerm || 10;
  }

  /**
   * Initialize connections
   */
  async initialize() {
    const aenHealth = await this.aen.health();
    const markdownReady = this.markdown.ensureDirectories();
    
    if (aenHealth.ok) {
      console.log('✅ AEN Memory connected');
    } else {
      console.log('⚠️  AEN Memory offline (using markdown only)');
    }
    
    console.log(`📝 Markdown logs: ${this.markdown.currentSession}`);
    return aenHealth.ok || markdownReady;
  }

  /**
   * Store conversation turn (hybrid approach)
   */
  async storeTurn(input, output) {
    // Add to short-term memory
    this.shortTermMemory.push({
      input,
      output,
      timestamp: Date.now(),
    });

    // Trim if needed
    if (this.shortTermMemory.length > this.maxShortTerm) {
      this.shortTermMemory.shift();
    }

    // Write to markdown (immediate, local)
    this.markdown.logTurn(input, output, {
      projectId: this.projectId,
    });

    // Store in AEN async (non-blocking, batched)
    if (this.aen.connected) {
      setImmediate(async () => {
        await this.aen.storeConversation(input, output, this.projectId);
      });
    }
  }

  /**
   * Get context for current task
   */
  async getContext(task) {
    const context = [];

    // Add short-term memory
    if (this.shortTermMemory.length > 0) {
      context.push('Recent conversation:');
      this.shortTermMemory.forEach((turn, i) => {
        context.push(`  ${i + 1}. User: ${turn.input}`);
        context.push(`     Agent: ${turn.output}`);
      });
    }

    // Add recent markdown logs
    const recentLogs = this.markdown.getRecentLogs(5);
    if (recentLogs.length > 0) {
      context.push('\nRecent logs (markdown):');
      recentLogs.forEach((log, i) => {
        context.push(`  ${i + 1}. ${log.input.substring(0, 50)}...`);
      });
    }

    // Add AEN memories
    if (this.aen.connected) {
      const memories = await this.aen.getContext(task);
      if (memories.length > 0) {
        context.push('\nRelevant memories (AEN):');
        memories.forEach((mem, i) => {
          context.push(`  ${i + 1}. [${mem.relevance.toFixed(2)}] ${mem.content}`);
        });
      }
    }

    return context.join('\n');
  }

  /**
   * Clear short-term memory
   */
  clear() {
    this.shortTermMemory = [];
    console.log('🗑️  Short-term memory cleared');
  }

  /**
   * Get memory stats
   */
  async stats() {
    const stats = {
      shortTerm: this.shortTermMemory.length,
      markdown: this.markdown.getStats(),
      aen: null,
    };

    if (this.aen.connected) {
      stats.aen = await this.aen.stats();
    }

    return stats;
  }

  /**
   * Manually trigger batch submit to AEN
   */
  async batchSubmit() {
    await this.markdown.triggerBatchSubmit();
  }

  /**
   * Rotate session (new day)
   */
  rotateSession() {
    return this.markdown.rotateSession();
  }
}

export default MemoryManager;
