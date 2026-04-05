@echo off
REM micro-nanobot - Windows Starter
REM Usage: start.bat

setlocal enabledelayedexpansion

set MODELS_DIR=%~dp0..\models
set LLAMA_SERVER=%~dp0llama.cpp\build\bin\Release\llama-server.exe
set PORT=8080

echo.
echo ========================================
echo   micro-nanobot Model Manager
echo ========================================
echo.

REM Check if llama-server exists
if not exist "%LLAMA_SERVER%" (
    echo ERROR: llama-server not found at:
    echo   %LLAMA_SERVER%
    echo.
    echo Please build llama.cpp first:
    echo   cd llama.cpp
    echo   cmake -B build -DCMAKE_BUILD_TYPE=Release
    echo   cmake --build build --config Release
    pause
    exit /b 1
)

REM Scan for models
echo Scanning for models...
echo.

set model_count=0
for %%f in ("%MODELS_DIR%\*.gguf") do (
    set /a model_count+=1
    set "model_!model_count!=%%f"
    set "model_name_!model_count!=%%~nf"
)

if %model_count%==0 (
    echo   No models found in %MODELS_DIR%
    echo.
    echo   Place GGUF files in %MODELS_DIR%
    echo   or run download-model.sh
    pause
    exit /b 1
)

REM Show menu
echo Available models:
echo.
for /l %%i in (1,1,%model_count%) do (
    set "name=!model_name_%%i!"
    set "path=!model_%%i!"
    for %%A in ("!path!") do set "size=%%~zA"
    echo   %%i^) !name!
    echo       Size: !size! bytes
    echo       Path: !path!
    echo.
)

echo   d^) Download new model
echo   0^) Cancel
echo.
set /p choice="Select model (number): "

if /i "%choice%"=="d" (
    echo Download not available on Windows - download manually
    pause
    exit /b 1
)

if "%choice%"=="0" (
    echo Cancelled
    exit /b 0
)

if %choice% lss 1 if %choice% gtr %model_count% (
    echo Invalid choice
    pause
    exit /b 1
)

REM Get selected model
set "selected_model=!model_%choice%!"
set "selected_name=!model_name_%choice%!"

echo.
echo ========================================
echo   Starting micro-nanobot
echo ========================================
echo   Model: %selected_name%
echo   Port: http://127.0.0.1:%PORT%
echo ========================================
echo.

REM Start llama-server in background
echo Starting llama.cpp server...
start /B "%LLAMA_SERVER%" -m "%selected_model%" --port %PORT% --ctx-size 32768
set SERVER_PID=%ERRORLEVEL%

echo Waiting for server...
timeout /t 5 /nobreak >nul

echo.
echo Starting agent...
echo.

REM Start agent
node agent.js

REM Cleanup on exit
echo.
echo Stopping server...
taskkill /F /FI "WINDOWTITLE eq llama-server*" >nul 2>&1
