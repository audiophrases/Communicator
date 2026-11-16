@echo off
rem Builds Communicator and opens it on this PC. Close this window to stop.
cd /d "%~dp0"
title Communicator

where node >nul 2>nul || (echo Node.js is not installed. Get it from https://nodejs.org & pause & exit /b 1)

echo Checking dependencies...
call npm install --no-audit --no-fund || (echo. & echo Installing failed. Is this PC online? & pause & exit /b 1)

echo Building...
call npm run build || (echo. & echo The build failed. & pause & exit /b 1)

start "" http://localhost:8790
call npx wrangler dev --port 8790
pause
