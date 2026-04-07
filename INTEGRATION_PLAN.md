# Qwen Code + micro-nanobot + AEN Integration Plan

## ✅ What's Configured

### Qwen Code Local Model
**Status:** ✅ Configured in `.qwen/settings.json`

```json
{
  "id": "qwen3.5-local",
  "name": "[Local] Qwen3.5 2B (llama.cpp)",
  "baseUrl": "http://127.0.0.1:8080/v1"
}
```

**Usage:**
1. Start llama.cpp server: `./start.sh`
2. Qwen Code will automatically use local model
3. Switch back to cloud: Change model in Qwen Code UI

---

## 🎯 Architecture Vision

```
┌─────────────────────────────────────────────────────────┐
│                    YOU (User)                            │
└───────────────────┬─────────────────────────────────────┘
                    │
        ┌───────────┴────────────┐
        │                        │
        ▼                        ▼
┌───────────────────┐   ┌────────────────────┐
│   Qwen Code       │   │  micro-nanobot     │
│   (Primary IDE)   │   │  (Orchestrator)    │
│                   │   │                    │
│ - Code editing    │   │ - Task orchestration│
│ - Cloud LLM       │   │ - Local execution  │
│ - Full features   │   │ - Research agent   │
└─────────┬─────────┘   └─────────┬──────────┘
          │                       │
          │           ┌───────────┴───────────┐
          │           │                       │
          │           ▼                       ▼
          │   ┌──────────────┐   ┌──────────────┐
          │   │  AEN Engine  │   │  llama.cpp   │
          │   │  (Memory)    │   │  (2B Model)  │
          │   └──────────────┘   └──────────────┘
          │
          ▼
┌─────────────────────────────────┐
│  Cloud LLM (Qwen3.5-Coder)      │
│  - Heavy reasoning               │
│  - Complex coding tasks          │
└─────────────────────────────────┘
```

---

## 📋 Use Cases

### Qwen Code (Primary)
- ✅ Daily coding work
- ✅ Full IDE integration
- ✅ Cloud models for complex tasks
- ✅ All features working

### micro-nanobot (Orchestrator)
- ✅ Automated research tasks
- ✅ Long-running agent workflows
- ✅ Local execution (privacy)
- ✅ Task delegation to AEN

### AEN Engine (Memory)
- ✅ Long-term memory storage
- ✅ Context persistence
- ✅ Knowledge retrieval

---

## 🔧 Integration Steps

### Phase 1: Test Local Model (NOW)
```bash
# Terminal 1: Start llama.cpp server
cd ~/projects/micro-nanobot
./start.sh
# Select Qwen3.5 2B

# Terminal 2: Use Qwen Code
# It will automatically use local model
# Type: @qwen3.5-local to select
```

**Test Commands:**
```
/list files in current directory
/show me the project structure
```

### Phase 2: AEN Memory Integration
**Goal:** Connect micro-nanobot to AEN for long-term memory

**Steps:**
1. Check AEN API endpoint
2. Add AEN client to micro-nanobot
3. Store conversation history in AEN
4. Retrieve context from AEN brain

**Files to Create:**
- `micro-nanobot/aen-client.js` - AEN API wrapper
- `micro-nanobot/memory.js` - Memory management

### Phase 3: Task Orchestration
**Goal:** micro-nanobot orchestrates between Qwen Code and local execution

**Workflow:**
```
User: "Research quantum computing and summarize"
   ↓
micro-nanobot:
   1. Break into tasks
   2. Query AEN for existing knowledge
   3. Use local LLM for simple research
   4. Delegate complex reasoning to Qwen Code API
   5. Store results in AEN
   6. Present summary to user
```

---

## 📁 Bolt Repository Integration

**Option A: Merge micro-nanobot into Bolt**
```
bolt/
├── agent/
│   ├── micro-nanobot/    ← Move here
│   └── other-agents/
└── ...
```

**Option B: Keep Separate, Share Code**
```
micro-nanobot/  ← Core agent
bolt/           ← Uses micro-nanobot as library
```

**Recommendation:** Start with Option B, merge later if needed.

---

## 🚀 Quick Start Commands

### Start Local Setup
```bash
cd ~/projects/micro-nanobot
./start.sh
# Select Qwen3.5 2B
```

### Test Qwen Code with Local
```bash
# In Qwen Code:
/model qwen3.5-local
/list files
```

### Switch Back to Cloud
```bash
# In Qwen Code settings:
/model qwen3.5-coder-plus
```

---

## 📊 Model Comparison

| Model | Location | RAM | Speed | Best For |
|-------|----------|-----|-------|----------|
| Qwen3.5 2B | Local | 1.5GB | Fast | Simple tasks |
| Qwen3.5-Coder | Cloud | 0 | Medium | Complex coding |
| Qwen3.5-Plus | Cloud | 0 | Slow | Heavy reasoning |

---

## 🎯 Next Actions

1. **Test local model in Qwen Code** (you can do this now!)
2. **Explore AEN API** - Check what endpoints are available
3. **Decide on Bolt merge** - Keep separate or integrate?
4. **Build AEN client** - Once API is understood

---

**Current Status:** ✅ Qwen Code configured for local model
**Ready to test!** Start the server and use Qwen Code as normal.
