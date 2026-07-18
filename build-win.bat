@echo off
REM ============================================================
REM    archivo - Build Windows (x64)
REM    Double-click this file, or run it from a terminal.
REM ============================================================
setlocal enabledelayedexpansion
cd /d "%~dp0"

for /f "tokens=*" %%v in ('node -e "console.log(require('./package.json').version)" 2^>nul') do set VERSION=%%v
if "%VERSION%"=="" set VERSION=?

echo.
echo ===================================================
echo      archivo v%VERSION% - Build Windows (x64)
echo ===================================================
echo.

REM -- 1. Node.js --------------------------------------------
echo [1/4] Checking Node.js...
where node >nul 2>nul
if errorlevel 1 (
  echo   X Node.js not found. Install the LTS version from https://nodejs.org
  echo     Then re-run this script.
  pause
  exit /b 1
)
for /f "tokens=*" %%n in ('node --version') do echo   OK Node.js %%n

REM -- 2. Icon -----------------------------------------------
echo [2/4] Checking icon...
if not exist "build\icon.ico" (
  echo   X build\icon.ico not found.
  pause
  exit /b 1
)
echo   OK icon.ico ready

REM -- 3. Dependencies ---------------------------------------
echo [3/4] Installing dependencies (this can take a minute)...
if exist "node_modules" (
  echo   node_modules present, skipping install. Delete it to force a clean install.
) else (
  call npm install
  if errorlevel 1 (
    echo   X npm install failed.
    pause
    exit /b 1
  )
)
echo   OK dependencies ready

REM -- 4. Build ----------------------------------------------
echo [4/4] Building Windows installer + portable...
call npm run build:win
if errorlevel 1 (
  echo   X Build failed.
  pause
  exit /b 1
)

echo.
echo ===================================================
echo   Done. Find your build in the  dist\  folder:
echo     - archivo Setup %VERSION%.exe   (installer)
echo     - archivo %VERSION%.exe         (portable, no install)
echo ===================================================
echo.
pause
endlocal
