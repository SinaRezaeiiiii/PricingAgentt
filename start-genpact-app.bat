@echo off
title Genpact Pricing App
echo.
echo ========================================
echo   Genpact Pricing App wird gestartet...
echo ========================================
echo.

REM Check if dist folder exists
if not exist "dist\" (
    echo [FEHLER] dist\ Ordner nicht gefunden!
    echo Bitte erst 'npm run build' ausfuehren.
    echo.
    pause
    exit /b 1
)

REM Check if exe exists
if not exist "genpact-pricing-app.exe" (
    echo [FEHLER] genpact-pricing-app.exe nicht gefunden!
    echo.
    pause
    exit /b 1
)

REM Start the executable
echo Server startet...
echo.
echo Die App oeffnet sich automatisch im Browser.
echo Zum Beenden: Fenster schliessen oder Strg+C druecken
echo.

"%~dp0genpact-pricing-app.exe"

pause
