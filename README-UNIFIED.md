# 🦙 Llama Model Server

Local GGUF model server for running Qwen 3.5 and Gemma 4 models on Windows ARM64.

## Quick Start

```bash
# Start the server (double-click or run)
start.bat

# Or manually
cd C:\Users\rsbii\Projects\llama-server
npm start

# Or use the model selector
npm run select
```

**Web UI:** http://localhost:3000

## Available Models

| Model | Size | Context | Description |
|-------|------|---------|-------------|
| Qwen3.5-9B.Q4_K_M.gguf | 5.24 GB | 256K | "Qwopus" - Claude Opus competitor |
| Qwen3.5-4B.Q4_K_M.gguf | 2.52 GB | 256K | Lightweight Qwen 3.5 |
| gemma-4-E4B-it-IQ4_NL.gguf | 4.5 GB | 128K | Google Gemma 4 Edge |

## Configuration

**Default Settings:**
- Context Size: `262144` (256K tokens)
- Max Output: `8192` tokens
- GPU Layers: `99` (full offload)
- CPU Threads: `4`

Edit `server-cjs.js` to customize.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/models` | GET | List available models |
| `/api/load` | POST | Load a model |
| `/api/unload` | POST | Unload current model |
| `/api/chat` | POST | Chat with loaded model |
| `/api/completions` | POST | OpenAI-compatible chat |
| `/health` | GET | Server health check |

### Examples

**Load a model:**
```bash
curl -X POST http://localhost:3000/api/load \
  -H "Content-Type: application/json" \
  -d '{"modelPath":"Qwen3.5-4B.Q4_K_M.gguf"}'
```

**Chat:**
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Hello!","maxTokens":256}'
```

**OpenAI-compatible:**
```bash
curl -X POST http://localhost:3000/api/completions \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'
```

## Qwen Coder Integration

Configure as an OpenAI-compatible endpoint:

**Base URL:** `http://localhost:3000/api/completions`

**Model name:** `qwen3.5-4b` or `qwen3.5-9b`

## Architecture

This server uses:
- **llama.cpp** (b8660) - Official ARM64 Windows binary for inference
- **Express.js** - Web server and API
- **GGUF models** - Quantized model format

The llama.cpp `llama-server.exe` runs as a subprocess on port 8080, with the Node.js server proxying requests on port 3000.

## Performance

On Dell XPS 13 (Qualcomm ARM64, 16GB RAM):
- **Qwen3.5-4B**: ~2-4 tokens/second
- **Qwen3.5-9B**: ~1-2 tokens/second
- **Gemma-4-E4B**: ~2-3 tokens/second

## Requirements

- Windows 11 ARM64
- 16GB RAM recommended
- Node.js 18+
- ~15GB storage for all models
