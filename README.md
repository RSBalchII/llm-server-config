# micro-nanobot

Local GGUF model server with OpenAI-compatible API and **tool execution support** for Qwen Code.

## Quick Start

```bash
# Start with model selector
.\start.bat

# Select model from menu (1-15)
# Server starts on http://127.0.0.1:8080
```

**Qwen Code config:**
```json
{
  "providers": {
    "openai": {
      "baseUrl": "http://127.0.0.1:8080/v1",
      "apiKey": "not-needed"
    }
  }
}
```

## Architecture

```
Qwen Code ──→ server.js:8080 ──→ llama-server:8081
                    │
              Tool execution
              Model management
              Request proxy
```

### Data Flow (Tool Calls)

```
1. Qwen Code sends: POST /v1/chat/completions { messages, tools }
2. server.js adds tool definitions to request
3. llama-server responds with tool_calls
4. server.js executes tools locally
5. server.js feeds results back to llama-server
6. llama-server generates final response
7. server.js returns to Qwen Code
```

## Features

- **Tool execution**: `run_shell_command`, `list_directory`, `read_file`, `grep_search`
- **15 GGUF models**: Qwen, Gemma, DeepSeek architectures
- **Full GPU offload**: RTX 4090 Laptop (16GB VRAM)
- **40960 context**: Model-native context size
- **OpenAI-compatible API**: Drop-in replacement for Qwen Code

## Tested Models

| Model | Architecture | Tools | Score |
|-------|-------------|-------|-------|
| Qwen3.5-4B-heretic | Qwen | ✅ | 2/2 |
| gemma-4-E4B-it-Heretic | Google Gemma | ✅ | 2/2 |
| DeepSeek-R1-0528-Qwen3-8B | DeepSeek/Qwen | ✅ | 2/2 |

*See `test-results/tool-compatibility-v2.json` for full results*

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server status |
| `/v1/models` | GET | List available models |
| `/v1/chat/completions` | POST | Chat with tool support |
| `/v1/*` | * | Proxy to llama-server |

### Tool Definitions

```json
{
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "run_shell_command",
        "description": "Execute shell command",
        "parameters": {
          "type": "object",
          "properties": { "command": { "type": "string" } },
          "required": ["command"]
        }
      }
    }
  ]
}
```

## Requirements

- **Node.js** 20+
- **llama.cpp**: `C:\Users\rsbiiw\llama.cpp\build\bin\Release\llama-server.exe`
- **GPU**: NVIDIA RTX 4090 Laptop (16GB VRAM)
- **Models**: `C:\Users\rsbiiw\Projects\models\*.gguf`

## Testing

```bash
# Run model tool compatibility tests
node test-model-tools-v2.js
```

Tests 3 models × 2 tool calls = 6 total tests. Results in `test-results/`.

## License

MIT
