@echo off
chcp 65001 >nul 2>&1
echo ========================================
echo   App Vision MCP - Build and Start
echo ========================================
echo.

cd /d "%~dp0"

echo Building project...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo Build failed! Cannot start application.
    echo Please check the build errors above.
    echo.
    pause
    exit /b 1
)

echo Build completed successfully!
echo.
echo Starting Electron app...
call npm run electron

echo.
echo Press any key to close...
pause >nul