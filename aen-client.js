#!/usr/bin/env node

/**
 * AEN (Anchor Engine) Client
 * Interface for persistent memory storage and retrieval
 */

const DEFAULT_CONFIG = {
  baseUrl: 'http://127.0.0.1:3160',
  agentUrl: 'http://127.0.0.1:3161',
  apiKey: 'bolt-memory-secret',
};

class AENClient {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
    };
    this.connected = false;
  }

  /**
   * Check if AEN server is running
   */
  async health() {
    try {
      const response = await fetch(`${this.config.baseUrl}/health`, {
        headers: this.headers,
      });
      const data = await response.json();
      this.connected = response.ok;
      return { ok: response.ok, ...data };
    } catch (error) {
      this.connected = false;
      return { ok: false, error: error.message };
    }
  }

  /**
   * Store memory/conversation
   */
  async store(type, data, metadata = {}) {
    try {
      const response = await fetch(`${this.config.agentUrl}/v1/memory/store`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          type,
          data,
          metadata: {
            timestamp: new Date().toISOString(),
            ...metadata,
          },
        }),
      });
      return await response.json();
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Retrieve memories by query
   */
  async search(query, options = {}) {
    try {
      const response = await fetch(`${this.config.agentUrl}/v1/memory/search`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          query,
          limit: options.limit || 5,
          ...options,
        }),
      });
      return await response.json();
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Get context for current task
   */
  async getContext(task, projectId = null) {
    const memories = await this.search(task, { limit: 10 });
    
    if (memories.results) {
      return memories.results.map(m => ({
        id: m.id,
        content: m.content,
        relevance: m.score,
        timestamp: m.metadata?.timestamp,
      }));
    }
    
    return [];
  }

  /**
   * Store conversation turn
   */
  async storeConversation(input, output, projectId = null) {
    return await this.store('conversation', {
      input,
      output,
      projectId,
    }, {
      source: 'micro-nanobot',
    });
  }

  /**
   * Distill conversation into summary
   */
  async distill(conversationId) {
    try {
      const response = await fetch(`${this.config.agentUrl}/v1/memory/distill`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          conversationId,
        }),
      });
      return await response.json();
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Get stats
   */
  async stats() {
    try {
      const response = await fetch(`${this.config.agentUrl}/v1/stats`, {
        headers: this.headers,
      });
      return await response.json();
    } catch (error) {
      return { error: error.message };
    }
  }
}

export default AENClient;
