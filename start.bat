@echo off
REM Llama Model Server - Windows Launcher
REM Starts the Node.js server which manages llama.cpp

echo.
echo ========================================
echo   Llama Model Server
echo ========================================
echo   Models: C:\Users\rsbii\Projects\models
echo   Web UI: http://localhost:3000
echo   API:    http://localhost:3000/api
echo ========================================
echo.

cd /d "%~dp0"

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo.
        echo ERROR: npm install failed
        pause
        exit /b 1
    )
)

echo Starting server...
echo.
node server.js

pause
