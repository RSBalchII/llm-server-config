#!/data/data/com.termux/files/usr/bin/bash
# Install llama.cpp on Termux (Android/Pixel)

set -e

echo "🚀 Installing llama.cpp on Termux"
echo ""

# Install build dependencies
echo "📦 Installing build dependencies..."
pkg update -y
pkg install -y git cmake clang python

# Clone llama.cpp
if [ ! -d "llama.cpp" ]; then
  echo "📥 Cloning llama.cpp..."
  git clone https://github.com/ggerganov/llama.cpp
else
  echo "✅ llama.cpp already exists"
  cd llama.cpp
  git pull
  cd ..
fi

# Build for ARM (Pixel 8 uses ARM64)
echo "🔨 Building llama.cpp (this takes ~5-10 minutes)..."
cd llama.cpp
mkdir -p build
cd build
cmake ..
make -j$(nproc)
cd ../..

# Symlink models directory to your existing models
echo "📁 Linking to your existing models..."
ln -sf /data/data/com.termux/files/home/models llama.cpp/models

echo ""
echo "✅ Build complete!"
echo ""
echo "Your models:"
ls -lh /data/data/com.termux/files/home/models/*.gguf
echo ""
echo "To start the server:"
echo "  cd llama.cpp/build && ./bin/llama-server -m ../models/qwen3.5-2b-instruct-q4_k_m.gguf --port 8080 --ctx-size 4096"
echo ""
echo "Then in another terminal:"
echo "  cd micro-nanobot && ./start.sh"
