@echo off
setlocal
title Chronos Earth
cd /d "%~dp0"

echo.
echo  Chronos Earth
echo  =============
echo.

where node.exe >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found.
  echo Install the LTS version from https://nodejs.org/ and run this file again.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\vite\bin\vite.js" (
  echo First launch: installing the website components...
  echo This normally takes a minute or two and only happens once.
  echo.
  call npm ci
  if errorlevel 1 (
    echo.
    echo Installation failed. Check the message above, then run START-HERE again.
    pause
    exit /b 1
  )
)

echo Starting Chronos Earth at http://127.0.0.1:5173/
echo Leave this window open while using the site.
echo Press Ctrl+C here when you want to stop it.
echo.

if /I not "%CHRONOS_NO_BROWSER%"=="1" start "" powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:5173/'"
call npm run dev -- --host 127.0.0.1 --port 5173 --strictPort

endlocal
