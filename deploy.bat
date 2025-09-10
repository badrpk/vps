@echo off
setlocal enabledelayedexpansion

REM VPS-PK Cloud Platform Deployment Script for Windows
REM Automated deployment script for the complete cloud services platform

set PROJECT_NAME=vps-pk-cloud-platform
set NODE_VERSION=16
set PORT=%PORT%
if "%PORT%"=="" set PORT=3000
set HOST=%HOST%
if "%HOST%"=="" set HOST=0.0.0.0
set NODE_ENV=%NODE_ENV%
if "%NODE_ENV%"=="" set NODE_ENV=production

echo.
echo ==================================================
echo   VPS-PK Cloud Platform Deployment Script
echo ==================================================
echo.

if "%1"=="deploy" goto :deploy
if "%1"=="start" goto :start
if "%1"=="stop" goto :stop
if "%1"=="restart" goto :restart
if "%1"=="status" goto :status
if "%1"=="test" goto :test
if "%1"=="lint" goto :lint
if "%1"=="help" goto :help
if "%1"=="-h" goto :help
if "%1"=="--help" goto :help
if "%1"=="" goto :deploy

echo [ERROR] Unknown command: %1
echo Use 'deploy.bat help' for usage information
exit /b 1

:deploy
echo [STEP] Starting full deployment...

call :check_requirements
if errorlevel 1 exit /b 1

call :install_dependencies
if errorlevel 1 exit /b 1

call :setup_environment
if errorlevel 1 exit /b 1

call :create_directories
if errorlevel 1 exit /b 1

if "%NODE_ENV%"=="development" (
    call :run_tests
    if errorlevel 1 exit /b 1
    
    call :lint_code
    if errorlevel 1 exit /b 1
)

call :build_project
if errorlevel 1 exit /b 1

call :start_services
if errorlevel 1 exit /b 1

call :health_check
if errorlevel 1 exit /b 1

call :cleanup
call :show_status
goto :end

:start
echo [STEP] Starting VPS-PK Cloud Platform...
call :start_services
if errorlevel 1 exit /b 1
call :health_check
if errorlevel 1 exit /b 1
call :show_status
goto :end

:stop
echo [STEP] Stopping VPS-PK Cloud Platform...
if exist server.pid (
    for /f %%i in (server.pid) do (
        taskkill /PID %%i /F >nul 2>&1
    )
    del server.pid
    echo [SUCCESS] Server stopped
) else (
    echo [ERROR] Server PID file not found
    exit /b 1
)
goto :end

:restart
echo [STEP] Restarting VPS-PK Cloud Platform...
call :stop
timeout /t 2 /nobreak >nul
call :start
goto :end

:status
echo [STEP] Checking VPS-PK Cloud Platform status...
if exist server.pid (
    for /f %%i in (server.pid) do (
        tasklist /FI "PID eq %%i" 2>nul | find "%%i" >nul
        if !errorlevel! equ 0 (
            echo [SUCCESS] Server is running ^(PID: %%i^)
        ) else (
            echo [ERROR] Server is not running
            exit /b 1
        )
    )
) else (
    echo [ERROR] Server is not running
    exit /b 1
)
goto :end

:test
echo [STEP] Running tests...
call :run_tests
goto :end

:lint
echo [STEP] Running linting...
call :lint_code
goto :end

:help
echo VPS-PK Cloud Platform Deployment Script
echo.
echo Usage: deploy.bat [command]
echo.
echo Commands:
echo   deploy    Full deployment ^(default^)
echo   start     Start the server
echo   stop      Stop the server
echo   restart   Restart the server
echo   status    Check server status
echo   test      Run tests
echo   lint      Run linting
echo   help      Show this help message
echo.
echo Environment Variables:
echo   PORT      Server port ^(default: 3000^)
echo   HOST      Server host ^(default: 0.0.0.0^)
echo   NODE_ENV  Environment ^(default: production^)
goto :end

:check_requirements
echo [STEP] Checking system requirements...

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed. Please install Node.js %NODE_VERSION% or higher.
    exit /b 1
)

REM Check npm
npm --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm is not installed. Please install npm.
    exit /b 1
)

echo [SUCCESS] System requirements check passed
exit /b 0

:install_dependencies
echo [STEP] Installing dependencies...

if exist package-lock.json (
    npm ci --only=production
) else (
    npm install --only=production
)

if errorlevel 1 (
    echo [ERROR] Failed to install dependencies
    exit /b 1
)

