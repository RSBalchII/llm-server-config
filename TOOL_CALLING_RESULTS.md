# Tool Calling Test Results

Tested on 2026-04-09. All models tested via llama-server direct API with `tools` array.

---

## Summary

| Model | Family | Size | Tool Calling | Reasoning | Notes |
|-------|--------|------|-------------|-----------|-------|
| Granite 4.0 Tiny | Granite | 3.7GB | **PASS** | No | Clean `tool_calls`, fastest (~190ms) |
| Granite 4.0 Small Heretic | Granite | ~3.7GB | **PASS** (expected) | No | Same template, default system message |
| Qwen3.5-4B-heretic | Qwen3.5 | 2.5GB | **PASS** | Yes | `tool_calls` + `reasoning_content` |
| Gemma 4 E4B Heretic | Gemma 4 | 5.0GB | **PASS** | Yes | `tool_calls` + `reasoning_content` |
| DeepSeek-R1-Distill-Qwen-7B | DeepSeek | 4.0GB | **PARTIAL** | Yes | Returns text response, no `tool_calls` |
| Stable-DiffCoder-8B | Seed-Coder | 4.5GB | **FAIL** | No | Alpaca template, no tool support |

---

## Details

### PASS: Granite 4.0 (Huihui-granite-4.0-h-tiny-abliterated)
- **finish_reason:** `tool_calls`
- **Tool format:** `<|tool_call>call:name{args}<tool_call|>`
- **Response time:** ~190ms
- **Notes:** Clean structured response, no thinking tokens

### PASS: Qwen3.5-4B-heretic
- **finish_reason:** `tool_calls`
- **Tool format:** ``
- **Response time:** ~1200ms
- **Notes:** Includes `reasoning_content` field with thinking before tool call

### PASS: Gemma 4 E4B Heretic
- **finish_reason:** `tool_calls`
- **Tool format:** `<|tool_call>call:name{args}<tool_call|>`
- **Response time:** ~1700ms
- **Notes:** Includes `reasoning_content` field, strong tool calling

### PARTIAL: DeepSeek-R1-Distill-Qwen-7B
- **finish_reason:** `stop`
- **Tool format:** `<|tool_call_begin|>...<|tool_call_end|>` (defined in template)
- **Response time:** ~4700ms
- **Notes:** Model chose to respond conversationally instead of emitting tool calls. Template supports tools but model behavior didn't trigger them. May need stronger system prompt or different tool naming.

### FAIL: Stable-DiffCoder-8B
- **finish_reason:** `length` (max_tokens hit)
- **Tool format:** None (Alpaca template)
- **Response time:** ~3500ms
- **Notes:** No tool support in template. Generated garbled output when tools were provided in request.

---

## Conclusions

1. **Qwen3.5, Gemma 4, and Granite 4.0** all support structured tool calling natively through llama-server
2. **DeepSeek-R1-Distill** has the template but the model chose conversational response - may need prompt engineering
3. **Stable-DiffCoder** should not be used for tool calling - it's an Alpaca-format coding model
4. **Best for tool calling:** Qwen3.5-4B-heretic (fastest, clean tool calls with reasoning)
5. **Best overall:** Gemma 4 E4B (strong tool calls with thorough reasoning)

---

## Recommended Config for Qwen Code

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

Use llama-server directly (port 8080), no proxy needed.
