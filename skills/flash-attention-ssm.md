# Flash Attention & Gated Delta Net

## Triggers
- flash attention, fused attention, gated delta net, SSM, state space model, hybrid architecture, full attention interval, MROPE, sliding window

## Core Concepts

### Flash Attention
Optimized attention implementation that reduces memory usage and increases speed by avoiding materialization of the full attention matrix.

**Standard Attention:**
```
Q × K^T → Attention Matrix (n²) → Softmax → × V → Output
Memory: O(n²) for attention matrix
```

**Flash Attention:**
```
Compute attention in blocks → No full matrix materialization
Memory: O(n) instead of O(n²)
```

**From llama.cpp logs:**
```
sched_reserve: Flash Attention was auto, set to enabled
```

**Benefits:**
- 30-50% faster for long contexts
- Enables larger context sizes
- Reduces VRAM pressure
- Essential for 262K context models

### Gated Delta Net (SSM)
Qwen3.5 uses a **hybrid architecture**: Attention + State Space Model (SSM) layers.

**What is SSM?**
- Recurrent-style processing with constant memory per token
- Unlike attention (O(n) KV cache), SSM uses O(1) memory
- Excellent for very long contexts

**From Qwen3.5 metadata:**
```
qwen35moe.ssm.conv_kernel = 4
qwen35moe.ssm.state_size = 128
qwen35moe.ssm.group_count = 16
qwen35moe.ssm.time_step_rank = 32
qwen35moe.ssm.inner_size = 4096
qwen35moe.full_attention_interval = 4
```

**Hybrid Architecture:**
```
Layer 1: Full Attention    (expensive, captures global context)
Layer 2: Gated Delta Net   (cheap, O(1) memory)
Layer 3: Gated Delta Net   (cheap, O(1) memory)
Layer 4: Gated Delta Net   (cheap, O(1) memory)
Layer 5: Full Attention    (every 4th layer)
...repeats
```

**`full_attention_interval = 4`** means:
- Every 4th layer uses full attention
- Other 3 layers use SSM (Gated Delta Net)
- Balances quality (attention) with efficiency (SSM)

### RS Buffer (Recurrent State)
SSM layers maintain recurrent state between tokens:

```
llama_memory_recurrent: CUDA0 RS buffer size = 251.25 MiB
llama_memory_recurrent: size = 251.25 MiB (4 cells, 40 layers, 4 seqs)
R (f32): 11.25 MiB, S (f32): 240.00 MiB
```

**R vs S:**
- **R**: Per-token recurrent state (small, 11MB)
- **S**: Persistent state across sequence (large, 240MB)
- S stores "memory" of previous tokens in SSM layers

### Fused Operations
```
sched_reserve: resolving fused Gated Delta Net support:
sched_reserve: fused Gated Delta Net (autoregressive) enabled
sched_reserve: fused Gated Delta Net (chunked) enabled
```

**Fused = Combined Operations:**
- Multiple GPU operations merged into single kernel
- Reduces kernel launch overhead
- Improves memory bandwidth utilization

**Autoregressive vs Chunked:**
- **Autoregressive**: Token-by-token generation (used during inference)
- **Chunked**: Batch processing (used during prompt encoding)

### MROPE (Multimodal Rotary Position Embedding)
```
print_info: mrope sections = [11, 11, 10, 0]
```

**What is MROPE?**
- Extends RoPE (Rotary Position Embedding) for multimodal models
- Different sections for different modalities:
  - Section 1 (11 dims): Text
  - Section 2 (11 dims): Text
  - Section 3 (10 dims): Image spatial
  - Section 4 (0 dims): Unused

**Why 4 sections?**
- Qwen3.5 supports image input
- Image tokens need 2D positional encoding (height + width)
- Text tokens use 1D positional encoding

**Total: 11 + 11 + 10 + 0 = 32 dims** (matches `n_rot = 64 / 2`)

### Sliding Window Attention
Some models use sliding window to limit attention range:

**From Gemma-3 metadata:**
```
gemma3.attention.sliding_window = 1024
gemma3.rope.freq_base = 1000000.0
gemma3.rope.freq_base_swa = 10000.0
```

**How it works:**
```
Token attends only to previous 1024 tokens (not full context)
Saves: O(window × n) instead of O(n²)
```

**Dual RoPE frequencies:**
- `freq_base = 1,000,000`: For full attention layers
- `freq_base_swa = 10,000`: For sliding window attention
- Different frequencies optimize for different attention ranges

### Graph Splits
```
sched_reserve: graph splits = 76 (with bs=512), 54 (with bs=1)
```

**What are graph splits?**
- Number of separate GPU kernel launches per forward pass
- More splits = more overhead
- Depends on batch size and model architecture

**Why does it matter?**
- Fewer splits = faster inference
- Batch size 512 → 76 splits (prompt encoding)
- Batch size 1 → 54 splits (token generation)
- MoE models have more splits (expert routing adds complexity)

### Common Pitfalls (Stumps Small Models)
❌ **WRONG**: "Flash Attention reduces quality"  
✅ **CORRECT**: Flash Attention is mathematically equivalent to standard attention; no quality loss

❌ **WRONG**: "SSM replaces attention entirely"  
✅ **CORRECT**: Hybrid uses both; SSM for efficiency, attention for quality (every 4th layer)

❌ **WRONG**: "Sliding window means model can't use full context"  
✅ **CORRECT**: Sliding window limits per-layer attention; global context still captured across layers

❌ **WRONG**: "MROPE is only for images"  
✅ **CORRECT**: MROPE handles multiple modalities; text-only models can still use it (section 4 = 0)

### Performance Characteristics

| Architecture | KV Cache | Speed | Quality |
|--------------|----------|-------|---------|
| Full Attention | O(n) per token | Slow at long context | Best |
| Sliding Window | O(window) | Fast | Good (local context) |
| SSM Only | O(1) | Fastest | Good (no global attn) |
| Hybrid (Qwen3.5) | O(n/4) | Balanced | Best of both |

### RoPE Frequency Scaling
```
qwen35moe.rope.freq_base = 10,000,000  # Qwen3.5
qwen3.rope.freq_base = 1,000,000       # Qwen3
gemma3.rope.freq_base = 1,000,000      # Gemma-3
```

**Higher freq_base = better long-context performance:**
- Extends effective context range
- Reduces positional embedding degradation
- Qwen3.5's 10M enables 262K context quality

### Context Length Scaling
```
qwen35moe.context_length = 262144     # Qwen3.5 trained on 262K
qwen3moe.context_length = 40960       # Qwen3 trained on 40K
gemma3.context_length = 131072        # Gemma-3 trained on 131K
```

**Using beyond trained context:**
```
n_ctx_seq (262144) > n_ctx_train (40960) -- possible training context overflow
```
- May cause quality degradation
- Model hasn't seen such long contexts during training
- Can still work, but results vary

### Troubleshooting
**Problem**: `fused Gated Delta Net not supported`  
**Solution**: Update llama.cpp; older versions don't support SSM fusion

**Problem**: Slow generation despite Flash Attention  
**Solution**: Check if KV cache is on GPU; CPU KV cache bottlenecks regardless of attention type

**Problem**: Model quality degrades at long context  
**Solution**: Check `n_ctx_train`; may be exceeding trained context length

**Problem**: High VRAM usage with SSM  
**Solution**: RS buffer is fixed size; reduce context size or GPU layers

## Safe
true

## Description
Flash Attention optimization, Gated Delta Net SSM, hybrid architectures, MROPE, sliding window, graph splits