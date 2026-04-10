# KV Cache & VRAM Management

## Triggers
- KV cache, VRAM, context size, n_ctx, CUDA memory, VMM, virtual memory, offloading, GPU layers, memory pressure, checkpoint

## Core Concepts

### What is KV Cache?
The Key-Value cache stores attention keys and values for all previous tokens, enabling efficient autoregressive generation without recomputing.

**Memory Cost:**
```
KV Cache (bytes) = n_layers × n_seq × n_ctx × n_head_kv × head_dim × 2 (K+V) × 2 (f16)
```

### KV Cache Sizing Examples

**Qwen3.5-35B-A3B @ 262K context:**
```
KV Cache: 5120 MiB (262144 cells, 10 layers, 4/1 seqs)
K (f16): 2560 MiB, V (f16): 2560 MiB
```

**Qwen3-30B-A3B @ 262K context:**
```
KV Cache: 24576 MiB (262144 cells, 48 layers, 4/1 seqs)
K (f16): 12288 MiB, V (f16): 12288 MiB
```

**Why the huge difference?**
- Qwen3.5: Only 10 layers on GPU (MoE overflow on CPU)
- Qwen3: All 48 layers would be on GPU, massive KV cache
- **KV cache scales with GPU layers, not total layers**

### VRAM Budget Breakdown
```
Total VRAM = Model Weights (GPU) + KV Cache + Compute Buffers + Overhead
```

**Example: Qwen3.5-35B-A3B (16GB GPU)**
| Component | VRAM Usage | Notes |
|-----------|------------|-------|
| Model Weights | 7,589 MiB | Dense layers + some experts |
| KV Cache | 5,120 MiB | 262K context, 10 GPU layers |
| Compute Buffer | 804 MiB | Activation memory |
| **Total** | **~13.5 GB** | Fits in 16GB with 2.5GB headroom |

### Context Checkpointing
For very long contexts, llama.cpp creates checkpoints to avoid recomputing from scratch.

**From logs:**
```
created context checkpoint 1 of 32 (pos_min = 8191, pos_max = 8191, n_tokens = 8192, size = 62.813 MiB)
created context checkpoint 5 of 32 (pos_min = 40959, pos_max = 40959, n_tokens = 40960, size = 62.813 MiB)
```

**How it works:**
1. Every 8K tokens → create checkpoint
2. Checkpoint stores KV state at that position
3. Future requests can resume from nearest checkpoint
4. Max 32 checkpoints per slot

**Checkpoint Memory:**
```
Each checkpoint ≈ 62.8 MiB (fixed size)
32 checkpoints × 62.8 MiB ≈ 2 GB total
```

### VMM (Virtual Memory Management)
```
Device 0: NVIDIA GeForce RTX 4090 Laptop GPU, compute capability 8.9, VMM: yes
```

**What VMM enables:**
- Oversubscribe GPU memory (use more than physical VRAM)
- Automatically page memory to system RAM when needed
- Critical for MoE models with expert overflow

**Without VMM:**
- Strict VRAM limits → OOM errors
- Cannot use models larger than VRAM
- Manual memory management required

### GPU Layer Offloading Strategies

**Strategy 1: All Layers on GPU (`max`)**
```
load_tensors: offloaded 41/41 layers to GPU
CUDA0 model buffer size = 7589.49 MiB
```
- Best for models that fit in VRAM
- Fastest inference
- Example: Qwen3.5-4B (2.5GB) → all 41 layers on GPU

**Strategy 2: Auto Balance (`auto`)**
```
llama_params_fit_impl:
  - CUDA0: 41 layers (26 overflowing), 13764 MiB used, 1057 MiB free
```
- llama.cpp fits layers to available VRAM
- Overflow layers on CPU (paged on-demand)
- Best for models near VRAM limit
- Example: Qwen3.5-35B-A3B (17GB) → 15 layers on GPU, 26 overflow

