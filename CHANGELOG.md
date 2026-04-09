# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [0.3.0] - 2026-04-09

### Changed
- **Complete rewrite of server-v3.js**
  - Removed `LlamaChatSession` and chat wrapper dependencies
  - Use `sequence.complete()` with model-specific chat templates
  - Supports Qwen/Qwen3, Gemma, Alpaca templates (auto-detected)
  - Streaming via `onToken` callback (real token-by-token SSE)
  - Proper `stopSequences` per template
  - Clean OpenAI-compatible JSON output
- **package.json**: Default entry is `server-v3.js`
- **start.bat**: Fixed file size overflow (PowerShell instead of batch math)
- **start.bat**: Shows VRAM estimate for large models

### Removed
- 50+ dead files (test scripts, old servers, analysis docs)
- Dead directories (llama.cpp, scheduler, voice, tools, test-results)
- No more `server.js` proxy to external llama-server binary

### Technical
- No more garbled output - raw completions instead of wrapped sessions
- Context size auto-detection from `model.trainContextSize`
- VRAM warnings for models exceeding 16GB GPU memory

## [0.2.0] - 2026-04-08

### Added
- **Tool execution support** for Qwen Code
  - `run_shell_command` - Execute shell commands
  - `list_directory` - List directory contents
  - `read_file` - Read file contents
  - `grep_search` - Search text in files
- **Model tool compatibility testing**
  - Tested 3 model architectures: Qwen, Gemma, DeepSeek
  - All 6/6 tests passed (100% success rate)
- **Architecture diagrams** in `specs/spec.md`
- **Test suite** (`test-model-tools-v2.js`)

### Changed
- **server.js**: Added tool execution loop
  - Detects `tool_calls` in llama-server response
  - Executes tools locally
  - Feeds results back to llama-server
- **start.bat**: Simplified to single model directory
  - Removed duplicate model scanning
  - Fixed variable expansion issues
- **README.md**: Updated to doc_policy standards

### Fixed
- Port mismatch: Proxy now on 8080 (matches Qwen Code config)
- Model name resolution: Dynamic fetch from llama-server `/v1/models`
- DLL loading: llama-server spawned via batch `start /B` (working pattern)
- Context size: Increased from 8192 to 40960

## [0.1.0] - 2026-04-07

### Added
- Initial proxy server (`server.js`)
- Model selection menu (`start.bat`)
- OpenAI-compatible API for Qwen Code
- 15 GGUF model support
