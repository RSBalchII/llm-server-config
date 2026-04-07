#!/data/data/com.termux/files/usr/bin/bash
# Quick start for micro-nanobot on Termux

echo "🚀 Starting micro-nanobot with Qwen 3.5 2B"
echo ""

# Check if llama.cpp build exists
if [ ! -f "llama.cpp/build/bin/llama-server" ]; then
  echo "❌ llama.cpp not built yet!"
  echo "   Run: ./install-termux.sh"
  exit 1
fi

# Check if config exists
if [ ! -f config.json ]; then
  echo "📋 Creating config.json..."
  cp config.example.json config.json
fi

# Start llama.cpp server in background
echo "🤖 Starting llama.cpp server with Qwen 3.5 2B..."
cd llama.cpp/build
./bin/llama-server -m /data/data/com.termux/files/home/models/Qwen3.5-2B-Q4_K_M.gguf --port 8080 --ctx-size 4096 &
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
trap "kill $SERVER_PID 2>/dev/null; echo '\n👋 Stopped server'" EXIT
node agent.js
