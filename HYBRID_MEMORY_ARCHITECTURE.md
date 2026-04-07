# Hybrid Memory Architecture

## Overview

Three-tier memory system for efficient, scalable conversation persistence:

```
┌─────────────────────────────────────────────────────┐
│              micro-nanobot Agent                    │
└─────────────────────────────────────────────────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
        ▼           ▼           ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Short-term  │ │ Medium-term  │ │  Long-term   │
│  (RAM)       │ │ (Markdown)   │ │  (AEN)       │
│              │ │              │ │              │
│ 10 turns     │ │ Daily logs   │ │ Batch submit │
│ Sliding      │ │ Coding-Notes │ │ Normalize    │
│ window       │ │ 20k lines    │ │ Distill      │
└──────────────┘ └──────────────┘ └──────────────┘
     Fast         Persistent       Searchable
     Immediate    Local            Centralized
```

---

## Tier 1: Short-term Memory (RAM)

**File:** `memory.js`
**Storage:** In-memory array
**Capacity:** 10 turns (sliding window)
**Access:** Instant

**Purpose:**
- Immediate context for conversation
- Recent turn recall
- Fast retrieval

**Example:**
```javascript
await memoryManager.storeTurn('list files', 'total 24');
const context = await memoryManager.getContext('files');
// Returns last 10 turns
```

---

## Tier 2: Medium-term Memory (Markdown)

**File:** `markdown-memory.js`
**Storage:** `/Coding-Notes/qwen-chats/projects/`
**Format:** Markdown with YAML frontmatter
**Batch Size:** 20,000 lines before submit

**Purpose:**
- Local persistence (no AEN dependency)
- Human-readable logs
- Works offline
- Easy to backup/sync

**File Structure:**
```markdown
---
timestamp: 2026-04-06T13:30:00.000Z
source: micro-nanobot
project: general
---

## 👤 User
list files

## 🤖 Agent
total 24
drwx------.  3 user
...

```

**Location:**
```
/Coding-Notes/qwen-chats/projects/
├── micro-nanobot-2026-04-06.md
├── micro-nanobot-2026-04-07.md
└── batch-1234567890.md  (pending AEN submit)
```

---

## Tier 3: Long-term Memory (AEN)

**File:** `aen-client.js`
**Storage:** Anchor Engine graph database
**Submit:** Batch (20k lines via normalize script)
**Processing:** `chat_normalize.js`

**Purpose:**
- Centralized knowledge base
- Semantic search
- Cross-session context
- Distillation into insights

**Batch Submit Flow:**
```
1. Threshold reached (20k lines)
   ↓
2. Write batch to temp file
   ↓
3. Run chat_normalize.js
   ↓
4. Normalize format
   ↓
5. Submit to AEN /v1/memory/store
   ↓
6. Clear pending logs
```

---

## Usage

### Initialize
```javascript
const memoryManager = new MemoryManager({
  aen: {
    baseUrl: 'http://127.0.0.1:3160',
    agentUrl: 'http://127.0.0.1:3161',
  },
  markdown: {
    codingNotesPath: '/path/to/Coding-Notes',
    batchSize: 20000,
  },
  maxShortTerm: 10,
});

await memoryManager.initialize();
```

### Store Turn
```javascript
// Automatic in agent.js
await memoryManager.storeTurn(input, output);
```

### Get Context
```javascript
const context = await memoryManager.getContext('current task');
// Returns: short-term + recent markdown + AEN memories
```

### Check Stats
```
/memory
🧠 Memory Stats:
   Short-term: 5 turns
   Markdown:
     - currentSession: micro-nanobot-2026-04-06.md
     - totalTurns: 47
     - fileSize: 12.5 KB
   AEN: { ... }
```

### Manual Batch Submit
```
/batch-submit
📦 Submitting 15,000 logs to AEN...
✅ Batch submitted successfully
```

---

## Benefits

### vs Direct AEN Writes

| Aspect | Direct Writes | Hybrid System |
|--------|--------------|---------------|
| **Latency** | Every turn blocks | Instant (async) |
| **AEN Load** | High (constant) | Low (batched) |
| **Offline** | Broken | Works fine |
| **Backup** | Manual | Auto (markdown files) |
| **Human Readable** | No | Yes |

### Resource Usage

**RAM:**
- Short-term: ~10KB (negligible)
- Markdown writer: ~5MB buffer
- AEN client: ~2MB

**Disk:**
- Markdown logs: ~100KB/hour of conversation
- AEN database: Compressed, indexed

**CPU:**
- Markdown write: <1ms per turn
- Batch normalize: ~2s per 20k lines (infrequent)

---

## Configuration

### Adjust Batch Size
```javascript
markdown: {
  batchSize: 10000,  // Submit every 10k lines
}
```

### Change Log Location
```javascript
markdown: {
  chatLogPath: '/custom/path/to/logs',
}
```

### Disable AEN (Offline Mode)
```javascript
// Automatically detected
// Falls back to markdown-only if AEN offline
```

---

## Session Rotation

**Automatic:** New file each day
```
micro-nanobot-2026-04-06.md
micro-nanobot-2026-04-07.md
```

**Manual:**
```javascript
memoryManager.rotateSession();
// Creates new dated file
// Auto-submits pending batch
```

---

## Error Handling

### AEN Offline
```
⚠️  AEN Memory offline (using markdown only)
📝 Markdown logs: /path/to/micro-nanobot-2026-04-06.md
```
- Continues with markdown + short-term
- Queues AEN submissions
- Retries on next connection

### Batch Submit Fails
```
❌ Batch submit failed: Network error
// Logs kept in pending array
// Retries on next threshold
```

### Disk Full
```
❌ Cannot write markdown log: ENOSPC
// Falls back to short-term only
// Warns user to free space
```

---

## Testing

```bash
# Test hybrid memory
cd micro-nanobot
node -e "
import('./memory.js').then(async ({ default: MemoryManager }) => {
  const mem = new MemoryManager();
  await mem.initialize();
  
  await mem.storeTurn('test', 'response');
  const stats = await mem.stats();
  console.log(stats);
});
"
```

---

## Future Enhancements

1. **Compression:** Gzip old markdown logs (>7 days)
2. **Auto-prune:** Delete markdown after successful AEN submit
3. **Sync:** Push markdown to cloud backup (optional)
4. **Analytics:** Track conversation patterns
5. **Smart Batching:** Time-based (hourly) + size-based

---

**Architecture:** Hybrid Memory System
**Status:** ✅ Implemented
**Files:** `memory.js`, `markdown-memory.js`, `aen-client.js`
