@echo off
rem Tests, builds and publishes Communicator online (Cloudflare), with the OpenAI key and the
rem teacher password from .dev.vars. Double-click to run.
cd /d "%~dp0"
title Communicator - deploy

where node >nul 2>nul || (echo Node.js is not installed. Get it from https://nodejs.org & pause & exit /b 1)
if not exist .dev.vars (
    echo There is no .dev.vars file. Copy .dev.vars.example to .dev.vars and fill in
    echo OPENAI_API_KEY and CREATE_PASSWORD_HASH first.
    pause
    exit /b 1
)

rem Every time, so packages added by an update are installed too. Quick when nothing changed.
echo Checking dependencies...
call npm install --no-audit --no-fund --no-save || (echo. & echo Installing failed. Is this laptop online? & pause & exit /b 1)

echo Deploying Communicator...
node scripts\deploy.mjs
if errorlevel 1 (
    echo.
    echo Deploy failed. If it asks you to log in, run: npx wrangler login
    pause
    exit /b 1
)

echo.
echo Done. Communicator is live at https://communicator.eugenime.workers.dev
echo The teacher editor is at https://communicator.eugenime.workers.dev/create
pause
