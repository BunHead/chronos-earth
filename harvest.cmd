@echo off
title Chronos Earth - world harvest robot
cd /d "%~dp0"
echo ============================================
echo   CHRONOS EARTH - WORLD HARVEST ROBOT
echo   Sweeps the next 40 cells of the planet,
echo   tests, commits and publishes the site.
echo   Safe to close at any time - progress is
echo   saved after every cell. Run me again to
echo   continue. 144 cells in total.
echo ============================================
echo.
node scripts\harvest-world.mjs --cells 40
if errorlevel 1 (
  echo.
  echo The harvester hit a problem - nothing was published.
  echo Just run me again later; it resumes where it stopped.
  pause
  exit /b 1
)
echo.
echo Running the safety tests...
call npm test
if errorlevel 1 (
  echo.
  echo TESTS FAILED - nothing was published. Tell the current
  echo Claude session about this; do not run me again until fixed.
  pause
  exit /b 1
)
git add public/data/regions
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "harvest: more world cells (harvest.cmd)"
  git push origin main
  echo.
  echo Published! The site rebuilds itself in about two minutes.
) else (
  echo.
  echo Nothing new this run (ocean cells or already done).
)
echo.
pause
