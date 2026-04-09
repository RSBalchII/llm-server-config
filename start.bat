@echo off
REM micro-nanobot Server Launcher
REM Starts llama-server + proxy server

setlocal enabledelayedexpansion

set LLAMA_PORT=8081
set PROXY_PORT=8080
set SCRIPT_DIR=%~dp0

echo.
echo ========================================
echo   micro-nanobot Server
echo ========================================
echo.

REM ============================================================================
REM FIND LLAMA-SERVER
REM ============================================================================
echo Searching for llama-server...
set "LLAMA_SERVER=C:\Users\rsbiiw\llama.cpp\build\bin\Release\llama-server.exe"

if not exist "%LLAMA_SERVER%" (
    echo ERROR: llama-server not found at %LLAMA_SERVER%
    pause
    exit /b 1
)
echo Found: %LLAMA_SERVER%
echo.

REM ============================================================================
REM FIND MODELS  
REM ============================================================================
echo Scanning for models...
echo.

set model_count=0
set "seen_names="

REM Use single model dir to avoid duplicates
for %%f in ("%USERPROFILE%\Projects\models\*.gguf") do (
    set "fname=%%~nf"
    echo !seen_names! | findstr /C:"!fname!" >nul
    if errorlevel 1 (
        set "seen_names=!seen_names! !fname!"
        set /a model_count+=1
        set "model_!model_count!=%%~ff"
        set "model_name_!model_count!=%%~nf"
    )
)

if %model_count%==0 (
    echo   No models found
    pause
    exit /b 1
)

echo Available models:
echo.
for /l %%i in (1,1,%model_count%) do (
    echo   %%i^) !model_name_%%i!
    echo       Path: !model_%%i!
    echo.
)

echo   0^) Cancel
echo.
set /p choice="Select model (number): "

if "%choice%"=="0" exit /b 0
if %choice% lss 1 if %choice% gtr %model_count% (
    echo Invalid choice & pause & exit /b 1
)

set "SELECTED_MODEL=!model_%choice%!"
set "SELECTED_NAME=!model_name_%choice%!"

for %%I in ("%LLAMA_SERVER%") do set LLAMA_DIR=%%~dI%%~pI

echo.
echo ========================================
echo   Starting micro-nanobot
echo ========================================
echo   Model: !SELECTED_NAME!
echo   Proxy: http://127.0.0.1:!PROXY_PORT!
echo   Llama: http://127.0.0.1:!LLAMA_PORT!
echo ========================================
echo.

REM Start llama-server in background
echo 🚀 Starting llama-server...
set "LLAMA_DIR=C:\Users\rsbiiw\llama.cpp\build\bin\Release"
start /B "llama-server" /D "%LLAMA_DIR%" "%LLAMA_SERVER%" -m "%SELECTED_MODEL%" --port %LLAMA_PORT% --ctx-size 40960 --threads 4 --gpu-layers 99

REM Wait for llama-server
echo ⏳ Waiting for llama-server...
%windir%\System32\timeout.exe /t 15 /nobreak >nul

echo.
echo 🤖 Starting proxy server...
echo   Model env: !SELECTED_NAME!
echo.

REM Pass model name via env var to node
set MODEL_NAME=!SELECTED_NAME!
start /B "" cmd /c ""%ProgramFiles%\nodejs\node.exe" "%~dp0server.js""
