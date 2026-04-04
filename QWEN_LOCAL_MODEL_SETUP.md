# Qwen Code Local Model Configuration Guide

Complete guide for configuring Qwen Code CLI to use local llama.cpp models with maximum context limits.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Understanding Context Limits](#understanding-context-limits)
3. [Configuration Files](#configuration-files)
4. [Hardcoded Limits in Qwen Code](#hardcoded-limits-in-qwen-code)
5. [Maximizing Context for Local Models](#maximizing-context-for-local-models)
6. [Modifying Qwen Code Source](#modifying-qwen-code-source)
7. [Troubleshooting](#troubleshooting)

---

## Quick Start

### 1. User Settings Location

**Windows:**
```
%USERPROFILE%\.qwen\settings.json
# e.g., C:\Users\<username>\.qwen\settings.json
```

**Linux/macOS:**
```
~/.qwen/settings.json
```

### 2. Minimal Working Configuration

```json
{
  "security": {
    "auth": {
      "selectedType": "openai"
    }
  },
  "model": {
    "name": "local-qwen3.5-9b"
  },
  "providers": {
    "openai": {
      "baseUrl": "http://127.0.0.1:8000",
      "apiKey": "not-needed"
    }
  },
  "chat": {
    "contextLimit": 262144
  },
  "modelProviders": {
    "openai": [
      {
        "id": "local-qwen3.5-9b",
        "name": "Qwen3.5-9B (Local)",
        "baseUrl": "http://127.0.0.1:8000/v1",
        "envKey": "LOCAL_API_KEY",
        "generationConfig": {
          "timeout": 300000,
          "maxRetries": 2,
          "contextWindowSize": 262144,
          "samplingParams": {
            "temperature": 0.6,
            "top_p": 0.9,
            "max_tokens": 8192,
            "stop": ["<｜end▁of▁sentence｜>"]
          }
        }
      }
    ]
  },
  "$version": 3
}
```

---

## Understanding Context Limits

There are **multiple layers** of context limits that interact:

### 1. Model's Native Context Window
- **Qwen 3.5 9B**: 262,144 tokens (256K)
- **Gemma 4 26B**: 128,000 tokens
- **DeepSeek R1 Qwen3 8B**: 65,536 tokens

### 2. llama.cpp Server Configuration
Set via `--ctx-size` parameter:
```bash
llama-server -m model.gguf --ctx-size 262144 -ngl 99
```

### 3. Qwen Code Configuration Layers

| Layer | Setting | File | Purpose |
|-------|---------|------|---------|
| Chat Session | `contextLimit` | `settings.json` | UI display limit |
| Model Config | `contextWindowSize` | `settings.json` | API request limit |
| Output | `max_tokens` | `settings.json` | Response token limit |
| Session Cap | `sessionTokenLimit` | `settings.json` | Hard stop threshold |

---

## Configuration Files

### User Settings (`~/.qwen/settings.json`)

```json
{
  "chat": {
    "contextLimit": 262144
  },
  "modelProviders": {
    "openai": [
      {
        "id": "my-local-model",
        "name": "My Local Model",
        "baseUrl": "http://127.0.0.1:8000/v1",
        "envKey": "LOCAL_API_KEY",
        "generationConfig": {
          "contextWindowSize": 262144,
          "samplingParams": {
            "max_tokens": 8192
          }
        }
      }
    ]
  }
}
```

### llama.cpp Launch Script

```batch
@echo off
set MODEL_PATH=C:\Users\%USERNAME%\Projects\models\local-Qwen3.5-9B.Q4_K_M.gguf
set LLAMA_SERVER=C:\Users\%USERNAME%\llama.cpp\build\bin\Release\llama-server.exe
set PORT=8000
set CONTEXT_SIZE=262144
set GPU_LAYERS=99

"%LLAMA_SERVER%" -m "%MODEL_PATH%" --port %PORT% --ctx-size %CONTEXT_SIZE% -ngl %GPU_LAYERS%
```

---

## Hardcoded Limits in Qwen Code

**⚠️ CRITICAL:** Qwen Code has hardcoded context limits that may override your settings!

### Primary Source File

**File:** `qwen-code/packages/core/src/core/tokenLimits.ts`

This file contains the `tokenLimit()` function that auto-detects limits based on model name patterns.

### Hardcoded Default Values

```typescript
export const DEFAULT_TOKEN_LIMIT = 131_072; // 128K
export const DEFAULT_OUTPUT_TOKEN_LIMIT = 32_000; // 32K
```

### Model Pattern Matching (Lines 71-151)

Qwen Code matches model names and assigns hardcoded limits:

| Pattern | Hardcoded Limit | Your Override |
|---------|-----------------|---------------|
| `gemini-*` | 1,000,000 | `contextWindowSize` in settings |
| `gpt-5*` | 272,000 | `contextWindowSize` in settings |
| `gpt-*` (4o, 4.1) | 131,072 | `contextWindowSize` in settings |
| `o3*`, `o4*` | 200,000 | `contextWindowSize` in settings |
| `claude*` | 200,000 | `contextWindowSize` in settings |
| `*local*`, `*llama*`, `*ollama*` | **262,144** | `contextWindowSize` in settings |
| `qwen3-max*` | 262,144 | `contextWindowSize` in settings |
| `qwen*` (fallback) | 262,144 | `contextWindowSize` in settings |
| `deepseek*` | 131,072 | `contextWindowSize` in settings |
| `glm-5`, `glm-4.7` | 202,752 | `contextWindowSize` in settings |
| `minimax*` | 196,608 | `contextWindowSize` in settings |
| `kimi*` | 262,144 | `contextWindowSize` in settings |

### Output Token Limits

Also hardcoded in `tokenLimits.ts`:

```typescript
// Lines 156-182
function outputTokenLimit(modelName: string): TokenCount {
  // Local models: 64K
  if (/local|llama|ollama/i.test(modelName)) return 64_000;
  // ... other patterns
}
```

### Where Limits Are Applied

1. **Config Loading** (`client.ts`): Uses `tokenLimit()` to set defaults if user hasn't specified `contextWindowSize`
2. **Request Building**: Caps `max_tokens` to model's output limit
3. **Session Tracking**: Compares against `sessionTokenLimit` if set

---

## Maximizing Context for Local Models

### For 256K Context Models (Qwen 3.5 9B, etc.)

#### Step 1: llama.cpp Server
```batch
llama-server.exe -m model.gguf --ctx-size 262144 -ngl 99
```

#### Step 2: User Settings (`~/.qwen/settings.json`)
```json
{
  "chat": {
    "contextLimit": 262144
  },
  "model": {
    "name": "local-qwen3.5-9b"
  },
  "modelProviders": {
    "openai": [
      {
        "id": "local-qwen3.5-9b",
        "name": "Qwen3.5-9B (Local)",
        "baseUrl": "http://127.0.0.1:8000/v1",
        "envKey": "LOCAL_API_KEY",
        "generationConfig": {
          "contextWindowSize": 262144,
          "samplingParams": {
            "max_tokens": 64000
          }
        }
      }
    ]
  }
}
```

#### Step 3: Verify Configuration
Run in Qwen Code:
```
/qc-helper show settings
```

### For 128K Context Models

```json
{
  "chat": {
    "contextLimit": 131072
  },
  "modelProviders": {
    "openai": [{
      "generationConfig": {
        "contextWindowSize": 131072
      }
    }]
  }
}
```

### For 64K Context Models

```json
{
  "chat": {
    "contextLimit": 65536
  },
  "modelProviders": {
    "openai": [{
      "generationConfig": {
        "contextWindowSize": 65536
      }
    }]
  }
}
```

---

## Modifying Qwen Code Source

If Qwen Code's hardcoded limits are blocking you, modify the source:

### Option 1: Increase Default Limit

**File:** `qwen-code/packages/core/src/core/tokenLimits.ts`

```typescript
// Line 11
export const DEFAULT_TOKEN_LIMIT: TokenCount = 262_144; // Changed from 131_072
```

### Option 2: Modify Local Model Detection

**File:** `qwen-code/packages/core/src/core/tokenLimits.ts`

```typescript
// Lines 71-151 - Add your model pattern
function tokenLimit(modelName: string): TokenCount {
  const lower = modelName.toLowerCase();
  
  // Add your custom model with maximum context
  if (lower.includes('my-custom-model')) {
    return 524_288; // 512K
  }
  
  // Existing patterns...
  if (/local|llama|ollama/i.test(lower)) {
    return 262_144; // Can increase this
  }
  // ...
}
```

### Option 3: Increase Output Token Limit

**File:** `qwen-code/packages/core/src/core/tokenLimits.ts`

```typescript
// Lines 156-182
function outputTokenLimit(modelName: string): TokenCount {
  // Local models - increase from 64K
  if (/local|llama|ollama/i.test(modelName)) {
    return 128_000; // Increased
  }
  // ...
}
```

### Rebuild After Changes

```bash
cd qwen-code
npm run build
# Or for CLI only:
cd packages/cli
npm run build
```

---

## Troubleshooting

### Issue: "Request exceeds available context size"

**Symptoms:**
```
[API Error: 400 request (65575 tokens) exceeds the available context size (65536 tokens)]
```

**Causes & Solutions:**

1. **llama.cpp context too small**
   - Check: `--ctx-size` parameter
   - Fix: Increase to match model capacity

2. **Qwen Code `contextWindowSize` not set**
   - Check: `~/.qwen/settings.json`
   - Fix: Add `"contextWindowSize": 262144` to generationConfig

3. **Qwen Code `contextLimit` too small**
   - Check: `chat.contextLimit` in settings
   - Fix: Increase to match model

4. **Qwen Code hardcoded limit overriding**
   - Check: `tokenLimits.ts` pattern matching
   - Fix: Ensure model name contains "local", "llama", or "ollama" OR explicitly set `contextWindowSize`

### Issue: Context Window Not Recognized

**Debug Steps:**

1. Check current model configuration:
   ```
   /qc-helper show settings
   ```

2. Verify model name pattern matches local detection:
   - Should contain: `local`, `llama`, or `ollama`
   - Examples: `local-qwen3.5-9b`, `my-llama-model`, `ollama-phi4`

3. Check tokenLimits.ts is using your pattern:
   ```typescript
   if (/local|llama|ollama/i.test(lower)) {
     return 262_144;
   }
   ```

### Issue: Out of Memory (OOM)

**Context vs VRAM Trade-off:**

| Context | Qwen 3.5 9B (Q4_K_M) | GPU Layers |
|---------|---------------------|------------|
| 262,144 | ~16 GB VRAM | -ngl 5 to -ngl 10 |
| 131,072 | ~10 GB VRAM | -ngl 20 to -ngl 30 |
| 65,536 | ~6 GB VRAM | -ngl 99 |
| 32,768 | ~4 GB VRAM | -ngl 99 |

**Hybrid Mode** (compute on GPU, KV cache in RAM):
```batch
llama-server.exe -m model.gguf --ctx-size 262144 -ngl 5
```

**Full GPU Offload** (smaller context):
```batch
llama-server.exe -m model.gguf --ctx-size 65536 -ngl 99
```

---

## Reference: Complete Settings Schema

```json
{
  "security": {
    "auth": {
      "selectedType": "openai" | "bailian"
    }
  },
  "model": {
    "name": "model-provider-id"
  },
  "providers": {
    "openai": {
      "baseUrl": "http://localhost:8000",
      "apiKey": "optional"
    }
  },
  "chat": {
    "contextLimit": 262144,
    "sessionTokenLimit": 250000
  },
  "modelProviders": {
    "openai": [
      {
        "id": "unique-id",
        "name": "Display Name",
        "baseUrl": "http://localhost:8000/v1",
        "envKey": "ENV_VAR_NAME",
        "generationConfig": {
          "timeout": 300000,
          "maxRetries": 2,
          "contextWindowSize": 262144,
          "samplingParams": {
            "temperature": 0.6,
            "top_p": 0.9,
            "max_tokens": 64000,
            "stop": ["<｜end▁of▁sentence｜>"]
          }
        }
      }
    ]
  },
  "$version": 3
}
```

---

## Related Files

- **This Project:** `start-llama-server.bat`
- **User Settings:** `~/.qwen/settings.json`
- **Qwen Code Source:** `qwen-code/packages/core/src/core/tokenLimits.ts`
- **Qwen Code CLI:** `qwen-code/packages/cli/src/config/settingsSchema.ts`

---

## Version History

| Date | Change |
|------|--------|
| 2025-01-XX | Documented 256K context for Qwen 3.5 9B |
| 2025-01-XX | Added troubleshooting for hardcoded limits |

---

*For issues with Qwen Code, see: https://github.com/QwenLM/qwen-code*
