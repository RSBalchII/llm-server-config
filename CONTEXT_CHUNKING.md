# Context Chunking Optimization

## Problem
- Qwen3.5 2B trained with 262K context
- Tool-calling needs substantial context
- But 32K context = ~2GB RAM for KV cache
- Pixel 8 has 8GB total, competing with Android

## Solution: Hierarchical Context Chunking

### Architecture

```
┌─────────────────────────────────────────┐
│ Layer 1: Active Context (3 turns)       │
│ - Full text                             │
│ - ~1.5K tokens                          │
└─────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────┐
│ Layer 2: Summarized Context (7 turns)   │
│ - Compressed to ~20%                    │
│ - ~2K tokens                            │
└─────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────┐
│ Layer 3: System Prompt (Optimized)      │
│ - Tool formats only                     │
│ - ~500 tokens                           │
└─────────────────────────────────────────┘

Total: ~4K tokens (vs 32K full context)
```

---

## Implementation

### Files Changed

**1. `context-manager.js` (NEW)**
- Manages 3-layer context hierarchy
- Automatic summarization of older turns
- Turn type detection (file-listing, command, etc.)
- Token estimation

**2. `agent.js` (UPDATED)**
- Uses context manager instead of raw messages array
- Optimized system prompt (500 tokens)
- `/context` command shows token stats
- `callLLM()` now uses chunked context

**3. `start.sh` (UPDATED)**
```bash
--ctx-size 8192      # Down from 32768
--n-threads 6        # Use 6 of 9 cores
--batch-size 512     # Reduced batch
--flash-attn         # Enable attention optimization
```

**4. `.qwen/settings.json` (UPDATED)**
```json
"contextWindowSize": 8192,  # Down from 262144
"max_tokens": 512,          # Down from 8192
"timeout": 600000           # 10 min for local model
```

---

## Expected Results

### RAM Usage

| Component | Before (32K) | After (8K chunked) | Savings |
|-----------|--------------|-------------------|---------|
| **llama.cpp KV cache** | ~2GB | ~500MB | -75% |
| **Context in RAM** | ~100MB | ~25MB | -75% |
| **Total LLM RAM** | ~2.5GB | ~750MB | -70% |

### Tool-Calling Performance

| Metric | Full 32K | Chunked 8K | Expected |
|--------|----------|------------|----------|
| **Tool Success Rate** | 95% | 90-95% | ✅ Acceptable |
| **Response Time** | 5-8s | 2-4s | ✅ Faster |
| **Context Quality** | Full history | Summarized old | ✅ Good enough |
| **Stability** | May crash | Stable | ✅ Better |

---

## How It Works

### Example Conversation

**Turn 1-10:**
```
User: list files
Assistant: RUN: ls -la
...
User: create test.txt
Assistant: WRITE: test.txt
hello
```

**Context Manager Output to LLM:**

```markdown
### SYSTEM
You are a terminal agent. Use EXACT formats:
RUN: <command> | READ: <file> | WRITE: <file>

### RECENT HISTORY (summarized)
1. [file-listing] list files → Listed directory contents
2. [file-read] show package.json → Read file content
3. [file-write] create test.txt → Created/updated file
4. [command] run npm install → Executed command
5. [conversation] what is node → Explained Node.js
6. [file-listing] show dirs → Listed directories
7. [file-write] make config.json → Created file

### CURRENT CONVERSATION
User: list files in projects
Assistant: RUN: ls -la projects/

User: read the README
Assistant: RUN: cat projects/README.md

User: what's in src/
Assistant: RUN: ls -la src/
```

**Total:** ~4K tokens instead of 32K+

---

## Testing

### Test 1: Basic Tool-Calling
```bash
cd micro-nanobot
./start.sh

# Test commands:
list files
show package.json
create test.txt with hello world
what is 2+2
```

**Expected:** Tool formats work correctly

### Test 2: Long Conversation
```bash
# Have 10+ turn conversation
# Then check context stats:
/context

# Expected output:
📊 Context Stats:
   Total turns: 15
   Active (full): 3 turns
   Summarized: 7 turns
   Estimated tokens: 4200
```

### Test 3: RAM Monitoring
```bash
# Before starting:
free -h

# Start agent, have conversation

# Check RAM:
free -h
# Should stay under 6GB total used
```

### Test 4: Qwen Code Integration
```bash
# In Qwen Code:
/model
# Select: [Local] Qwen3.5 2B

# Test simple commands:
list files
what is the current directory
```

---

## Fallback Plan

If tool-calling breaks:

### Option 1: Increase Active Context
```javascript
const contextManager = new ContextManager({
  maxActive: 5,      // Up from 3
  maxSummarized: 10, // Up from 7
});
```

### Option 2: Include Tool Examples in System Prompt
```markdown
### SYSTEM
You are a terminal agent.

Examples:
User: "list files" → RUN: ls -la
User: "show X" → RUN: cat X
User: "create Y with Z" → WRITE: Y\nZ

Recent context:
{summarized_turns}

Current: {current_input}
```

### Option 3: Hybrid Approach
- Use full context for first 3 turns
- Then switch to chunked
- Balances tool-calling accuracy with RAM

---

## Monitoring

### Commands

**Check Context:**
```
/context
```

**Check Memory:**
```
/memory
```

**Check RAM:**
```bash
free -h
```

**Check llama.cpp:**
```bash
ps aux | grep llama-server
# Should show ~500MB-1GB RAM
```

---

## Success Criteria

✅ **Pass if:**
- Tool-calling works (RUN:, READ:, WRITE: formats)
- RAM usage < 6GB total
- No crashes after 20+ turns
- Response time < 5s

❌ **Fail if:**
- Tool formats break
- RAM > 7GB
- Frequent crashes
- Response time > 10s

---

## Next Steps

1. **Test basic functionality**
2. **Monitor RAM over 20+ turn conversation**
3. **Adjust summarization if needed**
4. **If tool-calling breaks, increase active turns**

---

**Status:** ✅ Ready to test
**Files:** `context-manager.js`, `agent.js`, `start.sh`, `.qwen/settings.json`
