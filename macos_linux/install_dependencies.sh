#!/bin/bash

# Navigate to the project root directory (parent of this script's folder)
cd "$(dirname "$0")/.."

echo "======================================================="
echo " Installing Dependencies for The Algorithm Laboratory"
echo "======================================================="
echo ""

# Check for python3
if ! command -v python3 &> /dev/null
then
    echo "[ERROR] python3 could not be found."
    echo "Please install Python 3.8+ using Homebrew (brew install python) or from python.org"
    exit 1
fi

echo "Creating Virtual Environment (venv)..."
python3 -m venv venv
echo ""

echo "Installing required Python packages inside the venv..."
# Use the python inside venv to install
./venv/bin/pip install -r requirements.txt
echo ""

echo "======================================================="
echo " Installation Complete!"
echo " To start the backend server run:"
echo " ./macos_linux/start_app.sh"
echo "======================================================="
