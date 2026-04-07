# micro-nanobot - Consolidated Start Scripts

## What Changed

**Before:** Multiple start scripts (`start.sh`, `start-termux.sh`, `run-termux.sh`)

**After:** Single unified `start.sh` with model selection

---

## Usage

### Start with Model Selection
```bash
./start.sh
```

This will:
1. Scan `models/` directory for GGUF files
2. Show interactive menu with model info
3. Start llama.cpp server with selected model
4. Launch agent

### Download New Models
```bash
./download-model.sh
```

**Available Models:**
- Qwen3.5 2B/4B Distilled (Best for agents)
- Qwen3.5 4B Abliterated (Unrestricted)
- Qwen3.5 0.8B Abliterated (Ultra-light)
- **Gemma 4 E2B (5B)** - New! Google
- **Gemma 4 E4B (8B)** - New! Google
- LFM 2.5 350M (Fastest)

---

## Features

### Auto-Detection
- Scans `models/` directory automatically
- Shows model sizes
- Displays full paths

### Model Menu
```
🤖 micro-nanobot Model Manager

📦 Scanning for models...

Available models:

   1) Qwen3.5 2B
       Size: 1.2G
       Path: models/Qwen3.5-2B-Q4_K_M.gguf

   2) Gemma-4-E2B-IT
       Size: 3.8G
       Path: models/Gemma-4-E2B-IT-Q4_K_M.gguf

   d) Download new model
   0) Cancel
```

### Cleanup
- Auto-kills server on exit
- Preserves model files
- Clean shutdown

---

## File Structure

```
micro-nanobot/
├── start.sh              # ← Unified starter (USE THIS)
├── download-model.sh     # Model downloader
├── run-termux.sh         # Legacy (deprecated)
├── start-termux.sh       # Legacy (deprecated)
└── models/               # Model storage
    ├── Qwen3.5-2B-Q4_K_M.gguf
    ├── Gemma-4-E2B-IT-Q4_K_M.gguf
    └── ...
```

---

## Gemma 4 Models

**New from Google (Released Today!)**

| Model | Params | RAM | Quality |
|-------|--------|-----|---------|
| Gemma 4 E2B | 5B | ~4GB | ⭐⭐⭐⭐ |
| Gemma 4 E4B | 8B | ~6GB | ⭐⭐⭐⭐⭐ |

**Download:**
```bash
./download-model.sh
# Select 5 or 6
```

**Why Gemma 4?**
- Google's latest open model
- Better reasoning than Qwen3.5
- Improved coding capabilities
- Larger context window

**Trade-offs:**
- Larger RAM usage
- Slower than Qwen3.5 2B
- May need swap on Pixel 8

---

## Recommendations

### For Daily Use
**Qwen3.5 2B Distilled**
- Fast responses
- Low RAM (1.5GB)
- Good for agent tasks

### For Complex Tasks
**Gemma 4 E4B (8B)**
- Best reasoning
- Requires 6GB RAM
- Use when you need quality

### For Testing
**LFM 2.5 350M**
- Ultra-fast
- 500MB RAM
- Quick iterations

---

## Migration

**Old commands → New command:**
```bash
./start.sh              # Unified starter
./download-model.sh     # Same as before
```

**Deprecated:**
- `run-termux.sh` - Use `start.sh`
- `start-termux.sh` - Use `start.sh`

---

## Troubleshooting

### "No models found"
```bash
# Download a model first
./download-model.sh
```

### "Server failed to start"
```bash
# Check if port 8080 is in use
killall llama-server
./start.sh
```

### "Out of memory"
```bash
# Use smaller model
./download-model.sh
# Select LFM 2.5 350M or Qwen3.5 2B
```

---

**Happy agenting! 🤖**
