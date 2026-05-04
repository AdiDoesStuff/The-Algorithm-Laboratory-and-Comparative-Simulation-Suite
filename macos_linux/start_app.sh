#!/bin/bash

# Navigate to the project root directory (parent of this script's folder)
cd "$(dirname "$0")/.."

# Check if venv exists
if [ ! -f "venv/bin/python" ]; then
    echo "======================================================="
    echo " Virtual environment not found."
    echo " Run ./macos_linux/install_dependencies.sh first."
    echo "======================================================="
    exit 1
fi

echo "======================================================="
echo " Starting The Algorithm Laboratory"
echo "======================================================="
echo ""

# Detect OS and open browser
URL="http://127.0.0.1:5000"
echo "Opening $URL"

if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    open "$URL"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    if command -v xdg-open &> /dev/null; then
        xdg-open "$URL"
    else
        echo "Please open $URL in your browser manually."
    fi
fi

echo "Close this terminal to stop the app."
echo ""

# Run the app using the venv python
./venv/bin/python backend/app.py
