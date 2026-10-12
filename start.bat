@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org and run this again.
  pause
  exit /b 1
)
where pnpm >nul 2>nul
if errorlevel 1 (
  echo Installing pnpm...
  call npm install -g pnpm
)
call pnpm install
if errorlevel 1 (
  echo Install failed. Copy the error above and ask for help.
  pause
  exit /b 1
)
start "" cmd /c "timeout /t 8 >nul & start http://localhost:5173"
call pnpm dev
pause
