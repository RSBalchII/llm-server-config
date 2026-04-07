# Voice Architecture: Binary vs Python

## Problem
Original implementation required **Python runtime** just for ASR/TTS:
```
Node.js → Python subprocess → sherpa-onnx → Audio
```

**Issues:**
- Python dependency bloat
- pip package management
- Version conflicts
- Slower (subprocess overhead)

## Solution: Pre-built Binaries

New architecture uses **standalone binaries**:
```
Node.js → Binary (sherpa-onnx/piper) → Audio
```

**Benefits:**
- ✅ No Python runtime needed
- ✅ Single download (~35MB for both binaries)
- ✅ Faster execution
- ✅ Cleaner architecture
- ✅ Works like Cargo/rustc - just download and run

## File Structure

```
micro-nanobot/
├── agent.js              # Main agent
├── voice/
│   ├── install-binary.sh # Download binaries (no Python!)
│   ├── asr.js            # Calls sherpa-onnx binary
│   ├── tts.js            # Calls piper binary
│   └── manager.js        # Voice coordination
└── models/
    ├── asr/              # ASR model (50MB)
    └── tts/              # TTS model (80MB)
```

## Installation

```bash
# Old way (Python)
./voice/install.sh        # Installs Python, pip, packages...

# New way (Binary)
./voice/install-binary.sh # Just downloads binaries
```

## Binary Sources

**sherpa-onnx** (ASR):
- URL: `https://github.com/k2-fsa/sherpa-onnx/releases`
- Size: ~20MB
- Platform: Android ARM64

**piper** (TTS):
- URL: `https://github.com/rhasspy/piper/releases`
- Size: ~15MB
- Platform: Android ARM64

## Usage

Same as before:
```bash
node agent.js
/voice on
```

But now **no Python required**!

## Comparison

| Aspect | Python Approach | Binary Approach |
|--------|-----------------|-----------------|
| Runtime | Python 3.x | None (standalone) |
| Install | pip + packages | wget + tar |
| Size | ~100MB (Python + deps) | ~35MB (binaries only) |
| Startup | ~2s | ~0.5s |
| Architecture | Clean ✅ | **Cleaner ✅✅** |

## Future: Even Cleaner

If Node.js-native bindings mature:
```javascript
import sherpa from 'sherpa-onnx-node';
// Direct call, no subprocess!
```

But for now, **binaries are the cleanest option**.
