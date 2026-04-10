# research.bat
# Simple batch wrapper for research-harness.ps1
# Usage: research.bat -topic "topic to research"
# Or trigger manually: research.bat -topic "what to research"

powershell -ExecutionPolicy Bypass -File .\research-harness.ps1 -topic "%1"
