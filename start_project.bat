@echo off
cd /d "%~dp0"
echo ==========================================
echo      Iniciando Study Leveling Project
echo ==========================================

echo [1/2] Iniciando Backend (Python Bridge)...
start "Backend (Python)" cmd /k "python scripts/local_bridge.py"

echo [2/2] Iniciando Frontend (React)...
start "Frontend (React)" cmd /k "npm run dev:client"

echo.
echo ==========================================
echo      Sistemas iniciados em novas janelas!
echo ==========================================
echo.
pause
