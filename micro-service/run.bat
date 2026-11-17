@echo off
title Civic AI Microservice - Florence-2 ^& MiniLM
echo ==========================================================
echo Starting Civic AI Microservice [FastAPI + Florence-2]
echo ==========================================================

cd /d "%~dp0"

REM 1. Check if virtual environment exists
if not exist "venv\Scripts\activate.bat" (
    echo [INFO] Virtual environment 'venv' not found. Creating one...
    python -m venv venv
    if errorlevel 1 (
        echo [ERROR] Python not found or failed to create venv. Please ensure Python is installed.
        pause
        exit /b 1
    )
    echo [INFO] Virtual environment created.
    
    echo [INFO] Activating virtual environment...
    call venv\Scripts\activate.bat

    echo [INFO] Installing PyTorch with CUDA 12.4 support...
    pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124

    echo [INFO] Installing requirements...
    pip install -r requirements.txt
) else (
    echo [INFO] Activating existing virtual environment...
    call venv\Scripts\activate.bat
)

REM 2. Unblock PyTorch DLLs (prevent Windows App Control / MOTW blocks)
powershell -Command "Get-ChildItem -Path '%~dp0venv\Lib\site-packages\torch' -Recurse | Unblock-File -ErrorAction SilentlyContinue"

REM 3. Start the FastAPI server
echo ==========================================================
echo [INFO] Launching FastAPI on http://localhost:8000
echo [INFO] Swagger Docs: http://localhost:8000/docs
echo ==========================================================
python -m uvicorn main:app --host 0.0.0.0 --port 8000

pause
