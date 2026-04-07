# micro-nanobot

Minimal AI agent harness inspired by [microclaw](https://github.com/microclaw/microclaw). Single file, zero dependencies, works with llama.cpp server.

## Quick Start (Termux on Android)

### Prerequisites
- llama.cpp server built (see Install section below)
- A GGUF model file (e.g., Qwen3.5-2B, Gemma-4, LFM)

### Start with Model Selection

```bash
cd ~/projects/micro-nanobot

# Interactive model selector + starter
./start.sh
```

### Download Models

```bash
# Download new models
./download-model.sh

# Options include:
# - Qwen3.5 2B/4B (Best for agents)
# - Gemma 4 5B/8B (New! Google)
# - LFM 2.5 350M (Fastest)
```

## Usage

### Three Modes

**1. Tool Mode (default)** - Execute commands directly
```
👤 You: list files
🎯 Intent: ls -la
📋 Result: total 24...
```

**2. Plan Mode** - Multi-step task execution
```
👤 You: /plan
🧠 Mode: PLAN

👤 You: find the AEN project and show its structure
🧠 Complex task detected - creating plan...
📝 Plan:
  1. find . -type d -name "AEN"
  2. cd ./AEN && ls -la
  3. ls -d */
📋 Executing 3 step plan...
💬 Summary: Found AEN project at ./projects/AEN with 3 subdirectories...
```

**3. Chat Mode** - Conversation only
```
👤 You: /chat
💬 Mode: CHAT

👤 You: what is quantum computing?
🤔 Thinking...
💬 Quantum computing is a type of computing...
```

### Mode Commands

- `/tool` - Switch to tool execution mode (default)
- `/plan` - Switch to multi-step planning mode
- `/chat` - Switch to conversation mode
- `/t <command>` - One-time tool execution (from any mode)

### Special Commands

- `/quit` or `/exit` - Exit the agent
- `/clear` - Clear conversation context
- `/config` - Show current configuration

## Installation (Termux)

```bash
# Install build dependencies
pkg install git cmake clang python -y

# Clone and build llama.cpp
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
mkdir build && cd build
cmake -DGGML_BUILD_TESTS=OFF -DGGML_BUILD_EXAMPLES=OFF ..
make llama-server -j2
```

## Configuration

Copy `config.example.json` to `config.json` and edit:

```json
{
  "llmUrl": "http://127.0.0.1:8080",
  "model": "qwen-3.5-2b",
  "maxContext": 10,
  "systemPrompt": "..."
}
```

## Tool Format

The agent uses simple regex-based parsing (tiny model friendly):

| Tool | Format |
|------|--------|
| Bash | `I'll run: <command>` |
| Read | `I'll read: <filepath>` |
| Write | `I'll write: <filepath>\n<content>` |

## Model Recommendations

| Model | Size | RAM | Best For |
|-------|------|-----|----------|
| **Qwen3.5 2B Distilled** | 2B | 1.5GB | **Best balance** ✅ |
| **Qwen3.5 4B Distilled** | 4B | 3GB | Better reasoning |
| **Qwen3.5 4B Abliterated** | 4B | 3GB | Unrestricted agent |
| **Gemma 4 E2B** | 5B | 4GB | **New! Google** |
| **Gemma 4 E4B** | 8B | 6GB | Best quality |
| **LFM 2.5 350M** | 0.4B | 0.5GB | Fastest testing |

### Download Models

```bash
# Interactive model downloader
./download-model.sh

# Or start with model selection
./start-termux.sh
```

**Why Distilled?** Jackrong's distilled models are trained on:
- Chain-of-thought reasoning datasets
- Multi-turn conversations
- Competitive programming
- Tool use patterns

**Why Abliterated?** Removes safety filters for unrestricted agent work. Use responsibly!

## Architecture

```
agent.js (~400 LOC)
├── LLM Client (HTTP to llama.cpp)
├── Tool Parser (regex-based)
├── Tools (bash, read_file, write_file)
├── Context Manager (truncation)
└── Agent Loop (REPL + multi-step)
```

## License

MIT
