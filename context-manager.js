#!/usr/bin/env node

/**
 * Context Manager - Hierarchical Context Chunking
 * 
 * Reduces LLM context from 32K to ~8K tokens while maintaining tool-calling ability
 * 
 * Architecture:
 * - Layer 1: Active Context (last 3 turns, full text) ~1.5K tokens
 * - Layer 2: Summarized Context (turns 4-10, compressed) ~2K tokens
 * - Layer 3: System Prompt (optimized) ~500 tokens
 * - Total: ~4K tokens base + current turn
 */

class ContextManager {
  constructor(options = {}) {
    this.fullContext = [];           // All turns (for reference)
    this.activeContext = [];         // Last N turns (full text)
    this.summarizedContext = [];     // Older turns (summarized)
    this.maxActive = options.maxActive || 3;
    this.maxSummarized = options.maxSummarized || 7;
    this.systemPrompt = this.createOptimizedSystemPrompt();
    this.tokenEstimate = 0;
  }

  /**
   * Create optimized system prompt (500 tokens vs 1000+)
   */
  createOptimizedSystemPrompt() {
    return `You are a terminal agent. Use EXACT formats:

RUN: <command>          # Execute shell command
READ: <filepath>        # Read file
WRITE: <filepath>       # Create/edit file
<content on next line>

Examples:
User: "list files" → RUN: ls -la
User: "show config" → RUN: cat package.json
User: "create test.txt with hello" → WRITE: test.txt
hello

Rules:
- Respond with ONLY the command format
- No explanations
- One action per turn`;
  }

  /**
   * Add conversation turn
   */
  async addTurn(input, output) {
    const turn = {
      input,
      output,
      timestamp: Date.now(),
      type: this.detectTurnType(input, output),
    };

    this.fullContext.push(turn);

    // Update active context (last N turns, full text)
    this.activeContext = this.fullContext.slice(-this.maxActive);

    // Update summarized context (older turns)
    const olderTurns = this.fullContext.slice(
      -this.maxActive - this.maxSummarized,
      -this.maxActive
    );

    if (olderTurns.length > 0) {
      this.summarizedContext = await this.summarizeTurns(olderTurns);
    }

    // Estimate token count
    this.tokenEstimate = this.estimateTokens();

    return turn;
  }

  /**
   * Detect turn type for better summarization
   */
  detectTurnType(input, output) {
    const inputLower = input.toLowerCase();
    
    if (inputLower.includes('list') || inputLower.includes('ls')) {
      return 'file-listing';
    }
    if (inputLower.includes('read') || inputLower.includes('cat')) {
      return 'file-read';
    }
    if (inputLower.includes('create') || inputLower.includes('write')) {
      return 'file-write';
    }
    if (inputLower.includes('run') || inputLower.includes('exec')) {
      return 'command';
    }
    return 'conversation';
  }

  /**
   * Summarize older turns (compress to ~20% of original)
   */
  async summarizeTurns(turns) {
    // Simple summarization (can be enhanced with LLM later)
    return turns.map(turn => {
      const summary = {
        type: turn.type,
        inputSummary: this.truncate(turn.input, 50),
        outputSummary: this.truncate(turn.output, 100),
        success: !turn.output.includes('error') && !turn.output.includes('failed'),
      };

      // Special handling by type
      if (turn.type === 'file-listing') {
        summary.outputSummary = 'Listed directory contents';
      } else if (turn.type === 'file-read') {
        summary.outputSummary = 'Read file content';
      } else if (turn.type === 'file-write') {
        summary.outputSummary = 'Created/updated file';
      }

      return summary;
    });
  }

  /**
   * Truncate text with ellipsis
   */
  truncate(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  /**
   * Get context formatted for LLM
   */
  getContextForLLM(currentInput = null) {
    const parts = [];

    // Layer 1: System prompt
    parts.push(`### SYSTEM\n${this.systemPrompt}`);

    // Layer 2: Summarized context (older turns)
    if (this.summarizedContext.length > 0) {
      parts.push('\n### RECENT HISTORY (summarized)');
      this.summarizedContext.forEach((turn, i) => {
        parts.push(`${i + 1}. [${turn.type}] ${turn.inputSummary} → ${turn.outputSummary}`);
      });
    }

    // Layer 3: Active context (full turns)
    if (this.activeContext.length > 0) {
      parts.push('\n### CURRENT CONVERSATION');
      this.activeContext.forEach(turn => {
        parts.push(`\nUser: ${turn.input}\nAssistant: ${turn.output}`);
      });
    }

    // Layer 4: Current input
    if (currentInput) {
      parts.push(`\n### CURRENT REQUEST\nUser: ${currentInput}`);
    }

    const context = parts.join('\n');
    return context;
  }

  /**
   * Estimate token count (rough approximation)
   */
  estimateTokens() {
    const context = this.getContextForLLM();
    // Rough estimate: 1 token ≈ 4 characters (English)
    return Math.round(context.length / 4);
  }

  /**
   * Get context stats
   */
  getStats() {
    return {
      totalTurns: this.fullContext.length,
      activeTurns: this.activeContext.length,
      summarizedTurns: this.summarizedContext.length,
      estimatedTokens: this.tokenEstimate,
      systemPromptTokens: Math.round(this.systemPrompt.length / 4),
    };
  }

  /**
   * Clear context
   */
  clear() {
    this.fullContext = [];
    this.activeContext = [];
    this.summarizedContext = [];
    this.tokenEstimate = 0;
  }

  /**
   * Get turns by type (for retrieval)
   */
  getTurnsByType(type, limit = 5) {
    return this.fullContext
      .filter(turn => turn.type === type)
      .slice(-limit);
  }

  /**
   * Search context (simple text search)
   */
  searchContext(query, limit = 3) {
    const queryLower = query.toLowerCase();
    
    const matches = this.fullContext.filter(turn => 
      turn.input.toLowerCase().includes(queryLower) ||
      turn.output.toLowerCase().includes(queryLower)
    );

    return matches.slice(-limit);
  }
}

export default ContextManager;
