# LLM Server Config

Configuration files and scripts for running local LLM servers with llama.cpp and Qwen Code CLI.

## Files

- **start-llama-server.bat** - Windows batch script to launch llama.cpp server with Qwen 3.5 9B model
- **QWEN_LOCAL_MODEL_SETUP.md** - Comprehensive guide for configuring Qwen Code with local models and maximum context limits

## Quick Start

1. Clone this repo
2. Edit `start-llama-server.bat` to point to your model path
3. Run the batch file to start the server
4. Follow the setup guide to configure Qwen Code

## Context Limits

This configuration is optimized for **262,144 token context** (256K) with Qwen 3.5 9B models.

See `QWEN_LOCAL_MODEL_SETUP.md` for detailed configuration instructions.
