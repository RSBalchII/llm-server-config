@echo off
REM micro-nanobot - Tool Calling Test (v0.4.0)
REM Tests if models produce structured tool_calls through llama-server

setlocal enabledelayedexpansion

set SCRIPT_DIR=%~dp0
set LLAMA_SERVER=%SCRIPT_DIR%bin\llama-server.exe
set PORT=18080

echo.
echo ========================================
echo   Tool Calling Test Suite
echo ========================================
echo.

if not exist "%LLAMA_SERVER%" (
    echo ERROR: bin\llama-server.exe not found
    pause
    exit /b 1
)

REM Collect models
set model_count=0
set "model_dirs=%SCRIPT_DIR%models;%USERPROFILE%\models;%USERPROFILE%\Projects\models"

for %%d in (%model_dirs%) do (
    if exist "%%d\*.gguf" (
        for %%f in ("%%d\*.gguf") do (
            set /a model_count+=1
            set "model_!model_count!=%%f"
            set "model_name_!model_count!=%%~nf"
        )
    )
)

if %model_count%==0 (
    echo No models found
    pause
    exit /b 1
)

echo Testing %model_count% models for tool calling support
echo.

REM Results file
set RESULTS=%SCRIPT_DIR%TOOL_CALLING_RESULTS.md
echo # Tool Calling Test Results > "%RESULTS%"
echo Tested on %date% %time% >> "%RESULTS%"
echo. >> "%RESULTS%"
echo | set /p="Model | Type | Size | Tool Calling | Notes" >> "%RESULTS%"
echo --- >> "%RESULTS%"

for /l %%i in (1,1,%model_count%) do (
    set "model_path=!model_%%i!"
    set "model_name=!model_name_%%i!"

    echo.
    echo ========================================
    echo [%%i/%model_count%] Testing: !model_name!
    echo ========================================

    REM Get size
    for %%A in ("!model_path!") do set "model_size=%%~zA"
    set /a "size_gb=!model_size!/1073741824"

    echo Starting llama-server on port %PORT%...

    REM Start llama-server in background
    cd /d "%SCRIPT_DIR%bin"
    start /B "llama-test" "%LLAMA_SERVER%" -m "!model_path!" --port %PORT% --gpu-layers max --ctx-size 4096
    cd /d "%SCRIPT_DIR%"

    REM Wait for server
    echo Waiting for server...
    timeout /t 15 /nobreak >nul

    REM Send tool call test
    echo Testing tool calling...

    set "test_body={\"model\": \"!model_name!\", \"messages\": [{\"role\": \"user\", \"content\": \"List the files in the current directory\"}], \"tools\": [{\"type\": \"function\", \"function\": {\"name\": \"list_directory\", \"description\": \"List directory contents\", \"parameters\": {\"type\": \"object\", \"properties\": {\"path\": {\"type\": \"string\", \"description\": \"Directory path to list\"}}, \"required\": [\"path\"]}}}], \"stream\": false}"

    set "response="
    powershell -Command "try { $r = Invoke-RestMethod -Uri 'http://127.0.0.1:%PORT%/v1/chat/completions' -Method Post -ContentType 'application/json' -Body '%test_body%' -TimeoutSec 120; $r | ConvertTo-Json -Depth 10 | Out-File -FilePath '%SCRIPT_DIR%test-response-%%i.json' -Encoding utf8; Write-Output 'DONE' } catch { Write-Output 'FAILED: ' $_.Exception.Message }"

    REM Check response for tool_calls
    if exist "%SCRIPT_DIR%test-response-%%i.json" (
        findstr /C:"tool_calls" "%SCRIPT_DIR%test-response-%%i.json" >nul 2>&1
        if !errorlevel! equ 0 (
            echo PASS - Model returned structured tool_calls
            echo [%%i] !model_name! ^| ^| !size_gb!GB ^| PASS ^| Structured tool_calls detected >> "%RESULTS%"
        ) else (
            echo PARTIAL - Response received but no tool_calls
            echo [%%i] !model_name! ^| ^| !size_gb!GB ^| PARTIAL ^| Text response, no tool_calls >> "%RESULTS%"
        )
    ) else (
        echo FAIL - No response from model
        echo [%%i] !model_name! ^| ^| !size_gb!GB ^| FAIL ^| No response >> "%RESULTS%"
    )

    REM Cleanup
    echo Cleaning up...
    taskkill /F /FI "WINDOWTITLE eq llama-test" >nul 2>&1
    timeout /t 3 /nobreak >nul

    if exist "%SCRIPT_DIR%test-response-%%i.json" del "%SCRIPT_DIR%test-response-%%i.json"
)

echo.
echo ========================================
echo   Results saved to TOOL_CALLING_RESULTS.md
echo ========================================
type "%RESULTS%"
echo.
pause
