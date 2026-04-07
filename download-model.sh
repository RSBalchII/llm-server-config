#!/data/data/com.termux/files/usr/bin/bash
# Model downloader for micro-nanobot

set -e

MODELS_DIR="/data/data/com.termux/files/home/models"
mkdir -p "$MODELS_DIR"

echo "🤖 micro-nanobot Model Manager"
echo ""
echo "Available Models:"
echo ""
echo "  QWEN3.5 (Best for Agents)"
echo "    1) Qwen3.5 2B Distilled - ~1.5GB RAM"
echo "    2) Qwen3.5 4B Distilled - ~3GB RAM"
echo "    3) Qwen3.5 4B Abliterated - ~3GB RAM (Unrestricted)"
echo "    4) Qwen3.5 0.8B Abliterated - ~0.8GB RAM"
echo ""
echo "  GEMMA 4 (New! Google)"
echo "    5) Gemma 4 E2B (5B) - ~4GB RAM"
echo "    6) Gemma 4 E4B (8B) - ~6GB RAM"
echo ""
echo "  OTHER"
echo "    7) LFM 2.5 350M - ~0.5GB RAM (Fastest)"
echo ""
echo "  0) Cancel"
echo ""
read -p "Choose model (1-7): " choice

case $choice in
  1)
    echo ""; echo "📥 Downloading Qwen3.5 2B Distilled..."
    wget -O "$MODELS_DIR/Qwen3.5-2B-Distilled-Q4_K_M.gguf" \
      "https://huggingface.co/JackRong/Qwen3.5-2B-Claude-4.6-Opus-Reasoning-Distilled-GGUF/resolve/main/Qwen3.5-2B-Claude-4.6-Opus-Reasoning-Distilled-Q4_K_M.gguf"
    ;;
  2)
    echo ""; echo "📥 Downloading Qwen3.5 4B Distilled..."
    wget -O "$MODELS_DIR/Qwen3.5-4B-Distilled-Q4_K_M.gguf" \
      "https://huggingface.co/JackRong/Qwen3.5-4B-Claude-4.6-Opus-Reasoning-Distilled-GGUF/resolve/main/Qwen3.5-4B-Claude-4.6-Opus-Reasoning-Distilled-Q4_K_M.gguf"
    ;;
  3)
    echo ""; echo "📥 Downloading Qwen3.5 4B Abliterated..."
    wget -O "$MODELS_DIR/Qwen3.5-4B-Abliterated-Q4_K_M.gguf" \
      "https://huggingface.co/HUIHUI-AI/HUIHUI-QWEN3.5-4B-CLAUDE-4.6-OPUS-ABLITERATED-GGUF/resolve/main/Qwen3.5-4B-Opus-Abliterated-Q4_K_M.gguf"
    echo "   ⚠️  ABLITERATED = No safety filters"
    ;;
  4)
    echo ""; echo "📥 Downloading Qwen3.5 0.8B Abliterated..."
    wget -O "$MODELS_DIR/Qwen3.5-0.8B-Abliterated-Q4_K_M.gguf" \
      "https://huggingface.co/HUIHUI-AI/HUIHUI-QWEN3.5-0.8B-ABLITERATED-GGUF/resolve/main/Qwen3.5-0.8B-Abliterated-Q4_K_M.gguf"
    ;;
  5)
    echo ""; echo "📥 Downloading Gemma 4 E2B (5B)..."
    wget -O "$MODELS_DIR/Gemma-4-E2B-IT-Q4_K_M.gguf" \
      "https://huggingface.co/unsloth/gemma-4-e2b-it-GGUF/resolve/main/gemma-4-e2b-it-Q4_K_M.gguf"
    ;;
  6)
    echo ""; echo "📥 Downloading Gemma 4 E4B (8B)..."
    wget -O "$MODELS_DIR/Gemma-4-E4B-IT-Q4_K_M.gguf" \
      "https://huggingface.co/unsloth/gemma-4-e4b-it-GGUF/resolve/main/gemma-4-e4b-it-Q4_K_M.gguf"
    ;;
  7)
    echo ""; echo "📥 Downloading LFM 2.5 350M..."
    wget -O "$MODELS_DIR/LFM2.5-350M-Q4_K_M.gguf" \
      "https://huggingface.co/LIQUIDAI/LFM2.5-350M-GGUF/resolve/main/LFM2.5-350M-Q4_K_M.gguf"
    ;;
  0)
    echo "❌ Cancelled"
    exit 0
    ;;
  *)
    echo "❌ Invalid choice"
    exit 1
    ;;
esac

echo ""
echo "✅ Model downloaded!"
echo ""
echo "Current models:"
ls -lh "$MODELS_DIR"/*.gguf 2>/dev/null || echo "  No models found"
echo ""
echo "To start: ./start.sh"
