# 🤖 micro-nanobot

**Minimal AI Agent Harness** - Single file, zero dependencies, works with llama.cpp server.

Inspired by [microclaw](https://github.com/microclaw/microclaw).

---

## Quick Start (Termux on Android)

### Start with Model Selection

```bash
cd ~/llm-server-config

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

---

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
💬 Summary: Found AEN project at ./AEN with 3 subdirectories...
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

### Voice Commands (Optional)

- `/voice` or `/voice on` - Enable voice mode
- `/voice off` - Disable voice mode
- `/speak` or `/speak on` - Enable spoken responses
- `/speak off` - Disable spoken responses
- `/handsfree` or `/handsfree on` - Enable hands-free mode
- `/handsfree off` - Disable hands-free mode

### Schedule Commands

- `/schedule every day at 8am list files` - Create a schedule
- `/schedules` - List all schedules
- `/unschedule <id>` - Remove a schedule

---

## Installation (Termux)

### Build llama.cpp

```bash
# Install build dependencies
pkg install git cmake clang python -y

# Clone and build llama.cpp
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
mkdir build && cd build
cmake -DGGML_BUILD_TESTS=OFF -DGGML_BUILD_EXAMPLES=OFF ..
make llama-server -j2
cd ../..
```

### Install micro-nanobot

```bash
# Clone or copy this project
cd ~/llm-server-config

# Install dependencies (none required!)
npm install  # Zero dependencies!

# Optional: Install voice support
./voice/install.sh
```

---

## Configuration

Copy `config.example.json` to `config.json` and edit:

```json
{
  "llmUrl": "http://127.0.0.1:8080",
  "model": "qwen-3.5-2b",
  "maxContext": 10,
  "systemPrompt": "COMMAND MODE ONLY. Output ONLY the shell command..."
}
```

---

## Tool Format

The agent uses simple regex-based parsing (tiny model friendly):

| Tool | Format |
|------|--------|
| Bash | `I'll run: <command>` |
| Read | `I'll read: <filepath>` |
| Write | `I'll write: <filepath>\n<content>` |

---

## Model Recommendations

| Model | Size | RAM | Best For |
|-------|------|-----|----------|
| **Qwen3.5 2B Distilled** | 2B | 1.5GB | **Best balance** ✅ |
| **Qwen3.5 4B Distilled** | 4B | 3GB | Better reasoning |
| **Qwen3.5 4B Abliterated** | 4B | 3GB | Unrestricted agent |
| **Gemma 4 E2B** | 5B | 4GB | **New! Google** |
| **Gemma 4 E4B** | 8B | 6GB | Best quality |
| **LFM 2.5 350M** | 0.4B | 0.5GB | Fastest testing |

---

## Architecture

```
agent.js (~500 LOC)
├── LLM Client (HTTP to llama.cpp)
├── Intent Parser (skill-based)
├── Tools (bash, read_file, write_file)
├── Safety Layer (dangerous command detection)
├── Planning System (multi-step tasks)
├── Context Manager (truncation)
├── Voice Manager (ASR + TTS) [optional]
└── Scheduler (natural language → cron) [optional]
```

### Skills System

Skills are loaded from `.md` files in the `skills/` directory:

- `git.md` - Git operations
- `files.md` - File operations
- `system.md` - System information
- `search.md` - Search and find
- `help.md` - Help commands

Add your own skills by creating new `.md` files!

---

## Qwen Code Integration

See `QWEN_LOCAL_MODEL_SETUP.md` for comprehensive Qwen Code configuration with local models.

### Quick Config

Add to `~/.qwen/settings.json`:

```json
{
  "modelProviders": {
    "openai": [
      {
        "id": "local-qwen3.5-2b",
        "name": "Qwen3.5 2B (Local)",
        "baseUrl": "http://127.0.0.1:8080/v1",
        "envKey": "LOCAL_API_KEY",
        "generationConfig": {
          "contextWindowSize": 262144,
          "samplingParams": {
            "temperature": 0.6,
            "max_tokens": 8192
          }
        }
      }
    ]
  }
}
```

---

## Project Structure

```
llm-server-config/
├── agent.js              # Main agent (~500 LOC)
├── config.json           # Configuration
├── config.example.json   # Example config
├── package.json          # Zero dependencies!
├── start.sh              # Termux starter with model selector
├── download-model.sh     # Model downloader
├── start.bat             # Windows starter
│
├── skills/               # Extensible intent patterns
│   ├── loader.js         # Skill file parser
│   ├── git.md            # Git operations
│   ├── files.md          # File operations
│   ├── system.md         # System info
│   ├── search.md         # Search/find
│   └── help.md           # Help commands
│
├── scheduler/            # Natural language scheduling
│   ├── parser.js         # "every day at 8am" → cron
│   └── manager.js        # Schedule storage
│
├── voice/                # Voice support (optional)
│   ├── manager.js        # Voice orchestration
│   ├── asr.js            # Speech-to-text
│   ├── tts.js            # Text-to-speech
│   └── install.sh        # Voice installer
│
└── llama.cpp/            # llama.cpp submodule
    └── build/bin/llama-server
```

---

## Safety Features

The agent includes a safety layer that blocks or confirms dangerous commands:

| Command | Action | Reason |
|---------|--------|--------|
| `rm -rf /` | BLOCKED | System file deletion |
| `dd` | BLOCKED | Disk partition overwrite |
| `mkfs` | BLOCKED | Filesystem format |
| `sudo` | CONFIRM | Elevated privileges |
| `chmod 777` | CONFIRM | World-writable files |
| `kill -9` | CONFIRM | Force kill process |

---

## License

MIT

---

## Related

- [QWEN_LOCAL_MODEL_SETUP.md](./QWEN_LOCAL_MODEL_SETUP.md) - Qwen Code configuration guide
- [llama.cpp](https://github.com/ggerganov/llama.cpp) - LLM inference engine
