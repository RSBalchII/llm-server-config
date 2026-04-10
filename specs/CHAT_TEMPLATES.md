# Chat Template Reference

Templates for all supported models.

llama-server auto-detects the template from the GGUF metadata.

---

## Template Index

| Model Family | Template Name | Tool Format | Thinking |
|-------------|--------------|-------------|----------|
| Granite 4.0 (Tiny) | `granite` | `<|tool_call>call:name{args}<tool_call|>` | No |
| Granite 4.0 (Small Heretic) | `granite` (same) | `<|tool_call>call:name{args}<tool_call|>` | No |
| Gemma 4 | `gemma` | `<|tool_call>call:name{args}<tool_call|>` | Yes (`<channel>thought`) |
| DeepSeek Distill | `deepseek-r1` | `<|tool_call_begin|>type<|tool_sep|>name + json<|tool_call_end|>` | Yes |
| Qwen3 / Qwen3.5 | `qwen3` | `` | Yes |
| Seed-Coder | `alpaca` (fallback) | None | No |

---

## Granite 4.0

**Models:**
- `Huihui-granite-4.0-h-tiny-abliterated.i1-Q4_K_S.gguf` (3.7GB)
- `mradermacher/granite-4.0-h-small-heretic_lo-i1-GGUF` (Small Heretic variant)

Both use the same `granite` template. The Small Heretic variant includes a default system message.

### Role Markers

- `<|start_of_role|>role<|end_of_role|>content<|end_of_text|>`

### Tool Format

    <|tool_call>call:list_directory{"path": "."}<tool_call|>

### System Message

If no system message is provided, the Heretic variant defaults to:

    You are a helpful assistant. Please ensure responses are professional, accurate, and safe.

### Tool Responses in User Messages

    ...

### Why Granite is Fast

Granite uses a hybrid architecture combining attention layers with SSM (State Space Model) Gated Delta Net layers. This makes inference significantly faster than pure attention models of similar size. The KV cache is minimal compared to MoE models.

---

## Gemma 4

**Models:** `gemma-4-26B-A4B-it-UD-Q4_K_S`, `gemma-4-E4B-it-Heretic-ARA-Refusals5_Q4_K_M`

### Structure

- BOS: `<s>`
- Turn: `<|turn>role\n...<turn|>\n`
- Tool: `<|tool_call>call:name{args}<tool_call|>`
- Tool Response: `<|tool_response>response:name{value:...}<tool_response|>`
- Thinking: `<|channel>thought\n<channel|>`

---

## DeepSeek-R1 Distill

**Models:** `DeepSeek-R1-Distill-Qwen-7B-abliterated`, `DeepSeek-R1-0528-Qwen3-8B`, `DeepSeek-R1-Distill-Llama-8B`

### Structure

- User: `<|User|>content`
- Assistant: `<|Assistant|>content<|end_of_sentence|>`
- Tool Call: `<|tool_call_begin|>type<|tool_sep|>name` + json block + `<|tool_call_end|>`
- Tool Response: `<|tool_output_begin|>content<|tool_output_end|>`
- Thinking: `<think>
</think>

</think>

---

## Qwen3 / Qwen3.5

**Models:** `Qwen3.5-4B-heretic`, `Qwen3.5-4B-heretic-v2`, `Qwen3-8B-DeepSeek-v3.2-Speciale-Distill`, `Qwen3-30B-A3B-abliterated-erotic`, `Qwen3-Coder-30B-A3B-Instruct-Heretic`

### Structure

- Role markers: `[START_INST]role\ncontent[END_INST]`
- Tool: `[START_TOOL_CALL]{"name": "name", "arguments": args}[END_TOOL_CALL]`
- Tool Response: `[START_TOOL_RESULT]\ncontent\n[END_TOOL_RESULT]`
- Thinking: `\n\n\n\ncontent` (content between  tags is thinking/reasoning)

### Key Tokens

| Token | Purpose |
|-------|---------|
| `[START_INST]` / `[END_INST]` | Role delimiters |
| `[START_TOOL_CALL]` / `[END_TOOL_CALL]` | Tool call wrapper |
| `[START_TOOL_RESULT]` / `[END_TOOL_RESULT]` | Tool output wrapper |
| `\n` | Begin thinking |
| `\n` | End thinking |

### Example Tool Call

    [START_INST]assistant[END_INST]
    [START_TOOL_CALL]{"name": "list_directory", "arguments": {"path": "."}}[END_TOOL_CALL]

### Example Tool Response

    [START_INST]user[END_INST]
    [START_TOOL_RESULT]
    file1.txt
    file2.py
    [END_TOOL_RESULT]

---

## Seed-Coder (Alpaca Fallback)

**Models:** `Stable-DiffCoder-8B-Instruct.i1-Q4_K_S.gguf`

### Structure

- System: `[INST]system\nYou are an AI programming assistant...\n[/INST]`
- User: `[INST]user\ncontent\n[/INST]`
- Assistant: `[INST]assistant\ncontent\n[/INST]`

### Notes

- No tool calling support in this template
- Simple instruction-following format only
- Best used for coding tasks without tool requirements

---

## Notes

- llama-server auto-detects templates from GGUF metadata
- When loading a model, check the startup logs for "chat template:" to see which template was detected
- If no template is found, llama-server falls back to a basic format
- Tool calling support depends on the model having the correct template metadata in the GGUF file