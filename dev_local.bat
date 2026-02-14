@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"

set "API_PORT=8000"
set "WEB_PORT=3000"
set "API_HEALTH_URL=http://127.0.0.1:%API_PORT%/api/v1/health"
set "APP_URL=http://127.0.0.1:%WEB_PORT%/hub"
set "API_DOCS_URL=http://127.0.0.1:%API_PORT%/docs"

if /I "%~1"=="start" goto START
if /I "%~1"=="stop" goto STOP
if /I "%~1"=="status" goto STATUS
if /I "%~1"=="open" goto OPEN

echo Uso:
echo   dev_local.bat start
echo   dev_local.bat stop
echo   dev_local.bat status
echo   dev_local.bat open
exit /b 1

:START
call :STOP_SILENT

echo [INFO] Iniciando API em %API_PORT%...
start "CMD8 API" cmd /c "cd /d ""%cd%"" && set ENV=dev&&set JWT_SECRET=change-me-in-prod&&set AUTO_CREATE_DB=true&&set SEED_DEV_DATA=true&&set DATABASE_URL=sqlite:///./study_leveling.db&&set CORS_ORIGINS=http://127.0.0.1:%WEB_PORT%&&set SERVE_FRONTEND=false&&set TZ=America/Sao_Paulo&&python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port %API_PORT%"

call :WAIT_URL "%API_HEALTH_URL%" 60
if errorlevel 1 (
  echo [ERRO] API nao respondeu em %API_HEALTH_URL%.
  exit /b 1
)

echo [INFO] Iniciando frontend Vite em %WEB_PORT%...
start "CMD8 WEB" cmd /c "cd /d ""%cd%"" && set VITE_DEV_API_TARGET=http://127.0.0.1:%API_PORT%&&pnpm dev:client -- --host 0.0.0.0 --port %WEB_PORT% --strictPort"

call :WAIT_URL "%APP_URL%" 60
if errorlevel 1 (
  echo [ERRO] Frontend nao respondeu em %APP_URL%.
  exit /b 1
)

echo [OK] Frontend + API ativos.
echo      App:  %APP_URL%
echo      Docs: %API_DOCS_URL%
start "" "%APP_URL%"
exit /b 0

:STOP
call :STOP_SILENT
echo [OK] Processos locais encerrados (portas %WEB_PORT% e %API_PORT%).
exit /b 0

:STATUS
echo [INFO] Processos ouvindo em %WEB_PORT% e %API_PORT%:
powershell -NoProfile -Command "$ports=@(%WEB_PORT%,%API_PORT%); Get-NetTCPConnection -State Listen | Where-Object { $ports -contains $_.LocalPort } | Select-Object LocalAddress,LocalPort,OwningProcess | Sort-Object LocalPort | Format-Table -AutoSize"
exit /b 0

:OPEN
start "" "%APP_URL%"
exit /b 0

:WAIT_URL
set "_url=%~1"
set /a "_max=%~2"
set /a "_tries=0"

:WAIT_URL_LOOP
set /a "_tries+=1"
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing '%_url%' -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 exit /b 0

if !_tries! GEQ !_max! exit /b 1
timeout /t 1 /nobreak >nul
goto WAIT_URL_LOOP

:STOP_SILENT
powershell -NoProfile -Command "$ports=@(%WEB_PORT%,%API_PORT%); $pids=Get-NetTCPConnection -State Listen | Where-Object { $ports -contains $_.LocalPort } | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($id in $pids) { try { Stop-Process -Id $id -Force -ErrorAction Stop } catch {} }" >nul 2>&1
exit /b 0