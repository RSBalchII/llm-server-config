#!/data/data/com.termux/files/usr/bin/bash
# Unified model manager and starter for micro-nanobot

set -e

MODELS_DIR="/data/data/com.termux/files/home/models"
LLAMA_SERVER="llama.cpp/build/bin/llama-server"

echo "🤖 micro-nanobot Model Manager"
echo ""

# Check if llama.cpp exists
if [ ! -f "$LLAMA_SERVER" ]; then
  echo "❌ llama.cpp not found!"
  echo "   Run: ./install-termux.sh"
  exit 1
fi

# Scan for GGUF models
echo "📦 Scanning for models..."
echo ""

declare -a MODEL_FILES=()
declare -a MODEL_NAMES=()

# Find all GGUF files
while IFS= read -r -d '' file; do
  if [ -f "$file" ]; then
    # Extract clean name
    name=$(basename "$file" .gguf | sed 's/-Q4_K_M//g; s/-Q5_K_M//g; s/-Q6_K//g; s/-Q8_0//g; s/-I1//g' | tr '-' ' ')
    MODEL_FILES+=("$file")
    MODEL_NAMES+=("$name")
  fi
done < <(find "$MODELS_DIR" -maxdepth 1 -name "*.gguf" -print0 2>/dev/null)

# Check if any models found
if [ ${#MODEL_FILES[@]} -eq 0 ]; then
  echo "   No models found in $MODELS_DIR"
  echo ""
  echo "💡 Options:"
  echo "   1) Run ./download-model.sh to download a model"
  echo "   2) Place GGUF files in $MODELS_DIR"
  exit 1
fi

# Show menu
echo "Available models:"
echo ""
for i in "${!MODEL_FILES[@]}"; do
  size=$(ls -lh "${MODEL_FILES[$i]}" | awk '{print $5}')
  echo "   $((i+1))) ${MODEL_NAMES[$i]}"
  echo "       Size: $size"
  echo "       Path: ${MODEL_FILES[$i]}"
  echo ""
done

echo "   d) Download new model"
echo "   0) Cancel"
echo ""
read -p "Select model (number): " choice

# Handle choices
if [ "$choice" == "d" ] || [ "$choice" == "D" ]; then
  ./download-model.sh
  exit 0
fi

if [ "$choice" == "0" ]; then
  echo "❌ Cancelled"
  exit 0
fi

# Validate choice
if ! [[ "$choice" =~ ^[0-9]+$ ]] || [ "$choice" -lt 1 ] || [ "$choice" -gt "${#MODEL_FILES[@]}" ]; then
  echo "❌ Invalid choice"
  exit 1
fi

# Get selected model
SELECTED_MODEL="${MODEL_FILES[$((choice-1))]}"
SELECTED_NAME="${MODEL_NAMES[$((choice-1))]}"

echo ""
echo "🚀 Starting micro-nanobot"
echo "   Model: $SELECTED_NAME"
echo "   File: $SELECTED_MODEL"
echo ""

# Verify model exists
if [ ! -f "$SELECTED_MODEL" ]; then
  echo "❌ Model file not found!"
  exit 1
fi

# Start llama.cpp server in background
echo "🤖 Starting llama.cpp server..."
cd llama.cpp/build
./bin/llama-server -m "$SELECTED_MODEL" --port 8080 --ctx-size 32768 &
SERVER_PID=$!
cd ../..

# Wait for server
echo "⏳ Waiting for server to initialize..."
sleep 5

# Check if server started
if ! kill -0 $SERVER_PID 2>/dev/null; then
  echo "❌ Server failed to start"
  exit 1
fi

# Check health
for i in {1..10}; do
  if curl -s http://127.0.0.1:8080/health > /dev/null 2>&1; then
    echo "✅ Server ready (PID: $SERVER_PID)"
    break
  fi
  sleep 1
done

echo ""
echo "🤖 Starting agent..."
echo ""

# Cleanup on exit
trap "kill $SERVER_PID 2>/dev/null; echo -e '\n👋 Stopped server'" EXIT

# Start agent
node agent.js
