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
node server.js

pause
