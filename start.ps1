# micro-nanobot v0.4.0 - PowerShell Launcher with Speculative Decoding
# Usage: .\start.ps1

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$LlamaServer = Join-Path $ScriptDir "bin\llama-server.exe"
$Port = 18080

Write-Host ""
Write-Host "========================================"
Write-Host "  micro-nanobot v0.4.0 (Portable)" -ForegroundColor Cyan
Write-Host "========================================"
Write-Host ""

# Check llama-server exists
if (-not (Test-Path $LlamaServer)) {
    Write-Host "ERROR: bin\llama-server.exe not found" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Scan for models
Write-Host "Scanning for models..."
Write-Host ""

$ModelDirs = @(
    (Join-Path $ScriptDir "models"),
    (Join-Path $env:USERPROFILE "models"),
    (Join-Path $env:USERPROFILE "Projects\models")
)

$Models = @()
$Seen = @{}

foreach ($Dir in $ModelDirs) {
    if (Test-Path $Dir) {
        Write-Host "  Scanning: $Dir" -ForegroundColor DarkGray
        Get-ChildItem $Dir -Filter "*.gguf" | ForEach-Object {
            if (-not $Seen.ContainsKey($_.FullName)) {
                $Seen[$_.FullName] = $true
                $Models += [PSCustomObject]@{
                    Name = $_.BaseName
                    Path = $_.FullName
                    Size = $_.Length
                }
            }
        }
    }
}

if ($Models.Count -eq 0) {
    Write-Host "  No GGUF models found." -ForegroundColor Yellow
    Write-Host "  Place models in .\models\ or `$env:USERPROFILE\Projects\models\"
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "  Total models found: $($Models.Count)"
Write-Host ""

# Display menu
Write-Host "Available models:"
Write-Host ""
for ($i = 0; $i -lt $Models.Count; $i++) {
    $m = $Models[$i]
    $sizeGB = [math]::Round($m.Size / 1GB, 1)
    Write-Host "  $($i + 1)) $($m.Name)" -ForegroundColor White
    Write-Host "      Size: $($m.Size) bytes ($sizeGB GB)" -ForegroundColor DarkGray
    Write-Host "      Path: $($m.Path)" -ForegroundColor DarkGray
    Write-Host ""
}

Write-Host "  0) Cancel" -ForegroundColor Yellow
Write-Host ""

$Choice = Read-Host "Select model (number)"
$ChoiceNum = [int]$Choice

if ($ChoiceNum -eq 0) {
    Write-Host "Cancelled" -ForegroundColor Yellow
    exit 0
}

if ($ChoiceNum -lt 1 -or $ChoiceNum -gt $Models.Count) {
    Write-Host "Invalid choice" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

$Selected = $Models[$ChoiceNum - 1]
$SizeGB = [math]::Round($Selected.Size / 1GB, 1)

# GPU layer selection
Write-Host ""
Write-Host "GPU Layer Selection:" -ForegroundColor Cyan
Write-Host "  1) min  - All layers on CPU (slow, low VRAM)" -ForegroundColor DarkGray
Write-Host "  2) auto - Auto-balance (recommended)" -ForegroundColor Green
Write-Host "  3) max  - All layers on GPU (fast, may exceed VRAM)" -ForegroundColor DarkGray
Write-Host "  4) custom - Specify exact layer count" -ForegroundColor DarkGray
Write-Host ""

$GpuChoice = Read-Host "Select GPU layers (1-4, default: auto)"
if ([string]::IsNullOrWhiteSpace($GpuChoice)) { $GpuChoice = "2" }

switch ($GpuChoice) {
    "1" { $GpuLayers = 0; $GpuLabel = "min (CPU only)" }
    "2" { $GpuLayers = "auto"; $GpuLabel = "auto" }
    "3" { $GpuLayers = "all"; $GpuLabel = "max (full GPU)" }
    "4" {
        $LayerNum = Read-Host "Enter layer count (0-99)"
        $GpuLayers = [int]$LayerNum
        $GpuLabel = "$LayerNum layers"
    }
    default { $GpuLayers = "auto"; $GpuLabel = "auto" }
}

# Speculative Decoding Setup
Write-Host ""
Write-Host "Speculative Decoding:" -ForegroundColor Magenta
Write-Host "  Uses a small draft model to predict tokens, then large model verifies" -ForegroundColor DarkGray
Write-Host "  Speedup: 2-3x generation speed with minimal quality loss" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  1) Enable - Select draft model (Recommended)" -ForegroundColor Green
Write-Host "  2) Skip - Use target model only" -ForegroundColor DarkGray
Write-Host ""

$SpecChoice = Read-Host "Enable speculative decoding? (1-2, default: 1)"
if ([string]::IsNullOrWhiteSpace($SpecChoice)) { $SpecChoice = "1" }

$DraftModel = $null
$DraftGpuLayers = "auto"

if ($SpecChoice -eq "1") {
    Write-Host ""
    Write-Host "Select draft model (small, 1-4B recommended):" -ForegroundColor Cyan
    Write-Host ""

    # Filter for small models (<5GB)
    $DraftModels = $Models | Where-Object { $_.Size -lt 5GB } | Sort-Object { $_.Size }

    if ($DraftModels.Count -eq 0) {
        Write-Host "  No draft models found (<5GB). Using target only." -ForegroundColor Yellow
        $SpecChoice = "2"
    } else {
        for ($i = 0; $i -lt $DraftModels.Count; $i++) {
            $dm = $DraftModels[$i]
            $sizeGB = [math]::Round($dm.Size / 1GB, 1)
            Write-Host "  $($i + 1)) $($dm.Name) ($sizeGB GB)" -ForegroundColor DarkGray
        }
        Write-Host "  0) Skip draft" -ForegroundColor Yellow
        Write-Host ""

        $DraftChoice = Read-Host "Select draft model (number)"
        $DraftNum = [int]$DraftChoice

        if ($DraftNum -gt 0 -and $DraftNum -le $DraftModels.Count) {
            $DraftModel = $DraftModels[$DraftNum - 1]
            Write-Host ""
            Write-Host "Draft model: $($DraftModel.Name)" -ForegroundColor Green
            Write-Host "Draft GPU layers (default: auto):" -ForegroundColor DarkGray
            $DraftGpuChoice = Read-Host "  1) auto  2) max  3) custom"
            switch ($DraftGpuChoice) {
                "1" { $DraftGpuLayers = "auto" }
                "2" { $DraftGpuLayers = "all" }
                "3" {
                    $LayerNum = Read-Host "  Enter draft layer count"
                    $DraftGpuLayers = [int]$LayerNum
                }
                default { $DraftGpuLayers = "auto" }
            }
        } else {
            Write-Host "  Skipping draft model." -ForegroundColor Yellow
            $SpecChoice = "2"
        }
    }
}

Write-Host ""
Write-Host "========================================"
Write-Host "  Model: $($Selected.Name)" -ForegroundColor Green
Write-Host "  Size: $SizeGB GB" -ForegroundColor DarkGray
Write-Host "  GPU: $GpuLabel" -ForegroundColor Yellow
if ($DraftModel) {
    Write-Host "  Draft: $($DraftModel.Name)" -ForegroundColor Cyan
    Write-Host "  Draft GPU: $DraftGpuLayers" -ForegroundColor DarkGray
}
Write-Host "  Port: http://127.0.0.1:$Port" -ForegroundColor Cyan
Write-Host "========================================"
Write-Host ""
Write-Host "Starting llama-server..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop the server." -ForegroundColor DarkGray
Write-Host ""

# Build command
$CmdArgs = @(
    "-m", "`"$($Selected.Path)`"",
    "--port", $Port,
    "--gpu-layers", $GpuLayers,
    "--ctx-size", "262144"
)

if ($DraftModel) {
    $CmdArgs += @(
        "--model-draft", "`"$($DraftModel.Path)`"",
        "--draft-gpu-layers", $DraftGpuLayers,
        "--draft-p-min", "0.75",
        "--draft-max", "16"
    )
    Write-Host "Speculative decoding enabled (min confidence: 75%, max draft: 16 tokens)" -ForegroundColor Magenta
}

# Launch llama-server
$ServerPath = Join-Path $ScriptDir "bin"
Set-Location $ServerPath
& $LlamaServer @CmdArgs
