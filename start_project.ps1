$ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -Path $ScriptPath

Write-Host "=========================================="
Write-Host "     Iniciando Study Leveling Project (PowerShell)"
Write-Host "=========================================="
Write-Host ""

Write-Host "[1/2] Iniciando Backend (Python Bridge)..."
Start-Process cmd -ArgumentList "/k python scripts/local_bridge.py" -WorkingDirectory $ScriptPath -WindowStyle Normal

Write-Host "[2/2] Iniciando Frontend (React)..."
Start-Process cmd -ArgumentList "/k npm run dev:client" -WorkingDirectory $ScriptPath -WindowStyle Normal

Write-Host ""
Write-Host "=========================================="
Write-Host "     Sistemas iniciados em novas janelas!"
Write-Host "=========================================="
Write-Host ""
Read-Host "Pressione Enter para continuar..."
