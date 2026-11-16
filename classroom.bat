@echo off
rem Runs Communicator on this laptop for the class, over the school Wi-Fi, and opens the
rem teacher editor. Double-click to run; keep the window open during the lesson.
cd /d "%~dp0"
title Communicator - class server

where node >nul 2>nul || (echo Node.js is not installed. Get it from https://nodejs.org & pause & exit /b 1)

rem Wake the voice bridge while setup, installation and the build run.
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "node scripts/warm-speech.mjs"

rem First time on this laptop: the teacher password and the OpenAI key.
node scripts\setup-laptop.mjs || (pause & exit /b 1)

rem Every time, so packages added by an update are installed too. Quick when nothing changed.
echo Checking dependencies...
call npm install --no-audit --no-fund --no-save || (echo. & echo Installing failed. Is this laptop online? & pause & exit /b 1)

rem Opens the teacher editor once the server answers.
start "" /min powershell -NoProfile -WindowStyle Hidden -Command ^
  "for ($i = 0; $i -lt 180; $i++) { try { Invoke-WebRequest -UseBasicParsing http://localhost:8790/api/health | Out-Null; Start-Process http://localhost:8790/create; break } catch { Start-Sleep 1 } }"

set PORT=8790
call npm run classroom
pause
