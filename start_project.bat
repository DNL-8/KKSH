@echo off
cd /d "%~dp0"
echo ==========================================
echo      Iniciando Study Leveling Project
echo ==========================================

echo [1/3] Iniciando Backend Main API (Port 8000)...
start "Backend (Main API)" cmd /k "python -m uvicorn app.main:app --app-dir backend --reload --host 0.0.0.0 --port 8000"

echo [2/3] Iniciando Backend Local Bridge (Port 8765)...
start "Backend (Python)" cmd /k "python scripts/local_bridge.py"

echo [3/3] Iniciando Frontend (React)...
start "Frontend (React)" cmd /k "npm run dev:client -- --host"

echo.
echo ==========================================
echo      Sistemas iniciados em novas janelas!
echo ==========================================
echo.
pause
