@echo off
echo ============================================
echo    Reson Studio - Development Mode
echo ============================================
echo.
echo Starting application...
echo  - Backend: Python FastAPI on port 8000
echo  - Frontend: React dev server on port 3000
echo  - Desktop: Electron window
echo.
echo Press Ctrl+C to stop all processes.
echo ============================================
echo.

cd /d "%~dp0frontend"
npm run start
