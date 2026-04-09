# System Specification

## Overview

micro-nanobot is an OpenAI-compatible API server that proxies requests to llama.cpp's `llama-server.exe` with **tool execution support**. It enables Qwen Code to use local GGUF models with file system and shell tool access.

## Architecture

### Components

```
┌──────────────┐     ┌─────────────────────────┐     ┌──────────────────┐
│  Qwen Code   │────▶│  server.js (Node.js)    │────▶│  llama-server    │
│  (Client)    │     │  Port: 8080             │     │  (llama.cpp)     │
│              │◀────│  Proxy + Tool Executor  │◀────│  Port: 8081      │
└──────────────┘     └─────────────────────────┘     └──────────────────┘
```

### Data Flow

#### Standard Chat (No Tools)

```
Qwen Code → POST /v1/chat/completions
    ↓
server.js → POST http://127.0.0.1:8081/v1/chat/completions
    ↓
llama-server → Generate response
    ↓
server.js → Return to Qwen Code
```

#### Tool Execution Flow

```
Qwen Code → POST /v1/chat/completions { messages, tools }
    ↓
server.js → Adds tool definitions to request
    ↓
llama-server → Returns { message, tool_calls: [...] }
    ↓
server.js → Executes each tool locally
    ↓
server.js → POST /v1/chat/completions { messages + tool results }
    ↓
llama-server → Generates final response with tool data
    ↓
server.js → Return to Qwen Code
```

## API Contracts

### POST /v1/chat/completions

**Request:**
```json
{
  "model": "model-name.gguf",
  "messages": [
    { "role": "user", "content": "List files in C:\\Projects" }
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "run_shell_command",
        "parameters": { "command": "string" }
      }
    }
  ],
  "tool_choice": "auto",
  "stream": false
}
```

**Response:**
```json
{
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "Here are the files...",
      "tool_calls": null
    }
  }]
}
```

**Response with Tool Calls:**
```json
{
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "",
      "tool_calls": [{
        "id": "abc123",
        "type": "function",
        "function": {
          "name": "run_shell_command",
          "arguments": "{\"command\":\"dir\"}"
        }
      }]
    }
  }]
}
```

### GET /health

**Response:**
```json
{
  "status": "ok",
  "llama": { "status": "ok" }
}
```

### GET /v1/models

**Response:**
```json
{
  "models": [{
    "id": "model-name.gguf",
    "object": "model",
    "created": 1234567890,
    "owned_by": "llamacpp"
  }]
}
```

## Tool Specifications

### run_shell_command

**Purpose:** Execute Windows shell commands

**Parameters:**
- `command` (string, required): Command to execute

**Returns:**
```json
{ "success": true, "output": "command stdout" }
{ "success": false, "output": "error message" }
```

### list_directory

**Purpose:** List directory contents

**Parameters:**
- `path` (string, required): Directory path

**Returns:**
```json
{ "success": true, "output": "file1\nfile2\n..." }
```

### read_file

**Purpose:** Read file contents

**Parameters:**
- `path` (string, required): File path

**Returns:**
```json
{ "success": true, "output": "file content (max 10000 chars)" }
```

### grep_search

**Purpose:** Search text in files

**Parameters:**
- `pattern` (string, required): Search pattern
- `path` (string, optional): Directory to search (default: `.`)

**Returns:**
```json
{ "success": true, "output": "matching lines" }
```

## Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| PROXY_PORT | 8080 | Server port for Qwen Code |
| LLAMA_PORT | 8081 | llama-server backend port |
| CTX_SIZE | 40960 | Context window size |
| GPU_LAYERS | 99 | Full GPU offload |
| THREADS | 4 | CPU threads |

## Performance Targets

| Model | Size | VRAM | Token Speed |
|-------|------|------|-------------|
| Qwen3.5-4B | 2.5 GB | ~4.5 GB | ~90 tok/s |
| Gemma-4-E4B | 4.5 GB | ~6 GB | ~85 tok/s |
| DeepSeek-R1-8B | 4.2 GB | ~5.5 GB | ~80 tok/s |

## Requirements

- **OS:** Windows 11
- **GPU:** NVIDIA RTX 4090 Laptop (16GB VRAM)
- **CUDA:** v13.0
- **Node.js:** 20+
- **llama.cpp:** `C:\Users\rsbiiw\llama.cpp\build\bin\Release\llama-server.exe`
- **Models:** `C:\Users\rsbiiw\Projects\models\*.gguf`

## Error Handling

| HTTP Code | Condition |
|-----------|-----------|
| 200 | Success |
| 502 | llama-server unreachable |
| 503 | llama-server not responding to health check |
