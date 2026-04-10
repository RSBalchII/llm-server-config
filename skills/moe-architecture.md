# MoE (Mixture of Experts) Architecture

## Triggers
- MoE, mixture of experts, expert routing, A3B, active parameters, sparse model, expert count, gated delta net

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