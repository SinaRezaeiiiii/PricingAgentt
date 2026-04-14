@echo off
title Genpact Pricing App

echo.
echo ========================================
echo   Genpact Pricing App
echo ========================================
echo.
echo Starting server...
echo.

cd /d "%~dp0"
set "APP_URL=http://127.0.0.1:8080/"
set "NO_AUTO_OPEN=1"
start "" "%APP_URL%"
node server.cjs

pause
