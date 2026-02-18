$ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -Path $ScriptPath

Write-Host "=========================================="
Write-Host "     Iniciando Study Leveling Project (PowerShell)"
Write-Host "=========================================="
Write-Host ""

Write-Host "[1/3] Iniciando Backend Main API (Port 8000)..."
Start-Process cmd -ArgumentList "/k python -m uvicorn app.main:app --app-dir backend --reload --port 8000" -WorkingDirectory $ScriptPath -WindowStyle Normal

Write-Host "[2/3] Iniciando Backend Local Bridge (Port 8765)..."
Start-Process cmd -ArgumentList "/k python scripts/local_bridge.py" -WorkingDirectory $ScriptPath -WindowStyle Normal

Write-Host "[3/3] Iniciando Frontend (React)..."
Start-Process cmd -ArgumentList "/k npm run dev:client" -WorkingDirectory $ScriptPath -WindowStyle Normal

Write-Host ""
Write-Host "=========================================="
Write-Host "     Sistemas iniciados em novas janelas!"
Write-Host "=========================================="
Write-Host ""
Read-Host "Pressione Enter para continuar..."
