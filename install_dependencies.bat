@echo off
echo =======================================================
echo  Installing Dependencies for The Algorithm Laboratory
echo =======================================================
echo.
echo Ensuring Python is available...
python --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python is not installed or not added to your system PATH.
    echo Please install Python 3.8+ from https://www.python.org/downloads/
    pause
    exit /b
)
echo.
echo Creating Virtual Environment (venv)...
python -m venv venv
echo.
echo Installing required Python packages inside the venv...
call venv\Scripts\pip install flask flask-cors
echo.
echo =======================================================
echo  Installation Complete!
echo  To start the backend server run:
echo  venv\Scripts\python backend\app.py
echo =======================================================
pause
