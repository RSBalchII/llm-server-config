# Chat Template Reference

Templates for all supported models. llama-server auto-detects from GGUF metadata.

---

## Template Index

| Model Family | Template | Tool Format | Thinking |
|-------------|----------|-------------|----------|
| Granite 4.0 | `granite` | `<|tool_call>call:name{args}<tool_call|>` | No |
| Gemma 4 (26B) | `gemma4` | `<|tool_call>call:name{args}<tool_call|>` | Yes |
| Gemma 4 REAP (19B) | `gemma4-reap` | `<|tool_call>call:name{args}<tool_call|>` | Yes |
| DeepSeek Distill (7B) | `deepseek-r1` | See below | Yes |
| DeepSeek Distill (14B) | `deepseek-r1-qwen` | See below | Yes |
| Qwen3 / Qwen3.5 | `qwen3` | See below | Yes |
| Qwen3.5-18B-Coding-Heretic | `qwen35` | See below | Yes |
| Seed-Coder | `alpaca` | None | No |

---

## Granite 4.0

**Models:** `Huihui-granite-4.0-h-tiny-abliterated.i1-Q4_K_S.gguf`

### Structure
- Role: `<|start_of_role|>role<|end_of_role|>content<|end_of_text|>`
- Tool: `<|tool_call>call:name{args}<tool_call|>`

---

## Gemma 4 (26B)

**Models:** `gemma-4-26B-A4B-it-heretic.IQ4_XS`, `gemma-4-E4B-it-Heretic-ARA-Refusals5_Q4_K_M`

### Specs
- Experts/layer: 128, Experts/tok: 8, Layers: 48
- Context: 262K, Embedding: 3840
- Sliding window: 1024, Full attn: every 6th layer

### Structure
- BOS: `<s>`, Turn: `<|turn>role\n...\n<turn|>`
- Tool: `<|tool_call>call:name{args}<tool_call|>`
- Thinking: `<|channel>thought\n<channel|>`

---

## Gemma 4 REAP (19B)

**Models:** `gemma-4-19b-a4b-it-REAP.i1-Q4_K_S`

### Specs
- Experts/layer: 90 (pruned from 128), Experts/tok: 8
- Layers: 30, Context: 262K, Embedding: 2816
- 30% expert pruning via Cerebras REAP
- VRAM: ~9-10GB (vs 13-14GB for 26B)

### Structure
Same as Gemma 4, just fewer layers.

---

## DeepSeek-R1 Distill (7B)

**Models:** `DeepSeek-R1-Distill-Qwen-7B-abliterated-obliteratus.IQ4_XS`

### Specs
- Dense Qwen2, 7B params, 28 layers
- Embedding: 3584, Context: 131K
- RoPE freq_base: 10,000

### Structure
- BOS: `<|begin▁of▁sentence|>` (ID: 151646)
- User: `<|User|>content`, Assistant: `<|Assistant|>content<|end▁of▁sentence|>`
- Tool: `<|tool_call_begin|>function<|tool_sep|>name + json<|tool_call_end|>`
- Thinking: `` -> content -> ``

---

## DeepSeek-R1 Distill (14B Heretic)

**Models:** `DeepSeek-R1-Distill-Qwen-14B-heretic.Q4_K_S`

### Specs
- Dense Qwen2, 14B params, 48 layers
- Embedding: 5120, Context: 131K
- RoPE freq_base: 1,000,000 (better long-context)
- Size: 8.57GB, VRAM: ~18-20GB (needs offloading for 16GB GPU)

### Structure
Same template as 7B. Same token IDs.

---

## Qwen3 / Qwen3.5

**Models:** `Qwen3.5-4B-heretic`, `Qwen3-30B-A3B-abliterated-erotic`

### Structure
- System: `[START_INST]system\ncontent[END_INST]`
- User: `[START_INST]user\ncontent[END_INST]`
- Assistant: `[START_INST]assistant\ncontent[END_INST]`
- Tool: `[START_TOOL_CALL]{"name":"name","arguments":{}}[END_TOOL_CALL]`
- Thinking: `` -> content -> ``

### Key Tokens
- `[START_INST]` / `[END_INST]`: Role delimiters
- `[START_TOOL_CALL]` / `[END_TOOL_CALL]`: Tool wrapper
- `` / ``: Thinking markers

---

## Qwen3.5-18B-A3B-REAP-Coding-Heretic

**Model:** `qwen3.5-18b-a3b-reap-coding-heretic-v0.i1-Q4_K_S.gguf`

### Architecture
| Spec | Value | Notes |
|------|-------|-------|
| Total params | 19B | From 35B-A3B |
| Active params/tok | ~3B | MoE sparse |
| Experts/layer | 128 | NOT pruned |
| Experts/tok | 8 | Unchanged |
| Layers | 40 | Same as 35B |
| Embedding | 2048 | Same as 35B |
| KV heads | 2 | GQA |
| Context | 262K | Same |
| RoPE freq_base | 10,000,000 | Excellent |
| Full attn interval | Every 4th layer | Hybrid SSM |
| Quantization | Q4_K_S (i1) | Imatrix |
| Size | 10.7GB | Larger |
| Imatrix | 510 entries, 319 chunks | Excellent |

### Heretic Details
- **Source:** Flagstone8878/Qwen3.5-18B-REAP-A3B-Coding
- **Abliteration:** tvall43, Trial 34
- **Refusals:** 15/100 (85% compliance)
- **KL divergence:** 0.0690 (minimal loss)

### 18B Coding vs 14B Claude
| Aspect | 18B Coding | 14B Claude |
|--------|-----------|------------|
| Experts/layer | 128 (full) | 93 (pruned) |
| Specialization | Code | Reasoning |
| Imatrix | 510/319 | Not listed |
| Size | 10.7GB | 8.84GB |
| Heretic | Yes | No |

### Chat Template
Complex Qwen3.5 format:
- System with tool definitions
- User/Assistant with `` markers
- Tool calls: `