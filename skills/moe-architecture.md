# MoE (Mixture of Experts) Architecture

## Triggers
- MoE, mixture of experts, expert routing, A3B, active parameters, sparse model, expert count, gated delta net, REAP, expert pruning, Cerebras REAP, Qwen3-Next, GDN, hybrid architecture

## Core Concepts

### What is MoE?
Mixture of Experts models have **total params >> active params per forward pass**. Only a subset of "expert" networks activate per token.

**Example: Qwen3.5-35B-A3B**
- **35B total parameters** (sounds huge)
- **3B active parameters** per token (what actually computes)
- **256 experts total**, uses **8 experts per token**
- Speed ~8B model, quality ~35B model

### Key Metrics
| Metric | Description | Example (Qwen3.5-35B-A3B) |
|--------|-------------|---------------------------|
| `n_expert` | Total expert networks | 256 |
| `n_expert_used` | Experts per token | 8 |
| `n_ff_exp` | FFN size per expert | 768 |
| `n_ff` | Shared FFN size | 0 (MoE has none) |
| `expert_shared_ff` | Router/shared FFN | 512 |

### Why MoE Matters for Local LLM
1. **VRAM Efficiency**: Only dense layers + active experts load to GPU
2. **Quality/Speed Trade**: Near-35B quality at ~8B inference cost
3. **Context Checkpointing**: MoE models use context checkpoints every 8K tokens

### GPU Layer Offloading for MoE
```
# MoE fitting strategy (llama.cpp):
1. All repeating layers to GPU first
2. Dense-only layers fill remaining VRAM
3. Overflow experts stay on CPU (activate on-demand)
```

**Fitting Output Explained:**
```
llama_params_fit_impl:
  - CUDA0: 41 layers (26 overflowing), 13764 MiB used, 1057 MiB free
```
- **41 layers total**, but 26 overflow to system RAM
- **13.7GB VRAM used**, leaves 1GB free for KV cache
- **Still fast** because MoE only loads active experts

### Common Pitfalls (Stumps Small Models)
❌ **WRONG**: "MoE model too large for GPU"  
✅ **CORRECT**: MoE fits because only active experts load; overflow experts don't impact per-token cost

❌ **WRONG**: "35B needs 35B VRAM"  
✅ **CORRECT**: Only ~15GB VRAM needed for 35B-A3B MoE (dense layers + 8 experts)

❌ **WRONG**: "All layers on GPU = faster"  
✅ **CORRECT**: For MoE, dense layers on GPU + overflow experts on CPU is optimal

### Expert Routing Flow
```
Token Input → Router Network → Select Top-8 Experts → Route to Experts → Combine Outputs
```

The router is a small neural network that learns which experts are relevant per token.

### GGUF Metadata Keys (MoE)
```
qwen35moe.expert_count = 256          # Total experts
qwen35moe.expert_used_count = 8       # Active per token
qwen35moe.expert_feed_forward_length = 512
qwen35moe.expert_shared_feed_forward_length = 512
qwen35moe.full_attention_interval = 4  # Every 4th layer uses full attn
```

### Performance Characteristics
| Operation | MoE vs Dense | Why |
|-----------|--------------|-----|
| Prompt Encoding | Similar speed | All tokens encode, routing happens after |
| Token Generation | Faster than dense of same size | Only 8 experts compute vs full 35B |
| Memory Bandwidth | Lower than dense | Smaller active weight set |
| KV Cache | Same as dense | Depends on embedding size, not experts |

### REAP (Router-weighted Expert Activation Pruning)
**What is REAP?**
- Prunes least-used experts from MoE models
- Preserves active params/tok (only total params decrease)
- Uses calibration data to score experts by importance

**Example: Gemma-4-19B-A4B-REAP**
- Original: 26B-A4B, 128 experts/layer, 48 layers
- REAP 0.30: 19B-A4B, 90 experts/layer, 30 layers
- Active params/tok: ~4B (unchanged!)
- Experts/tok: 8 (unchanged!)

**How REAP Works:**
1. **Calibration**: Run model on 22K diverse samples
2. **Scoring**: Score experts by router gate values + activation norms
3. **Pruning**: Remove lowest-scoring 30% (38 of 128 per layer)
4. **Renormalization**: Adjust router logits to work with remaining experts

**REAP Quality Impact:**
| Task | Original | REAP 0.30 | Change |
|------|----------|-----------|--------|
| Elementary Math | 92% | 88% | -4% |
| College CS | 56% | 68% | +12%! |
| Philosophy | 92% | 74% | -18% |
| Long context loops | 50% | 0% | Fixed! |

**Why REAP is Smart:**
- Removes redundant experts, not critical ones
- Router still selects 8 experts from remaining pool
- VRAM savings from fewer total experts + fewer layers
- Can improve some tasks (College CS improved 12%!)

**REAP vs Standard MoE:**
| Aspect | Standard MoE | REAP-Pruned MoE |
|--------|--------------|-----------------|
| Total params | Full (e.g., 26B) | Reduced (e.g., 19B) |
| Active params/tok | Unchanged (e.g., 4B) | Unchanged (e.g., 4B) |
| Experts/layer | Full (e.g., 128) | Pruned (e.g., 90) |
| VRAM usage | Higher | Lower |
| Quality | Baseline | ~85-95% retained |
| Speed | Same | Same or faster (fewer layers) |

### Qwen3-Next: Next-Gen Hybrid Architecture
**Completely new architecture** (not just pruned Qwen3.5):
- Base: Qwen3-Next-80B-A3B-Thinking → REAP to 15B
- **81.25% expert pruning**: 512 → 96 experts/layer
- **10 active experts** (vs 8 in Qwen3.5)
- Hybrid layout: `12x(3x(GDN→MoE) → 1x(Attn→MoE))`
- Gated DeltaNet (SSM): 32 linear attn heads for V, 16 for QK
- Gated Attention: 16 Q heads, 2 KV heads, full attn every 4th layer
- Context: **262K native, 1M extensible**
- MXFP4_MOE quantization: novel microscaling format

### Troubleshooting
**Problem**: `cannot meet free memory target`
**Solution**: MoE models need less VRAM than size suggests; reduce context size or use `auto` GPU layers

**Problem**: Slow generation despite MoE
**Solution**: Check if KV cache is on GPU; CPU KV cache bottlenecks MoE routing

**Problem**: Model loads but errors on generation
**Solution**: MoE requires VMM (Virtual Memory Management); ensure CUDA device supports it (`VMM: yes` in startup log)

## Safe
true

## Description
MoE architecture understanding: expert routing, active params, VRAM fitting for sparse models