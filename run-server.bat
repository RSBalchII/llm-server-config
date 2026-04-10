@echo off
REM micro-nanobot - Portable Llama Server (v0.4.0)
 Bundled llama-server - no external dependencies
REM Connect Qwen Code or any client to http://127.0.0.1:8080

setlocal enabledelayedexpansion

set SCRIPT_DIR=%~dp0
set LLAMA_SERVER=%SCRIPT_DIR%bin\llama-server.exe
set PORT=18080

echo.
echo ========================================
echo   micro-nanobot Server (Portable)
echo ========================================
echo.

if not exist "%LLAMA_SERVER%" (
    echo ERROR: bin\llama-server.exe not found
    pause
    exit /b 1
)

echo Scanning for models...
echo.

set model_count=0
set "model_dirs=%SCRIPT_DIR%models;%USERPROFILE%\models;%USERPROFILE%\Projects\models"

for %%d in (%model_dirs%) do (
    if exist "%%d\*.gguf" (
        echo   Scanning: %%d
        for %%f in ("%%d\*.gguf") do (
            set /a model_count+=1
            set "model_!model_count!=%%f"
            set "model_name_!model_count!=%%~nf"
        )
    )
)

if %model_count%==0 (
    echo   No GGUF models found.
    pause
    exit /b 1
)

echo   Total: %model_count% models
echo.

echo Available models:
echo.
for /l %%i in (1,1,%model_count%) do (
    set "path=!model_%%i!"
    for %%A in ("!path!") do set "size=%%~zA"
    echo   %%i^) !model_name_%%i!
    echo       Size: !size! bytes
    echo.
)

echo   0^) Cancel
echo.
set /p choice="Select model (number): "

if "!choice!"=="0" ( echo Cancelled & exit /b 0 )
if !choice! lss 1 if !choice! gtr %model_count% ( echo Invalid & pause & exit /b 1 )

set "selected_model=!model_%choice%!"
set "selected_name=!model_name_%choice%!"

echo.
echo ========================================
echo   Model: %selected_name%
echo   URL: http://127.0.0.1:%PORT%
echo   API: http://127.0.0.1:%PORT%/v1
echo ========================================
echo.
echo Press Ctrl+C to stop
echo.

cd /d "%SCRIPT_DIR%bin"
"%LLAMA_SERVER%" -m "%selected_model%" --port %PORT% --gpu-layers all --ctx-size 32768
