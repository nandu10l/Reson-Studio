@echo off
echo ============================================
echo  Building Reson Studio Backend (PyInstaller)
echo ============================================
echo.

cd /d "%~dp0backend"

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH.
    echo Please install Python 3.10+ and try again.
    pause
    exit /b 1
)

REM Check if PyInstaller is installed
pip show pyinstaller >nul 2>&1
if errorlevel 1 (
    echo [INFO] Installing PyInstaller...
    pip install pyinstaller
)

echo.
echo [INFO] Building backend.exe...
echo.

pyinstaller --onefile --name backend --clean ^
    --add-data ".env;." ^
    --hidden-import uvicorn ^
    --hidden-import uvicorn.logging ^
    --hidden-import uvicorn.loops ^
    --hidden-import uvicorn.loops.auto ^
    --hidden-import uvicorn.protocols ^
    --hidden-import uvicorn.protocols.http ^
    --hidden-import uvicorn.protocols.http.auto ^
    --hidden-import uvicorn.protocols.websockets ^
    --hidden-import uvicorn.protocols.websockets.auto ^
    --hidden-import uvicorn.lifespan ^
    --hidden-import uvicorn.lifespan.on ^
    --hidden-import fastapi ^
    --hidden-import dotenv ^
    main.py

if errorlevel 1 (
    echo.
    echo [ERROR] PyInstaller build failed!
    pause
    exit /b 1
)

echo.
echo [SUCCESS] Backend built successfully!
echo Output: backend\dist\backend.exe
echo.

REM Copy the built exe to frontend extraResources location
if not exist "%~dp0frontend\assets\backend" mkdir "%~dp0frontend\assets\backend"
copy /y "dist\backend.exe" "%~dp0frontend\assets\backend\backend.exe"
echo [INFO] Copied backend.exe to frontend\assets\backend\

pause
