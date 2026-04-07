#!/bin/bash
# Setup script for micro-nanobot
# This installs llama.cpp and downloads a recommended model

set -e

echo "🚀 micro-nanobot setup"
echo ""

# Check if llama.cpp exists
if [ ! -d "llama.cpp" ]; then
  echo "📦 Cloning llama.cpp..."
  git clone https://github.com/ggerganov/llama.cpp
else
  echo "✅ llama.cpp already exists"
fi

# Build llama.cpp
echo "🔨 Building llama.cpp..."
cd llama.cpp
make -j4
cd ..

# Download model
echo ""
echo "📥 Model download options:"
echo "  1) Phi-3 mini (3.8B, ~2GB) - RECOMMENDED"
echo "  2) TinyLlama (1.1B, ~600MB) - For testing"
echo "  3) Skip download"
echo ""
read -p "Choose model (1-3): " model_choice

case $model_choice in
  1)
    echo "📥 Downloading Phi-3 mini..."
    mkdir -p llama.cpp/models
    wget -O llama.cpp/models/phi-3.Q4_K_M.gguf \
      "https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf"
    MODEL_NAME="phi-3"
    ;;
  2)
    echo "📥 Downloading TinyLlama..."
    mkdir -p llama.cpp/models
    wget -O llama.cpp/models/tinyllama.Q4_K_M.gguf \
      "https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf"
    MODEL_NAME="tinyllama"
    ;;
  3)
    echo "⏭️  Skipping model download"
    MODEL_NAME=""
    ;;
  *)
    echo "❌ Invalid choice"
    exit 1
    ;;
esac

# Create config
echo ""
echo "📋 Creating config.json..."
cat > config.json << EOF
{
  "llmUrl": "http://127.0.0.1:8080",
  "model": "${MODEL_NAME:-phi-3}",
  "maxContext": 10,
  "systemPrompt": "You are a helpful AI assistant with access to a terminal.\nYou can execute bash commands and read/write files.\n\nTo execute a command, respond with: I'll run: <command>\nTo read a file: I'll read: <filepath>\nTo write a file: I'll write: <filepath>\n<content>\n\nBe concise. Execute one step at a time."
}
EOF

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Start llama.cpp server:"
if [ -n "$MODEL_NAME" ]; then
  echo "     cd llama.cpp && ./server -m models/${MODEL_NAME}.Q4_K_M.gguf --port 8080"
else
  echo "     cd llama.cpp && ./server -m models/YOUR_MODEL.gguf --port 8080"
fi
echo ""
echo "  2. In another terminal, start the agent:"
echo "     ./start.sh"
echo ""
