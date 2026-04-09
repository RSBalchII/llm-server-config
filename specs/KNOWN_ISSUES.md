# Known Issues & Pain Points

## Resolved

### ✅ Model Name Validation (llama.cpp HTTP 400)
**Symptom:** `model 'name' not found` errors on all chat completions  
**Root Cause:** llama.cpp validates model name against loaded model. Empty model name from `start.bat` (`-m ""`) caused all requests to fail.  
**Fix:** 
- Hardcoded `MODEL_NAME` in `server.js` to match loaded model
- Proxy replaces any model name with actual loaded model before forwarding
- `/v1/models` endpoint returns correct model ID

**Date:** 2026-04-08

### ✅ Port Conflict (EADDRINUSE)
**Symptom:** Multiple processes binding port 8080  
**Root Cause:** `taskkill /F /IM node.exe` killed all Node processes including Qwen Code  
**Fix:** 
- Only kill `llama-server.exe` during restarts
- Never kill `node.exe` indiscriminately
- Use PID-specific kills: `taskkill /F /PID <pid>`

**Date:** 2026-04-08

### ✅ Tool Call Format Mismatch
**Symptom:** Models output `[tool_call: ...]` as text instead of structured `tool_calls`  
**Root Cause:** llama.cpp's OpenAI-compatible endpoint returns structured `tool_calls` only when `tools` parameter is sent in request  
**Fix:** 
- Send `tools` array with proper JSON Schema format
- Set `tool_choice: 'auto'`
- Parse `message.tool_calls` from response
- Execute tools and feed results back

**Date:** 2026-04-08

### ✅ DLL Load Failure (Exit Code 3221225781)
**Symptom:** llama-server exits immediately with code `3221225781` (`0xC0000135` = missing DLL)  
**Root Cause:** `node spawn()` doesn't inherit DLL search path from batch environment  
**Fix:** Use batch `start /B` with `/D` working directory flag instead of Node `spawn()`

**Date:** 2026-04-07

### ✅ Duplicate Models in Menu
**Symptom:** 30 models listed instead of 15  
**Root Cause:** Scanned multiple directories with overlapping symlinks  
**Fix:** Scan single model directory (`%USERPROFILE%\Projects\models`)

**Date:** 2026-04-07

### ✅ Context Window Too Small
**Symptom:** `n_ctx_seq (8192) < n_ctx_train (40960)`  
**Fix:** Changed `--ctx-size` from 8192 to 40960

**Date:** 2026-04-07

## Unresolved

### ⏳ Model Name Detection
**Current State:** `MODEL_NAME` hardcoded in `server.js`  
**Problem:** Must manually update when switching models via `start.bat`  
**Impact:** Agent-v2 and proxy always report wrong model if different model loaded  
**Proposed Fix:** 
- llama.cpp doesn't expose loaded model via `/v1/models` or `/health`
- Could parse `start.bat` output to extract model path
- Or use environment variable (tried, failed with `setlocal enabledelayedexpansion`)
**Severity:** Low - works as long as `server.js` matches loaded model

### ⏳ start.bat Model Path Empty
**Symptom:** Occasionally `start.bat` launches llama-server with `-m ""`  
**Root Cause:** Batch variable expansion failure (likely `%SELECTED_MODEL%` not set)  
**Workaround:** Kill and restart `start.bat`  
**Proposed Fix:** Validate model path before launching, exit with error if empty  
**Severity:** Medium - happens ~20% of runs

### ⏳ Agent-v2 REPL Piped Input
**Symptom:** `echo prompt | agent-v2.js` fails with `ERR_USE_AFTER_CLOSE`  
**Root Cause:** readline closes stdin after single line, then tries to read again  
**Impact:** Can't script agent-v2 from command line  
**Workaround:** Use interactive mode only  
**Proposed Fix:** Detect piped input, skip REPL loop  
**Severity:** Low - interactive mode works

### ⏳ Qwen Code Context Window
**Current State:** `contextWindowSize: 65536` for gemma, `262144` for qwen  
**Problem:** Proxy/llama-server context is 40960  
**Impact:** Qwen Code may send prompts exceeding llama-server capacity  
**Severity:** Low - context truncation handled gracefully
