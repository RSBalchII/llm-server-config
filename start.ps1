# micro-nanobot v0.4.0 - PowerShell Launcher
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

Write-Host ""
Write-Host "========================================"
Write-Host "  Model: $($Selected.Name)" -ForegroundColor Green
Write-Host "  Size: $SizeGB GB" -ForegroundColor DarkGray
Write-Host "  GPU: $GpuLabel" -ForegroundColor Yellow
Write-Host "  Port: http://127.0.0.1:$Port" -ForegroundColor Cyan
Write-Host "========================================"
Write-Host ""
Write-Host "Starting llama-server..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop the server." -ForegroundColor DarkGray
Write-Host ""

# Launch llama-server
$ServerPath = Join-Path $ScriptDir "bin"
Set-Location $ServerPath
& $LlamaServer -m $Selected.Path --port $Port --gpu-layers $GpuLayers --ctx-size 131072
