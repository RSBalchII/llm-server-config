# Voice Features for micro-nanobot

Hands-free voice control for your terminal AI agent.

## Quick Start

### 1. Install Voice Dependencies

```bash
cd ~/projects/micro-nanobot
chmod +x voice/install.sh
./voice/install.sh
```

This will:
- Install Python and sherpa-onnx
- Download ASR model (~50MB)
- Download TTS model (~80MB)
- Install audio dependencies (sox)

### 2. Enable Voice Features

```bash
node agent.js

# In the agent:
/voice on        # Enable voice input
/speak on        # Enable spoken responses
/handsfree on    # Full hands-free mode
```

## Voice Commands

| Command | Description |
|---------|-------------|
| `/voice on` | Enable voice input mode |
| `/voice off` | Disable voice input |
| `/speak on` | Enable spoken responses |
| `/speak off` | Disable spoken responses |
| `/handsfree on` | Continuous listening mode |
| `/handsfree off` | Stop hands-free mode |

## Voice Mode Workflow

```
👤 You: /voice on
🎤 Voice mode: ON

👤 You: list files
🎙️  Recording for 5s... Speak now!
🎯 Intent: ls -la (confidence: high)
🔧 Executing...
📋 Result: total 24...
```

## Hands-Free Mode

```
👤 You: /handsfree on
🎙️  Continuous listening... (say "stop listening" to end)

🎙️  You (voice): list files
🎯 Intent: ls -la
📋 Result: total 24...

🎙️  You (voice): show package.json
🎯 Intent: cat package.json
📋 Result: { "name": "micro-nanobot"...

🎙️  You (voice): stop listening
⏹️  Stopped listening
```

## How It Works

### ASR (Speech → Text)
- **Model:** Sherpa-ONNX Zipformer Small (~50MB)
- **Recording:** 5 seconds via microphone
- **Processing:** Offline, local only
- **Privacy:** No cloud APIs

### TTS (Text → Speech)
- **Model:** Piper en_US-lessac-medium (~80MB)
- **Quality:** Natural sounding voice
- **Processing:** Offline, local only
- **Output:** Terminal audio

## Resource Usage

| Component | RAM | Storage |
|-----------|-----|---------|
| ASR Model | ~100MB | 50MB |
| TTS Model | ~100MB | 80MB |
| Agent | ~50MB | 15KB |
| **Total** | **~250MB** | **~145MB** |

## Troubleshooting

### "ASR model not found"
```bash
./voice/install.sh
```

### "Recording failed"
```bash
# Check microphone permissions
# In Termux: Settings → Permissions → Microphone → Allow
pkg install sox
```

### "TTS generation failed"
```bash
# Reinstall TTS model
cd voice && ./install.sh
```

### Poor recognition accuracy
- Speak clearly and at normal pace
- Reduce background noise
- Move closer to microphone
- Use English (other languages need different models)

## Advanced: Custom Models

### Change ASR Model
Edit `voice/asr.js`:
```javascript
const ASR_MODEL_PATH = 'models/asr/YOUR_MODEL';
```

### Change TTS Voice
Edit `voice/tts.js`:
```javascript
const TTS_MODEL_PATH = 'models/tts/YOUR_VOICE.onnx';
```

Download models from:
- ASR: https://github.com/k2-fsa/sherpa-onnx/releases
- TTS: https://github.com/rhasspy/piper/releases

## Limitations

- **Language:** English only (by default)
- **Recording:** 5 second limit per utterance
- **Streaming:** Not real-time (record → transcribe → speak)
- **Accuracy:** ~85-95% in quiet environments

## Future Enhancements

- [ ] Real-time streaming ASR
- [ ] Multi-language support
- [ ] Wake word detection ("Hey Nanobot")
- [ ] Voice training for better accuracy
- [ ] Background noise cancellation
