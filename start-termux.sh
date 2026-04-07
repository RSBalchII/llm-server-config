#!/data/data/com.termux/files/usr/bin/bash
# Quick start for micro-nanobot on Termux with model selection

echo "🚀 micro-nanobot"
echo ""

# Check if llama.cpp build exists
if [ ! -f "llama.cpp/build/bin/llama-server" ]; then
  echo "❌ llama.cpp not built yet!"
  echo "   Run: ./install-termux.sh"
  exit 1
fi

# Check for available models
echo "📦 Available models:"
MODELS=()
MODEL_PATHS=()

# Detect models by pattern
for f in models/*Qwen*2B*.gguf models/*Qwen*4B*.gguf models/*LFM*.gguf models/*2B*.gguf models/*4B*.gguf; do
  if [ -f "$f" ]; then
    name=$(basename "$f" .gguf | sed 's/-Q4_K_M//g; s/-Q5_K_M//g; s/-Q6_K//g; s/-Q8_Q8//g')
    MODELS+=("$name")
    MODEL_PATHS+=("$f")
  fi
done

if [ ${#MODELS[@]} -eq 0 ]; then
  echo "   No models found!"
  echo ""
  echo "💡 Run ./download-model.sh to download a model"
  exit 1
fi

# Show menu
for i in "${!MODELS[@]}"; do
  echo "   $((i+1))) ${MODELS[$i]}"
done
echo "   d) Download new model"
echo "   0) Cancel"
echo ""
read -p "Select model: " choice

if [ "$choice" == "d" ] || [ "$choice" == "D" ]; then
  ./download-model.sh
  exit 0
fi

if [ "$choice" == "0" ]; then
  echo "❌ Cancelled"
  exit 0
fi

# Validate choice
if ! [[ "$choice" =~ ^[0-9]+$ ]] || [ "$choice" -lt 1 ] || [ "$choice" -gt "${#MODELS[@]}" ]; then
  echo "❌ Invalid choice"
  exit 1
fi

# Get selected model path
SELECTED_MODEL="${MODEL_PATHS[$((choice-1))]}"
SELECTED_NAME="${MODELS[$((choice-1))]}"

echo ""
echo "🤖 Starting llama.cpp server with: $SELECTED_NAME"
echo "   Model: $SELECTED_MODEL"
echo ""

# Start llama.cpp server in background
cd llama.cpp/build
./bin/llama-server -m "../../$SELECTED_MODEL" --port 8080 --ctx-size 4096 &
SERVER_PID=$!
cd ../..

# Wait for server to start
echo "⏳ Waiting for server to initialize..."
sleep 5

# Check if server is running
if ! kill -0 $SERVER_PID 2>/dev/null; then
  echo "❌ Server failed to start"
  exit 1
fi

echo "✅ Server running (PID: $SERVER_PID)"
echo ""
echo "🤖 Starting agent..."
echo ""

# Start agent and cleanup on exit
trap "kill $SERVER_PID 2>/dev/null; echo -e '\n👋 Stopped server'" EXIT
node agent.js
