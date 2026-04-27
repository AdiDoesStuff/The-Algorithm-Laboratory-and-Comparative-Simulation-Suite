@echo off
setlocal

cd /d "%~dp0"

if not exist "venv\Scripts\python.exe" (
    echo =======================================================
    echo  Virtual environment not found.
    echo  Run install_dependencies.bat first, then start_app.bat.
    echo =======================================================
    pause
    exit /b 1
)

echo =======================================================
echo  Starting The Algorithm Laboratory
echo =======================================================
echo.
echo Opening http://127.0.0.1:5000
echo Close this window to stop the app.
echo.

start "" "http://127.0.0.1:5000"
"venv\Scripts\python.exe" "backend\app.py"

pause