echo [SUCCESS] Dependencies installed successfully
exit /b 0

:setup_environment
echo [STEP] Setting up environment configuration...

if not exist .env (
    (
        echo NODE_ENV=%NODE_ENV%
        echo PORT=%PORT%
        echo HOST=%HOST%
        echo REGION=us-east-1
        echo ENABLE_CORS=true
        echo ENABLE_HELMET=true
        echo ENABLE_RATE_LIMIT=true
        echo RATE_LIMIT_WINDOW_MS=900000
        echo RATE_LIMIT_MAX=100
        echo LOG_LEVEL=info
        echo MAX_MEMORY=2048
    ) > .env
    echo [SUCCESS] Environment file created
) else (
    echo [SUCCESS] Environment file already exists
)
exit /b 0

:create_directories
echo [STEP] Creating necessary directories...

if not exist logs mkdir logs
if not exist data mkdir data
if not exist backups mkdir backups
if not exist temp mkdir temp

echo [SUCCESS] Directories created
exit /b 0

:run_tests
echo [STEP] Running tests...

npm test
if errorlevel 1 (
    echo [ERROR] Tests failed. Please fix the issues before deployment.
    exit /b 1
)

echo [SUCCESS] All tests passed
exit /b 0

:lint_code
echo [STEP] Running code linting...

npm run lint
if errorlevel 1 (
    echo [ERROR] Code linting failed. Please fix the issues before deployment.
    exit /b 1
)

echo [SUCCESS] Code linting passed
exit /b 0

:build_project
echo [STEP] Building project...

npm run build
if errorlevel 1 (
    echo [ERROR] Build failed. Please fix the issues before deployment.
    exit /b 1
)

echo [SUCCESS] Project built successfully
exit /b 0

:start_services
echo [STEP] Starting VPS-PK Cloud Platform services...

if "%NODE_ENV%"=="production" (
    start /b npm start
) else (
    start /b npm run dev
)

REM Wait for server to start
timeout /t 5 /nobreak >nul

REM Find the Node.js process
for /f "tokens=2" %%i in ('tasklist /FI "IMAGENAME eq node.exe" /FO CSV ^| find "node.exe"') do (
    echo %%i > server.pid
    goto :server_started
)

echo [ERROR] Failed to start the server
exit /b 1

:server_started
echo [SUCCESS] VPS-PK Cloud Platform started successfully
exit /b 0

:health_check
echo [STEP] Performing health check...

REM Wait for server to be ready
timeout /t 10 /nobreak >nul

REM Check health endpoint
curl -f http://%HOST%:%PORT%/health >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Health check failed. Server may not be running properly.
    exit /b 1
)

echo [SUCCESS] Health check passed
exit /b 0

:cleanup
echo [STEP] Cleaning up temporary files...

if exist temp\* del /q temp\* >nul 2>&1

echo [SUCCESS] Cleanup completed
exit /b 0

:show_status
echo.
echo ==================================================
echo   VPS-PK Cloud Platform Deployment Complete!
echo ==================================================
echo.
echo 🌐 Server URL: http://%HOST%:%PORT%
echo 📊 Health Check: http://%HOST%:%PORT%/health
echo 📚 API Documentation: http://%HOST%:%PORT%/docs
echo 🔧 Service Status: http://%HOST%:%PORT%/status
echo.
echo 📋 Available Services:
echo   • Compute Services ^(15^): ZephyrCore, NebulaRun, StarWeave, etc.
echo   • Storage Services ^(12^): MoonVault, DawnBlock, RiverShare, etc.
echo   • Database Services ^(15^): AuroraBase, CosmoStore, NexusGraph, etc.
echo   • Networking Services ^(12^): SkyNet, PulseBalance, BeaconDNS, etc.
echo   • AI/ML Services ^(15^): IntelliSynth, VisionSpark, LinguaNet, etc.
echo   • Security Services ^(12^): GuardianGate, VaultKey, SentinelWatch, etc.
echo   • And 150+ more services across 20+ categories
echo.
echo 🔑 API Authentication:
echo   Include 'X-API-Key: your-api-key' header in requests
echo.
echo 📖 Quick Start:
echo   curl -H "X-API-Key: your-api-key" http://%HOST%:%PORT%/api/v1/compute/zephyrcore/instances
echo.
echo 🛑 To stop the server: deploy.bat stop
echo.
exit /b 0

:end
endlocal
