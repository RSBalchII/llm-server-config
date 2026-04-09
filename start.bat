@echo off
REM micro-nanobot Server Launcher (v0.3.0 - node-llama-cpp)
REM Starts server-v3.js with model selection and GPU layer choice

setlocal enabledelayedexpansion

set PROXY_PORT=8888
set SCRIPT_DIR=%~dp0

echo.
echo ========================================
echo   micro-nanobot Server v0.3.0
echo   node-llama-cpp (no external llama-server)
echo ========================================
echo.

REM ============================================================================
REM SCAN MODELS
REM ============================================================================
echo Scanning for models...
set MODEL_DIR=%USERPROFILE%\Projects\models
set IDX=0

for %%F in ("%MODEL_DIR%\*.gguf") do (
    set /a IDX+=1
    set "FSIZE=%%~zF"
    REM Convert bytes to GB using PowerShell (avoids batch overflow)
    for /f "usebackq delims=" %%G in (`powershell -Command "[math]::Round(%%~zF/1GB,1)"`) do set SIZE_GB=%%G
    echo   !IDX!^) %%~nF (!SIZE_GB!GB^)
)

if !IDX! equ 0 (
    echo.
    echo ERROR: No .gguf models found in %MODEL_DIR%
    echo.
    pause
    exit /b 1
)

set MODEL_COUNT=!IDX!
set IDX=0

echo   0^) Cancel
echo.

REM ============================================================================
REM MODEL SELECTION
REM ============================================================================
set /p MODEL_NUM="Select model (number): "

if "!MODEL_NUM!"=="0" (
    echo Cancelled.
    exit /b 0
)

if "!MODEL_NUM!"=="" (
    echo Cancelled.
    exit /b 0
)

REM ============================================================================
REM GPU LAYERS
REM ============================================================================
echo.
set /p GPU_LAYERS="GPU layers (number, auto, or max, default: auto): "
if "!GPU_LAYERS!"=="" set GPU_LAYERS=auto

REM ============================================================================
REM START SERVER
REM ============================================================================
echo.
echo Starting server...
echo.

cd /d "%SCRIPT_DIR%"
node server-v3.js
