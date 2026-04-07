#!/data/data/com.termux/files/usr/bin/bash
# Install voice dependencies - Binary approach (no Python!)

set -e

echo "🎤 Installing voice dependencies (binary mode - no Python!)"
echo ""

# Install audio tools
echo "📦 Installing audio dependencies..."
pkg install sox wget -y

# Download pre-built sherpa-onnx and piper binaries
echo "📥 Downloading sherpa-onnx binary..."
mkdir -p voice/bin
cd voice/bin

if [ ! -f "sherpa-onnx" ]; then
  # ARM64 binary for Android
  wget -q https://github.com/k2-fsa/sherpa-onnx/releases/download/v1.10.0/sherpa-onnx-android-arm64-v8a.tar.bz2
  tar xf sherpa-onnx-android-arm64-v8a.tar.bz2
  rm sherpa-onnx-android-arm64-v8a.tar.bz2
  echo "✓ sherpa-onnx binary downloaded (~20MB)"
else
  echo "✓ sherpa-onnx binary already exists"
fi

if [ ! -f "piper" ]; then
  # Piper TTS binary for ARM64
  wget -q https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_android_arm64.tar.gz
  tar xf piper_android_arm64.tar.gz
  rm piper_android_arm64.tar.gz
  chmod +x piper
  echo "✓ piper binary downloaded (~15MB)"
else
  echo "✓ piper binary already exists"
fi

cd ../..

# Download ASR model
echo "📥 Downloading ASR model..."
mkdir -p models/asr
cd models/asr

if [ ! -d "sherpa-onnx-streaming-zipformer-small-2024-03-25" ]; then
  wget -q https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-streaming-zipformer-small-2024-03-25.tar.bz2
  tar xf sherpa-onnx-streaming-zipformer-small-2024-03-25.tar.bz2
  rm sherpa-onnx-streaming-zipformer-small-2024-03-25.tar.bz2
  echo "✓ ASR model downloaded (~50MB)"
else
  echo "✓ ASR model already exists"
fi

cd ../../..

# Download TTS model
echo "📥 Downloading TTS model..."
mkdir -p models/tts
cd models/tts

if [ ! -f "en_US-lessac-medium.onnx" ]; then
  wget -q https://github.com/rhasspy/piper/releases/download/v1.2.0/voice-en_US-lessac-medium.tar.gz
  tar xf voice-en_US-lessac-medium.tar.gz
  rm voice-en_US-lessac-medium.tar.gz
  echo "✓ TTS model downloaded (~80MB)"
else
  echo "✓ TTS model already exists"
fi

cd ../..

echo ""
echo "✅ Voice dependencies installed (no Python required!)"
echo ""
echo "Binaries:"
echo "  ASR: voice/bin/sherpa-onnx"
echo "  Models: models/asr/, models/tts/"
echo ""
echo "Next: Run 'node agent.js' and use /voice on"
