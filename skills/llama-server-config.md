# llama-server Configuration & Optimization

## Triggers
- llama-server, server config, n_ctx, n_gpu_layers, batch size, threads, parallel slots, prompt cache, context size, port binding

## Core Concepts

### llama-server Command Structure
```bash
llama-server \
  --model model.gguf \              # Model file
  --ctx-size 262144 \               # Context window (tokens)
  --n-gpu-layers 41 \               # Layers on GPU (or 'max'/'auto')
  --port 18080 \                    # HTTP port
  --threads 24 \                    # CPU threads
  --threads-batch 24 \              # Threads for batch processing
  --batch-size 2048 \               # Prompt batch size
  --ubatch-size 512 \               # Micro-batch size
  --parallel 4 \                    # Parallel request slots
  --flash-attn \                    # Enable flash attention
  --cache-reuse 256 \               # Cache reuse threshold
  --cache-ram 8192                  # Prompt cache RAM limit (MB)
```

### Key Parameters Explained

#### `--ctx-size` (Context Window)
- **Default**: 4096 tokens
- **Recommended**: Match model's `n_ctx_train`
- **Your models**:
  - Qwen3.5-35B-A3B: 262144 (trained on 262K)
  - Qwen3-30B-A3B: 40960 (trained on 40K)
  - Qwen3.5-4B: 131072 (trained on 131K)

⚠️ **Using beyond trained context degrades quality**

#### `--n-gpu-layers` (GPU Offloading)
| Value | Behavior | Use Case |
|-------|----------|----------|
| `-1` or `max` | All layers on GPU | Models that fit in VRAM |
| `0` | CPU only | No GPU available |
| `auto` | llama.cpp decides | Recommended for large models |
| `N` (number) | N layers on GPU | Fine-tuned control |

#### `--batch-size` vs `--ubatch-size`
- **batch-size**: Total tokens processed per prompt pass
  - Higher = faster prompt encoding
  - More VRAM usage
  - Default: 2048
  
- **ubatch-size**: Micro-batch for computation
  - Controls memory per kernel launch
  - Affects graph splits
  - Default: 512

**From your logs:**
```
n_batch = 2048    # Batch size
n_ubatch = 512    # Micro-batch
graph splits = 76 (with bs=512), 54 (with bs=1)
```

#### `--parallel` (Concurrent Slots)
- Number of simultaneous requests
- Each slot has its own context window
- KV cache multiplies by slot count

**From your logs:**
```
n_seq_max = 4
n_parallel is set to auto, using n_parallel = 4
```

**Memory impact:**
```
Total KV Cache = per_slot_cache × parallel_slots
```
With 4 slots @ 262K context: 4× KV cache memory

#### `--threads` (CPU Threads)
- Threads for non-GPU operations
- Match physical CPU cores (not logical/hyperthreaded)
- Default: auto-detect

**From your logs:**
```
n_threads = 24 (n_threads_batch = 24) / 32
```
- 24 threads used (likely physical cores)
- 32 total threads available (with hyperthreading)

### Prompt Cache
Caches prompt encodings to avoid recomputation for similar requests.

```
srv load_model: prompt cache is enabled, size limit: 8192 MiB
srv load_model: use `--cache-ram 0` to disable the prompt cache
```

**How it works:**
1. First request: encode prompt, store in cache
2. Similar request: reuse cached encoding
3. Cache evicts oldest entries when full

**Memory usage:**
- Each cached prompt ≈ 62.8 MiB (matches checkpoint size)
- 8192 MiB limit → ~130 cached prompts max

**Disable if:**
- Memory constrained
- Requests are always unique
- Using context checkpointing already

### Port Binding & HTTP Server
```
main: server is listening on http://127.0.0.1:18080
init: using 31 threads for HTTP server
```

**Multi-threaded HTTP:**
- Separate thread pool for request handling
- Doesn't interfere with inference threads
- Handles concurrent connections efficiently

**CORS Configuration:**
```javascript
// Your server-v3.js adds:
'Access-Control-Allow-Origin': '*'
'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
'Access-Control-Allow-Headers': 'Content-Type, Authorization'
```

### Startup Log Interpretation

