@echo off
REM Anchor LLM Server - Simple launcher for llama.cpp
REM Usage: start-llama-server.bat

set MODEL_PATH=C:\Users\rsbiiw\Projects\models\local-Qwen3.5-9B.Q4_K_M.gguf
set LLAMA_SERVER=C:\Users\rsbiiw\llama.cpp\build\bin\Release\llama-server.exe
set PORT=8000
set CONTEXT_SIZE=262144
set GPU_LAYERS=99

echo.
echo ========================================
echo   Anchor LLM Server
echo ========================================
echo   Model: Qwen3.5 9B
echo   Context: %CONTEXT_SIZE% tokens
echo   GPU Layers: %GPU_LAYERS%
echo   Port: http://127.0.0.1:%PORT%
echo ========================================
echo.

if not exist "%LLAMA_SERVER%" (
    echo ERROR: llama-server not found at:
    echo   %LLAMA_SERVER%
    echo.
    echo Please rebuild llama.cpp:
    echo   cd C:\Users\rsbiiw\llama.cpp
    echo   cmake -B build -DCMAKE_BUILD_TYPE=Release
    echo   cmake --build build --config Release
    pause
    exit /b 1
)

if not exist "%MODEL_PATH%" (
    echo ERROR: Model not found at:
    echo   %MODEL_PATH%
    pause
    exit /b 1
)

echo Starting llama.cpp server...
echo.
"%LLAMA_SERVER%" -m "%MODEL_PATH%" --port %PORT% --ctx-size %CONTEXT_SIZE% -ngl %GPU_LAYERS%
