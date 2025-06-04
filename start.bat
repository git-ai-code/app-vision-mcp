@echo off
chcp 65001 >nul 2>&1

echo ========================================
echo   App Vision MCP - Start
echo ========================================
echo.

cd /d "%~dp0"

if not exist "dist\electron\electron\main\index.js" (
    echo ERROR: App is not built yet
    echo Please run build-and-start.bat first
    pause
    exit /b 1
)

echo Starting Electron app...
npm run electron

echo.
echo Press any key to close...
pause >nul