**System Info:**
```
system_info: n_threads = 24 / 32 | CUDA : ARCHS = 890 | USE_GRAPHS = 1 | 
PEER_MAX_BATCH_SIZE = 128 | CPU : SSE3 = 1 | SSSE3 = 1 | AVX = 1 | AVX2 = 1 | 
F16C = 1 | FMA = 1 | LLAMAFILE = 1 | OPENMP = 1 | REPACK = 1
```
- `ARCHS = 890`: CUDA compute capability 8.9 (RTX 4090)
- `USE_GRAPHS = 1`: Graph optimization enabled
- `LLAMAFILE = 1`: llamafile support compiled in
- CPU features: AVX2, FMA, F16C (good for non-GPU ops)

**Model Loading:**
```
load_tensors: offloaded 41/41 layers to GPU
CUDA0 model buffer size = 7589.49 MiB
CPU_Mapped model buffer size = 17377.28 MiB
```
- First line: GPU layers count
- Second line: VRAM usage
- Third line: System RAM (CPU layers + mmap)

**Slot Initialization:**
```
srv load_model: initializing slots, n_slots = 4
slot load_model: id 0 | new slot, n_ctx = 262144
slot load_model: id 1 | new slot, n_ctx = 262144
slot load_model: id 2 | new slot, n_ctx = 262144
slot load_model: id 3 | new slot, n_ctx = 262144
```

### Common Pitfalls (Stumps Small Models)
❌ **WRONG**: "Higher batch size = always faster"  
✅ **CORRECT**: Batch size limited by VRAM; too high = OOM errors

❌ **WRONG**: "Parallel = faster for single user"  
✅ **CORRECT**: Parallel helps concurrent requests, not single-user latency

❌ **WRONG**: "Threads should match logical cores"  
✅ **CORRECT**: Use physical cores; hyperthreading doesn't help inference

❌ **WRONG**: "Prompt cache saves VRAM"  
✅ **CORRECT**: Prompt cache uses SYSTEM RAM, not VRAM

### Performance Tuning Guide

**For Speed (Single User):**
```bash
--n-gpu-layers max        # All layers on GPU
--batch-size 4096         # Large batches
--parallel 1              # Single slot
--threads <physical_cores>
```

**For Throughput (Multi-User):**
```bash
--n-gpu-layers auto       # Leave room for KV cache
--batch-size 2048         # Moderate batches
--parallel 4              # Multiple slots
--cache-reuse 256         # Enable prompt cache
```

**For Memory-Constrained Systems:**
```bash
--n-gpu-layers 20         # Fewer GPU layers
--ctx-size 8192           # Smaller context
--parallel 1              # Single slot
--cache-ram 0             # Disable prompt cache
```

### Environment Variables
```bash
# CUDA optimization
CUDA_VISIBLE_DEVICES=0           # Which GPU to use
LLAMA_CUDA_NO_PEER=1             # Disable P2P (single GPU)

# Memory tuning
LLAMA_KV_CACHE_REUSE=1           # Enable KV cache reuse
LLAMA_METAL_PERF_HINT=HIGH       # Metal (Mac) performance hint
```

### Troubleshooting
**Problem**: `binding port with default address family`  
**Solution**: Normal info message; server binding to IPv4/IPv6

**Problem**: `n_parallel is set to auto`  
**Solution**: llama.cpp detected CPU cores; chose parallel count automatically

**Problem**: Slot context capped below requested  
**Solution**: `n_ctx_seq > n_ctx_train` → llama.cpp caps to training size

**Problem**: Slow first request, fast subsequent requests  
**Solution**: Prompt cache working as expected; warm-up behavior

**Problem**: High CPU usage during generation  
**Solution**: Check GPU layers; some ops always run on CPU (sampling, etc.)

### API Endpoints
```
GET  /health                          # Health check
GET  /v1/models                       # List models
POST /v1/chat/completions             # Chat completions
POST /v1/completions                  # Legacy completions
GET  /metrics                         # Prometheus metrics
POST /slots/<id>?action=erase         # Clear slot context
```

### Metrics Endpoint
```bash
curl http://127.0.0.1:18080/metrics
```

**Key metrics:**
- `prompt_tokens_total`: Total prompt tokens processed
- `generation_tokens_total`: Total generated tokens
- `time_prompt_processing_ms`: Prompt encoding time
- `time_generation_ms`: Token generation time
- `slots_active`: Active slot count
- `kv_cache_usage_percent`: KV cache utilization

## Safe
true

## Description
llama-server configuration, optimization, batch sizing, parallel slots, prompt cache, performance tuning