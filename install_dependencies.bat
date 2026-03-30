@echo off
echo =======================================================
echo  Installing Dependencies for The Algorithm Laboratory
echo =======================================================
echo.
echo Ensuring Python and pip are available...
python --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python is not installed or not added to your system PATH.
    echo Please install Python 3.8+ from https://www.python.org/downloads/
    pause
    exit /b
)
echo.
echo Installing required Python packages (flask, flask-cors)...
pip install flask flask-cors
echo.
echo =======================================================
echo  Installation Complete!
echo  You can now double-click index.html and start the
echo  backend server by running: python app.py
echo =======================================================
pause