**Strategy 3: Min/Custom**
```
GPU layers: 10 (custom)
```
- User-specified layer count
- Useful for fine-tuning VRAM usage
- Leaves room for larger KV cache

### Common Pitfalls (Stumps Small Models)
❌ **WRONG**: "More GPU layers = always faster"  
✅ **CORRECT**: MoE models benefit from leaving experts on CPU; only active experts load per token

❌ **WRONG**: "KV cache size = context size × constant"  
✅ **CORRECT**: KV cache scales with GPU layers × context × attention heads

❌ **WRONG**: "Context checkpointing saves memory"  
✅ **CORRECT**: Checkpoints use EXTRA memory (62MB each); they save compute, not memory

❌ **WRONG**: "VMM makes models faster"  
✅ **CORRECT**: VMM enables models > VRAM but paged memory is slower than VRAM

### Memory Pressure Indicators

**Healthy:**
```
llama_params_fit: successfully fit params to free device memory
CUDA0: 13764 MiB used, 1057 MiB free
```

**Warning:**
```
llama_params_fit_impl: cannot meet free memory target of 1024 MiB
need to reduce device memory by 4853 MiB
```

**Critical:**
```
llama_params_fit: failed to fit params to free device memory
n_gpu_layers already set by user to -2, abort
```

### Reducing VRAM Usage

**1. Reduce Context Size:**
```
--ctx-size 32768    # 32K instead of 262K
```
- Saves: ~17GB → ~1GB KV cache for 30B model

**2. Reduce GPU Layers:**
```
--gpu-layers 20     # Instead of 41
```
- Moves more layers to CPU
- Slower but fits in VRAM

**3. Reduce Parallel Slots:**
```
--parallel 1        # Instead of 4
```
- KV cache per slot → fewer slots = less cache
- Only one request at a time

### KV Cache Placement (CPU vs GPU)
```
# All on GPU (fastest):
llama_kv_cache: CUDA0 KV buffer size = 5120.00 MiB

# Split CPU/GPU (memory pressure):
llama_kv_cache: CPU KV buffer size = 12800.00 MiB
llama_kv_cache: CUDA0 KV buffer size = 11776.00 MiB
```

**Split happens when:**
- VRAM full → KV cache overflows to CPU
- Slower (PCIe transfer overhead)
- Necessary for large context + large models

### RS Buffer (Recurrent State)
```
llama_memory_recurrent: CUDA0 RS buffer size = 251.25 MiB
llama_memory_recurrent: size = 251.25 MiB (4 cells, 40 layers, 4 seqs)
R (f32): 11.25 MiB, S (f32): 240.00 MiB
```

**What is RS buffer?**
- Used for SSM (State Space Model) layers
- Qwen3.5 uses Gated Delta Net (hybrid attention + SSM)
- Stores recurrent state between tokens
- Much smaller than KV cache (251MB vs 5GB)

### Performance Impact
| Configuration | Prompt Speed | Gen Speed | VRAM |
|--------------|--------------|-----------|------|
| All GPU, 262K | 280 tok/s | 25 tok/s | 13.5GB |
| Split CPU/GPU, 262K | 250 tok/s | 22 tok/s | 16GB+ |
| All GPU, 32K | 300 tok/s | 28 tok/s | 8GB |
| Auto-fit, 262K | 260 tok/s | 24 tok/s | 14GB |

### Troubleshooting
**Problem**: `context checkpoint size = 62.813 MiB` eating memory  
**Solution**: Reduce `--cache-ram` or use `--cache-ram 0` to disable cache

**Problem**: KV cache on CPU → slow generation  
**Solution**: Reduce context size or GPU layers to fit KV cache on GPU

**Problem**: VMM not available → cannot load large models  
**Solution**: Need compute capability 8.0+ GPU (RTX 30xx or newer)

**Problem**: `n_ctx_seq > n_ctx_train` warning  
**Solution**: Model may behave poorly beyond trained context; reduce to training size

## Safe
true

## Description
KV cache management, VRAM budgeting, context checkpointing, VMM, GPU layer offloading strategies