@echo off
REM MUT Python Build Script for Windows
REM Builds Python scripts into standalone executables using PyInstaller

echo ============================================
echo  MUT Python Build Script
echo ============================================

REM Set paths
set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..
set PYTHON_SCRIPTS=%SCRIPT_DIR%python
set OUTPUT_DIR=%PROJECT_ROOT%\resources\python

REM Check Python
echo.
echo [1/5] Checking Python installation...
python --version
if errorlevel 1 (
    echo ERROR: Python not found. Please install Python 3.8+
    exit /b 1
)

REM Create virtual environment if not exists
echo.
echo [2/5] Setting up virtual environment...
if not exist "%PYTHON_SCRIPTS%\venv" (
    echo Creating virtual environment...
    python -m venv "%PYTHON_SCRIPTS%\venv"
)

REM Activate virtual environment
call "%PYTHON_SCRIPTS%\venv\Scripts\activate.bat"

REM Install dependencies
echo.
echo [3/5] Installing dependencies...
pip install -r "%PYTHON_SCRIPTS%\requirements.txt" --quiet

REM Create output directory
echo.
echo [4/5] Creating output directory...
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

REM Build executables
echo.
echo [5/5] Building executables with PyInstaller...

echo Building pipeline.exe...
pyinstaller --distpath "%OUTPUT_DIR%" --workpath "%PYTHON_SCRIPTS%\build" "%PYTHON_SCRIPTS%\build_pipeline.spec" --noconfirm

echo Building stitch_images.exe...
pyinstaller --distpath "%OUTPUT_DIR%" --workpath "%PYTHON_SCRIPTS%\build" "%PYTHON_SCRIPTS%\build_stitcher.spec" --noconfirm

REM Copy .env file if exists
if exist "%PROJECT_ROOT%\MUT-distribution\.env" (
    echo Copying .env file...
    copy "%PROJECT_ROOT%\MUT-distribution\.env" "%OUTPUT_DIR%\.env"
)

REM Create output directory for runtime
if not exist "%OUTPUT_DIR%\output" mkdir "%OUTPUT_DIR%\output"

REM Deactivate virtual environment
call deactivate

echo.
echo ============================================
echo  Build Complete!
echo ============================================
echo Output directory: %OUTPUT_DIR%
echo.
echo Files created:
dir /b "%OUTPUT_DIR%\*.exe" 2>nul

echo.
echo Next steps:
echo 1. Run 'npm run dist' to build the Electron app
echo 2. The Python executables will be bundled with the app
echo.
