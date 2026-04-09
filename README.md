# micro-nanobot

Local GGUF model server with OpenAI-compatible streaming API.

## Quick Start

```bash
# Start with model selector
.\start.bat

# Select model, choose GPU layers
# Server starts on http://127.0.0.1:8888
```

**Qwen Code config** (`~/.qwen/settings.json`):
```json
{
  "providers": {
    "openai": {
      "baseUrl": "http://127.0.0.1:8888/v1",
      "apiKey": "not-needed"
    }
  }
}
```

## Architecture

```
Qwen Code ──→ server-v3.js:8888 ──→ node-llama-cpp ──→ GPU
                     │
              Chat templating
              Stream tokens via SSE
              OpenAI format
```

## Features

- **No external binaries** - runs entirely in Node.js
- **Model-specific chat templates** - Qwen, Qwen3, Gemma, Alpaca (auto-detected)
- **Real streaming** - token-by-token SSE via `onToken` callback
- **Context size** auto-detection from model metadata
- **VRAM warnings** for models exceeding 16GB GPU memory
- **OpenAI-compatible** - drop-in for any OpenAI client

## Tested Models

| Model | Size | GPU Layers | Status |
|-------|------|-----------|--------|
| Qwen3.5-4B-heretic | 2.5GB | 33 | ✅ Clean responses |
| Stable-DiffCoder-8B | 4.5GB | 33 | ✅ Coherent output |
| DeepSeek-R1-7B | 4.0GB | 29 | ✅ Responds correctly |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server status |
| `/v1/models` | GET | Model info |
| `/v1/chat/completions` | POST | Chat (streaming or non-streaming) |

## Requirements

- **Node.js** 20+
- **GPU**: NVIDIA RTX 4090 Laptop (16GB VRAM)
- **Models**: `C:\Users\rsbiiw\Projects\models\*.gguf`

## License

MIT
