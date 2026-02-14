@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "APP_URL=http://localhost:8000/hub"
set "API_HEALTH_URL=http://localhost:8000/api/v1/health"
set "API_DOCS_URL=http://localhost:8000/docs"

cd /d "%~dp0"

set "CLI_MODE=0"
if not "%~1"=="" set "CLI_MODE=1"

if not exist "docker-compose.yml" (
  echo [ERRO] Nao achei docker-compose.yml em: %cd%
  pause
  exit /b 1
)

if /I "%~1"=="start" goto START
if /I "%~1"=="stop" goto STOP
if /I "%~1"=="logs" goto LOGS
if /I "%~1"=="resetdb" goto RESETDB
if /I "%~1"=="open" goto OPEN
if /I "%~1"=="docs" goto DOCS

:MENU
cls
echo ================================================
echo   CMD8 - Menu (Docker Compose Fullstack)
echo   Pasta: %cd%
echo ================================================
echo.
echo  1) Start (subir redis + db + api)
echo  2) Stop  (parar containers)
echo  3) Logs  (seguir logs)
echo  4) Reset DB (apaga volume do Postgres)
echo  5) Abrir app web
echo  6) Abrir docs da API
echo  0) Sair
echo.
set /p choice=Escolha: 

if "%choice%"=="1" goto START
if "%choice%"=="2" goto STOP
if "%choice%"=="3" goto LOGS
if "%choice%"=="4" goto RESETDB
if "%choice%"=="5" goto OPEN
if "%choice%"=="6" goto DOCS
if "%choice%"=="0" goto END

goto MENU

:CHECK_DOCKER
where docker >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Docker nao encontrado no PATH.
  echo Instale/abra o Docker Desktop e tente novamente.
  exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
  echo [INFO] Docker nao esta rodando. Tentando abrir Docker Desktop...
  if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
    start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
  ) else if exist "%ProgramFiles(x86)%\Docker\Docker\Docker Desktop.exe" (
    start "" "%ProgramFiles(x86)%\Docker\Docker\Docker Desktop.exe"
  ) else (
    echo [AVISO] Nao achei o executavel do Docker Desktop automaticamente.
    echo Abra o Docker Desktop manualmente.
  )
  echo [INFO] Aguardando o Docker ficar pronto...
  :WAIT_DOCKER
  timeout /t 2 /nobreak >nul
  docker info >nul 2>&1
  if errorlevel 1 goto WAIT_DOCKER
)
exit /b 0

:WAIT_API
set /a tries=0
set /a maxTries=90

echo [INFO] Verificando saude da API: %API_HEALTH_URL%

:WAIT_API_LOOP
set /a tries+=1
curl -fsS "%API_HEALTH_URL%" >nul 2>&1
if errorlevel 1 (
  if !tries! GEQ !maxTries! (
    echo [ERRO] API nao respondeu apos !maxTries! tentativas.
    echo [INFO] Logs da API:
    docker compose logs --tail 200 api
    exit /b 1
  )
  timeout /t 2 /nobreak >nul
  goto WAIT_API_LOOP
)

echo [OK] API no ar!
exit /b 0

:START
call :CHECK_DOCKER
if errorlevel 1 (
  echo.
  pause
  goto MENU
)

echo.
echo [INFO] Subindo containers fullstack (build + up)...
docker compose up -d --build redis db api
if errorlevel 1 (
  echo.
  echo [ERRO] Falhou ao subir containers.
  docker compose logs --tail 200
  echo.
  pause
  goto MENU
)

echo.
call :WAIT_API
if errorlevel 1 (
  echo.
  pause
  goto MENU
)

echo.
echo [OK] CMD8 Fullstack iniciado.
echo - App:   %APP_URL%
echo - Health:%API_HEALTH_URL%
echo - Docs:  %API_DOCS_URL%
echo.
echo [INFO] Abrindo: %APP_URL%
start "" "%APP_URL%"
if "%CLI_MODE%"=="1" exit /b 0
pause
goto MENU

:STOP
call :CHECK_DOCKER
if errorlevel 1 (
  echo.
  pause
  goto MENU
)

echo.
echo [INFO] Parando containers...
docker compose down
if errorlevel 1 (
  echo [ERRO] Falhou ao parar.
  docker compose logs --tail 120
  echo.
  pause
  goto MENU
)

echo [OK] CMD8 parado.
echo.
if "%CLI_MODE%"=="1" exit /b 0
pause
goto MENU

:LOGS
call :CHECK_DOCKER
if errorlevel 1 (
  echo.
  pause
  goto MENU
)

echo.
echo [INFO] Logs (CTRL+C para sair)...
docker compose logs -f
goto MENU

:RESETDB
call :CHECK_DOCKER
if errorlevel 1 (
  echo.
  pause
  goto MENU
)

echo.
echo ATENCAO: Isso vai apagar o volume pgdata (zera o banco).
set /p conf=Tem certeza? (s/N): 
if /I not "%conf%"=="s" goto MENU

echo.
echo [INFO] Derrubando containers e removendo volumes...
docker compose down -v
if errorlevel 1 (
  echo [ERRO] Falhou ao resetar.
  pause
  goto MENU
)

echo [OK] Banco resetado (volume removido).
echo.
if "%CLI_MODE%"=="1" exit /b 0
pause
goto MENU

:OPEN
echo.
echo [INFO] Abrindo app: %APP_URL%
start "" "%APP_URL%"
echo.
if "%CLI_MODE%"=="1" exit /b 0
pause
goto MENU

:DOCS
echo.
echo [INFO] Abrindo docs: %API_DOCS_URL%
start "" "%API_DOCS_URL%"
echo.
if "%CLI_MODE%"=="1" exit /b 0
pause
goto MENU

:END
endlocal
exit /b 0