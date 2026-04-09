# Tasks

## Completed

### ✅ Tool Execution Support
- [x] Add tool definitions to server.js
- [x] Implement tool execution loop
- [x] Test with Qwen3.5-4B-heretic
- [x] Test with gemma-4-E4B-it-Heretic
- [x] Test with DeepSeek-R1-0528-Qwen3-8B
- [x] Document in spec.md

**Status:** ✅ COMPLETE (6/6 tests passed)

### ✅ Documentation Update
- [x] Create specs/spec.md
- [x] Create CHANGELOG.md
- [x] Update README.md with architecture diagrams
- [x] Follow doc_policy standards

**Status:** ✅ COMPLETE

### ✅ Model Compatibility Testing
- [x] Create test-model-tools-v2.js
- [x] Direct llama-server spawning (no batch)
- [x] Dynamic model name resolution
- [x] Save results to test-results/

**Status:** ✅ COMPLETE

## Pending

### ⏳ Additional Model Tests
- [ ] Test gemma-4-26B-A4B-it-heretic (MoE)
- [ ] Test Stable-DiffCoder-8B
- [ ] Test Qwen3-30B-A3B (large model)

**Status:** ⏳ PENDING

### ⏳ Qwen Code Integration Testing
- [ ] Test interactive mode with tools
- [ ] Test file operations (read, grep)
- [ ] Test shell commands in YOLO mode
- [ ] Verify thinking tags don't interfere

**Status:** ⏳ PENDING

### ⏳ Performance Optimization
- [ ] Measure actual token speeds per model
- [ ] Optimize context size vs VRAM usage
- [ ] Add caching for repeated tool calls

**Status:** ⏳ PENDING

## Session Log

### 2026-04-08 - Session 2
- Created agent-v2.js with structured tool calling (OpenAI format)
- Fixed model name resolution: proxy now replaces model names correctly
- Documented all known issues in `specs/KNOWN_ISSUES.md`
- **Resolved:** Model name validation (llama.cpp HTTP 400)
- **Resolved:** Port conflict (EADDRINUSE from killing node)
- **Resolved:** Tool call format mismatch
- **Outstanding:** start.bat occasionally passes empty model path
- **Outstanding:** Agent-v2 REPL doesn't work with piped input

### 2026-04-08 - Session 1
- Fixed proxy to support tool execution
- All 3 tested models pass tool calls (6/6)
- Created specs/spec.md, tasks.md, plan.md, standards/
- Architecture documented with diagrams

## Definition of Done

- [ ] Code matches spec.md
- [ ] Tests pass (test-model-tools-v2.js)
- [ ] README.md updated
- [ ] CHANGELOG.md entry added
- [ ] specs/spec.md updated (if architecture changed)
