# Download Gemma-4-19b-a4b-it-REAP GGUF
# REAP = Router-weighted Expert Activation Pruning (30% expert removal)
# Original: 26B-A4B → Pruned: 19B-A4B (active params/tok unchanged at ~4B)
# GGUF repo: mradermacher/gemma-4-19b-a4b-it-REAP-GGUF

$modelName = "gemma-4-19b-a4b-it-REAP"
$repo = "mradermacher/$modelName-GGUF"
$modelsDir = "C:\Users\rsbiiw\Projects\models"

Write-Host "══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Gemma-4-19B-A4B-REAP (30% Expert-Pruned)" -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Model specs:" -ForegroundColor Yellow
Write-Host "  Total params: 19B (pruned from 26B)" -ForegroundColor DarkGray
Write-Host "  Active params/tok: ~4B (unchanged)" -ForegroundColor DarkGray
Write-Host "  Experts/layer: 90 (pruned from 128)" -ForegroundColor DarkGray
Write-Host "  Experts/tok: 8 (unchanged)" -ForegroundColor DarkGray
Write-Host "  Context: 262K tokens" -ForegroundColor DarkGray
Write-Host ""

# Check if huggingface-cli is available
if (Get-Command huggingface-cli -ErrorAction SilentlyContinue) {
    Write-Host "Using huggingface-cli..." -ForegroundColor Green
    huggingface-cli download $repo --local-dir $modelsDir --include "*.gguf"
} else {
    Write-Host "huggingface-cli not found. Use manual download:" -ForegroundColor Yellow
    Write-Host "  https://huggingface.co/$repo" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "Recommended file:" -ForegroundColor Yellow
    Write-Host "  Q4_K_M (~9GB) - balanced quality/size" -ForegroundColor DarkGray
    Write-Host "  Q5_K_S (~10GB) - higher quality" -ForegroundColor DarkGray
    Write-Host "  IQ4_XS (~8.5GB) - best quality/size ratio" -ForegroundColor DarkGray
}
