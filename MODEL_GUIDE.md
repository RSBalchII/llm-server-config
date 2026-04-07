# Model Guide for micro-nanobot

## 🏆 Best Models for Terminal Agent (Pixel 8)

### Current Setup
**Qwen3.5 2B Distilled** (Jackrong)
- **Size:** 2B parameters
- **RAM:** ~1.5GB (Q4 quantized)
- **Best for:** Agent tasks, coding, multi-turn conversations
- **Why:** Distilled from Claude 4.6 Opus for reasoning

### Recommended Upgrades

#### 1. Qwen3.5 4B Distilled (Best Balance)
- **Size:** 4B parameters
- **RAM:** ~3GB
- **Improvement:** Better reasoning, more accurate code
- **Download:** `./download-model.sh` → Option 2

#### 2. Qwen3.5 4B Abliterated (Unrestricted)
- **Size:** 4B parameters  
- **RAM:** ~3GB
- **Improvement:** No safety filters, raw performance
- **Use case:** Unrestricted agent work
- **⚠️ Warning:** No content moderation
- **Download:** `./download-model.sh` → Option 3

#### 3. Qwen3.5 0.8B Abliterated (Ultra-Light)
- **Size:** 0.8B parameters
- **RAM:** ~0.8GB
- **Best for:** Quick testing, voice + agent combo
- **Download:** `./download-model.sh` → Option 4

#### 4. LFM 2.5 350M (Fastest)
- **Size:** 350M parameters
- **RAM:** ~0.5GB
- **Best for:** Rapid prototyping, testing voice pipeline
- **Download:** `./download-model.sh` → Option 5

---

## 📥 How to Download & Switch Models

### Method 1: Interactive Downloader
```bash
cd ~/projects/micro-nanobot
./download-model.sh
```

### Method 2: Start with Model Selection
```bash
cd ~/projects/micro-nanobot
./start-termux.sh
# Select model from menu
```

### Method 3: Manual Download
```bash
# Qwen3.5 4B Distilled
wget -O models/Qwen3.5-4B-Distilled-Q4_K_M.gguf \
  https://huggingface.co/JackRong/Qwen3.5-4B-Claude-4.6-Opus-Reasoning-Distilled-GGUF/resolve/main/Qwen3.5-4B-Claude-4.6-Opus-Reasoning-Distilled-Q4_K_M.gguf

# Qwen3.5 4B Abliterated
wget -O models/Qwen3.5-4B-Abliterated-Q4_K_M.gguf \
  https://huggingface.co/HUIHUI-AI/HUIHUI-QWEN3.5-4B-CLAUDE-4.6-OPUS-ABLITERATED-GGUF/resolve/main/Qwen3.5-4B-Opus-Abliterated-Q4_K_M.gguf
```

---

## 🧠 Understanding Model Types

### Distilled Models
**What:** Trained on outputs from larger models (Claude 4.6 Opus)

**Benefits:**
- Better reasoning than base models
- Trained on chain-of-thought
- Multi-turn conversation optimized
- Tool use patterns

**Best for:** Agent workflows, coding assistance

### Abliterated Models
**What:** Safety/resistance filters removed

**Benefits:**
- No content moderation
- Unrestricted outputs
- Faster decision-making

**⚠️ Warnings:**
- No guardrails
- May produce harmful content
- Use responsibly!

**Best for:** Unrestricted agent work, security research

---

## 📊 Model Comparison

| Model | Params | Q4 Size | RAM | Speed | Reasoning | Coding | Agent |
|-------|--------|---------|-----|-------|-----------|--------|-------|
| LFM 2.5 350M | 0.4B | 0.3GB | 0.5GB | ⚡⚡⚡ | ⭐ | ⭐ | ⭐ |
| Qwen3.5 0.8B Ablit | 0.8B | 0.6GB | 0.8GB | ⚡⚡ | ⭐⭐ | ⭐⭐ | ⭐⭐ |
| **Qwen3.5 2B Distill** | **2B** | **1.2GB** | **1.5GB** | **⚡⚡** | **⭐⭐⭐** | **⭐⭐⭐** | **⭐⭐⭐** |
| Qwen3.5 4B Distill | 4B | 2.5GB | 3GB | ⚡ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Qwen3.5 4B Ablit | 4B | 2.5GB | 3GB | ⚡ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

**Ratings:** ⭐ (Poor) → ⭐⭐⭐⭐⭐ (Excellent)

---

## 🎯 Recommendations by Use Case

### For Voice + Agent Combo
**Recommended:** Qwen3.5 2B Distilled or 0.8B Abliterated
- Voice adds ~250MB overhead
- Total RAM: ~1.75GB (2B) or ~1GB (0.8B)

### For Pure Coding/Agent Work
**Recommended:** Qwen3.5 4B Distilled
- Best reasoning/coding balance
- Still fits on Pixel 8 (8GB RAM)

### For Testing/Development
**Recommended:** LFM 2.5 350M
- 10x faster iteration
- Good for testing voice pipeline

### For Unrestricted Work
**Recommended:** Qwen3.5 4B Abliterated
- No safety filters
- Raw performance

---

## 📁 Model Storage

Models are stored in:
```
/data/data/com.termux/files/home/models/
├── Qwen3.5-2B-Distilled-Q4_K_M.gguf
├── Qwen3.5-4B-Distilled-Q4_K_M.gguf
├── Qwen3.5-4B-Abliterated-Q4_K_M.gguf
├── Qwen3.5-0.8B-Abliterated-Q4_K_M.gguf
└── LFM2.5-350M-Q4_K_M.gguf
```

**Tip:** Keep multiple models! Switch between them for different tasks.

---

## 🔧 Switching Models

### Temporary (One Session)
```bash
./start-termux.sh
# Select model from menu
```

### Permanent (Config)
Edit `config.json`:
```json
{
  "model": "qwen-3.5-4b-distilled"
}
```

Then restart llama-server with new model path.

---

## 📈 Performance Tips

1. **Use Q4_K_M quantization** - Best quality/size balance
2. **Keep 2B as default** - Good for most tasks
3. **Download 4B for complex work** - Better reasoning
4. **Use 350M for testing** - Fast iteration
5. **Monitor RAM** - Kill other apps if needed

---

## 🚀 Quick Start

```bash
# 1. Download models
./download-model.sh

# 2. Start with model selection
./start-termux.sh

# 3. Enjoy!
```

**Happy agenting!** 🤖
