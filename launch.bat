@echo off
setlocal enabledelayedexpansion

:: Navigate to script directory
pushd "%~dp0"

echo ===================================================
echo   SUSP.OS Telemetry Bridge Launcher
echo ===================================================
echo.

:: 1. Pre-check: Verify Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Node.js is not installed or not found in your system PATH.
    echo.
    echo The Telemetry Bridge requires Node.js to receive and process Forza UDP packets.
    echo Please download and install Node.js from: https://nodejs.org/
    echo.
    echo The SUSP.OS Calculator will be opened, but Live Telemetry features will not be active.
    echo.
    pause
    goto LaunchUI
)

:: 2. Inform the user and prepare to launch in foreground
echo Starting SUSP.OS Telemetry Bridge...
echo [NOTE] Keep this window open while playing Forza to sync telemetry data.
echo        To stop the bridge, press Ctrl+C or close this window.
echo.

:LaunchUI
echo Launching SUSP.OS Calculator in default browser...
start "" "index.html"

:: 3. Run Node.js bridge in the foreground
where node >nul 2>&1
if %errorlevel% equ 0 (
    node "forza-bridge.js"
)

popd
