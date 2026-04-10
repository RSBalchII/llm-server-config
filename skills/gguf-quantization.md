# GGUF Quantization Formats

## Triggers
- quantization, Q4_K_M, IQ4_XS, Q5_K_S, Q6_K, GGUF, bits per weight, BPW, quantize, imatrix, calibration

## Core Concepts

### What is Quantization?
Reducing model weight precision from FP16 (16-bit) to lower bit-widths to save VRAM and speed up inference.

### GGUF Quantization Types (Common in Your Models)

| Format | BPW | Size (7B) | Size (35B) | Quality | Use Case |
|--------|-----|-----------|------------|---------|----------|
| `IQ4_XS` | 4.25 | ~4.0GB | ~15-17GB | ★★★★☆ | Best quality/size ratio |
| `Q4_K_M` | 4.5 | ~4.3GB | ~18GB | ★★★★☆ | Balanced, widely available |
| `Q5_K_S` | 5.0 | ~4.8GB | ~20GB | ★★★★★ | Near-FP16 quality |
| `Q5_K_M` | 5.1 | ~4.9GB | ~21GB | ★★★★★ | Highest practical quality |
| `Q6_K` | 6.0 | ~5.7GB | ~24GB | ★★★★★ | Best quality, large size |
| `IQ3_S` | 3.5 | ~3.3GB | ~13GB | ★★★☆☆ | Size-constrained scenarios |

### Key Metrics Explained

**BPW (Bits Per Weight):**
- Average bits per model parameter
- Lower = smaller file, more compression artifacts
- FP16 = 16 BPW (unquantized)
- Q4 = ~4.0-4.5 BPW
- IQ4_XS = 4.25 BPW (extra-small variant)

**File Size Formula:**
```
Size (GB) = (Total Params × BPW) / 8 / 1024³
```
Example: 35B params × 4.25 BPW = ~17.3GB

### Quantization Metadata in GGUF
```
general.quantization_version = 2           # Latest quant format
general.file_type = 30                     # IQ4_XS
mradermacher.quantize_version = 2
mradermacher.quantized_by = mradermacher
mradermacher.quantized_at = 2026-02-28
mradermacher.quantized_on = nico1          # Hardware used for quantization

# Quality calibration data
quantize.imatrix.file = model-imatrix.gguf # Importance matrix file
quantize.imatrix.dataset = imatrix-training-full-3
quantize.imatrix.entries_count = 510       # Calibration entries
quantize.imatrix.chunks_count = 319        # Calibration chunks
```

### Importance Matrix (imatrix)
Critical for quality! Quantization uses calibration data to preserve important weights at higher precision.

**Good imatrix:**
- 300+ entries (diverse calibration data)
- 300+ chunks (fine-grained calibration)
- Trained on representative data for model's domain

**Bad imatrix:**
- <100 entries (insufficient calibration)
- Results in quality degradation, especially for reasoning

### Quantization Types: K vs XS vs S vs M

**K-quants (Q4_K, Q5_K, Q6_K):**
- Use different bit-widths for different tensor groups
- Important tensors get more bits
- Better quality than uniform quantization

**I-quants (IQ3_S, IQ4_XS):**
- "Importance Quantized" - uses imatrix for smart bit allocation
- IQ4_XS = 4.25 BPW with importance-aware allocation
- Better quality than Q4 at same or smaller size

**Suffixes:**
- `_S` = Small (fewer bits, smaller size)
- `_M` = Medium (balanced)
- `_XS` = Extra Small (IQ4_XS is smallest good quality)

### Common Pitfalls (Stumps Small Models)
❌ **WRONG**: "Q4_K_M and IQ4_XS are the same quality"  
✅ **CORRECT**: IQ4_XS uses importance matrix for better quality at same/lower BPW

❌ **WRONG**: "Higher BPW always means better quality"  
✅ **CORRECT**: Quality depends on calibration data (imatrix), not just BPW

❌ **WRONG**: "Quantization only reduces model size"  
✅ **CORRECT**: Quantization also speeds up inference (less memory bandwidth)

❌ **WRONG**: "All Q4 models are equivalent"  
✅ **CORRECT**: Q4_K_M ≠ IQ4_XS ≠ Q4_0 - different algorithms, different quality

### Quantization Quality Indicators
Check these in GGUF metadata to assess quality:

**High Quality Signs:**
- `quantize.imatrix.entries_count > 300`
- `quantize.imatrix.chunks_count > 300`
- Quantized on good hardware (`quantized_on = rich1/nico1` = good GPUs)

**Low Quality Signs:**
- No imatrix metadata
- Low entry counts (<100)
- Old quantization date or version

### Loading Behavior by Quant Type
```
# IQ4_XS loading (most common in your setup):
load_tensors: offloaded 41/41 layers to GPU
CUDA0 model buffer size = 7589.49 MiB

# Q4_K_M loading:
load_tensors: offloaded 29/29 layers to GPU  
CUDA0 model buffer size = 3771.61 MiB

# Q6_K loading:
load_tensors: offloaded 48/48 layers to GPU
CUDA0 model buffer size = 6775.07 MiB
```

### Your Models and Their Quant Types
| Model | Format | Size | Quality Estimate |
|-------|--------|------|------------------|
| Qwen3.5-4B-heretic | Q4_K_M | 2.5GB | ★★★★☆ |
| Qwen3-30B-A3B-erotic | IQ4_XS | 15.2GB | ★★★★★ |
| Huihui-Qwen3.5-35B-A3B | IQ4_XS | 17.4GB | ★★★★★ |
| gemma-3-12b-Heretic | Q4_K_S | 6.5GB | ★★★★☆ |

### Troubleshooting
**Problem**: Model quality seems poor despite good BPW  
**Solution**: Check imatrix entries count; low calibration = poor quality

**Problem**: Different IQ4_XS models have different quality  
**Solution**: Check calibration data source; some use better datasets

**Problem**: Model fails to load with quantization error  
**Solution**: Ensure llama.cpp supports the quant format; very new formats may need updates

## Safe
true

## Description
GGUF quantization formats, BPW, imatrix calibration, quality assessment, K vs IQ formats