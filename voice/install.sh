#!/data/data/com.termux/files/usr/bin/bash
# Install voice dependencies for micro-nanobot

set -e

echo "🎤 Installing voice dependencies for micro-nanobot"
echo ""

# Install Python and dependencies
echo "📦 Installing Python and dependencies..."
pkg install python pip cmake ninja sox -y

# Install sherpa-onnx
echo "📦 Installing sherpa-onnx (ASR + TTS)..."
pip install sherpa-onnx

# Download ASR model
echo "📥 Downloading ASR model (sherpa-onnx-streaming-zipformer-small)..."
mkdir -p models/asr
cd models/asr

if [ ! -f "sherpa-onnx-streaming-zipformer-small-2024-03-25.tar.bz2" ]; then
  wget -q https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-streaming-zipformer-small-2024-03-25.tar.bz2
  tar xf sherpa-onnx-streaming-zipformer-small-2024-03-25.tar.bz2
  rm sherpa-onnx-streaming-zipformer-small-2024-03-25.tar.bz2
  echo "✓ ASR model downloaded (~50MB)"
else
  echo "✓ ASR model already exists"
fi

cd ../..

# Download TTS model
echo "📥 Downloading TTS model (piper en_US-lessac-medium)..."
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
echo "✅ Voice dependencies installed!"
echo ""
echo "Models location:"
echo "  ASR: models/asr/sherpa-onnx-streaming-zipformer-small-2024-03-25/"
echo "  TTS: models/tts/en_US-lessac-medium.onnx"
echo ""
echo "Next step: Run 'node agent.js' and use /voice on to enable voice mode"
