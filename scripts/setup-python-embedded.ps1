# Python Embedded Distribution Setup Script
# Creates a minimal Python environment (~15-20MB) instead of PyInstaller (~100-200MB)
#
# Usage: .\setup-python-embedded.ps1 [-Force]
#
# This is an ALTERNATIVE to PyInstaller. Benefits:
# - Much smaller size (~15MB base vs ~80MB PyInstaller runtime)
# - Faster startup (no extraction needed)
# - Easier to debug (can see .py files)
#
# Drawback:
# - Python source files visible (not obfuscated)

param(
    [switch]$Force
)

$ErrorActionPreference = "Stop"

# Configuration
$PYTHON_VERSION = "3.11.9"
$PYTHON_URL = "https://www.python.org/ftp/python/$PYTHON_VERSION/python-$PYTHON_VERSION-embed-amd64.zip"
$PIP_URL = "https://bootstrap.pypa.io/get-pip.py"

$PROJECT_ROOT = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$RESOURCES_DIR = Join-Path $PROJECT_ROOT "resources"
$PYTHON_DIR = Join-Path $RESOURCES_DIR "python-embedded"
$SCRIPTS_PYTHON = Join-Path $PROJECT_ROOT "scripts\python"
$MUT_DISTRIBUTION = Join-Path $PROJECT_ROOT "MUT-distribution"
$TEMP_DIR = Join-Path $env:TEMP "python-embed-setup"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Python Embedded Distribution Setup" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check if already exists
if ((Test-Path (Join-Path $PYTHON_DIR "python.exe")) -and -not $Force) {
    Write-Host "[OK] Python embedded already installed at: $PYTHON_DIR" -ForegroundColor Green
    Write-Host "     Use -Force to re-install" -ForegroundColor Gray
    exit 0
}

# Create directories
Write-Host "[1/6] Creating directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $RESOURCES_DIR | Out-Null
New-Item -ItemType Directory -Force -Path $PYTHON_DIR | Out-Null
New-Item -ItemType Directory -Force -Path $TEMP_DIR | Out-Null

# Download Python embedded
$zipFile = Join-Path $TEMP_DIR "python-embed.zip"
Write-Host "[2/6] Downloading Python $PYTHON_VERSION embedded..." -ForegroundColor Yellow
Write-Host "      URL: $PYTHON_URL" -ForegroundColor Gray

try {
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -Uri $PYTHON_URL -OutFile $zipFile -UseBasicParsing
    $ProgressPreference = 'Continue'
} catch {
    Write-Host "[ERROR] Failed to download Python: $_" -ForegroundColor Red
    exit 1
}

$fileSize = (Get-Item $zipFile).Length / 1MB
Write-Host "      Downloaded: $([math]::Round($fileSize, 1)) MB" -ForegroundColor Gray

# Extract Python
Write-Host "[3/6] Extracting Python..." -ForegroundColor Yellow
Expand-Archive -Path $zipFile -DestinationPath $PYTHON_DIR -Force

# Enable pip by modifying python311._pth
Write-Host "[4/6] Configuring Python for pip..." -ForegroundColor Yellow
$pthFile = Get-ChildItem -Path $PYTHON_DIR -Filter "python*._pth" | Select-Object -First 1
if ($pthFile) {
    # Uncomment 'import site' to enable pip
    $content = Get-Content $pthFile.FullName
    $content = $content -replace '#import site', 'import site'
    # Add Lib\site-packages for pip-installed packages
    $content += "Lib\site-packages"
    Set-Content -Path $pthFile.FullName -Value $content
    Write-Host "      Modified: $($pthFile.Name)" -ForegroundColor Gray
}

# Download and install pip
Write-Host "[5/6] Installing pip..." -ForegroundColor Yellow
$getPipFile = Join-Path $TEMP_DIR "get-pip.py"
$ProgressPreference = 'SilentlyContinue'
Invoke-WebRequest -Uri $PIP_URL -OutFile $getPipFile -UseBasicParsing
$ProgressPreference = 'Continue'

# Run get-pip.py
$pythonExe = Join-Path $PYTHON_DIR "python.exe"
& $pythonExe $getPipFile --no-warn-script-location 2>&1 | Out-Null

# Install required packages
Write-Host "[6/6] Installing required packages..." -ForegroundColor Yellow
$requirementsFile = Join-Path $SCRIPTS_PYTHON "requirements.txt"

if (Test-Path $requirementsFile) {
    Write-Host "      Installing from: requirements.txt" -ForegroundColor Gray
    # Install packages without pip's installer metadata (smaller)
    & $pythonExe -m pip install -r $requirementsFile --no-compile --no-cache-dir 2>&1 | ForEach-Object {
        if ($_ -match "Successfully installed") {
            Write-Host "      $_" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "      [WARN] requirements.txt not found, installing minimal packages" -ForegroundColor Yellow
    & $pythonExe -m pip install boto3 qrcode[pil] python-dotenv Pillow --no-compile --no-cache-dir 2>&1 | Out-Null
}

# Copy pipeline scripts
Write-Host ""
Write-Host "Copying pipeline scripts..." -ForegroundColor Yellow
$scriptsDir = Join-Path $PYTHON_DIR "scripts"
New-Item -ItemType Directory -Force -Path $scriptsDir | Out-Null

# Copy pipeline.py from MUT-distribution
if (Test-Path (Join-Path $MUT_DISTRIBUTION "pipeline.py")) {
    Copy-Item -Path (Join-Path $MUT_DISTRIBUTION "pipeline.py") -Destination $scriptsDir -Force
    Write-Host "      Copied: pipeline.py" -ForegroundColor Gray
}

# Copy stitch_images.py and face_enhancement.py from python folder
$pythonSrcDir = Join-Path $PROJECT_ROOT "python"
if (Test-Path (Join-Path $pythonSrcDir "stitch_images.py")) {
    Copy-Item -Path (Join-Path $pythonSrcDir "stitch_images.py") -Destination $scriptsDir -Force
    Write-Host "      Copied: stitch_images.py" -ForegroundColor Gray
}
if (Test-Path (Join-Path $pythonSrcDir "face_enhancement.py")) {
    Copy-Item -Path (Join-Path $pythonSrcDir "face_enhancement.py") -Destination $scriptsDir -Force
    Write-Host "      Copied: face_enhancement.py" -ForegroundColor Gray
}

# Verify installation
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host " Python Embedded installed successfully!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host "Location: $PYTHON_DIR" -ForegroundColor Gray

$version = & $pythonExe --version 2>&1
Write-Host "Version:  $version" -ForegroundColor Gray

# Show total size
$totalSize = (Get-ChildItem $PYTHON_DIR -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "Size:     $([math]::Round($totalSize, 1)) MB" -ForegroundColor Gray

# Cleanup
Write-Host ""
Write-Host "Cleaning up temporary files..." -ForegroundColor Gray
Remove-Item -Path $TEMP_DIR -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Done! Python embedded is ready." -ForegroundColor Green
Write-Host ""
Write-Host "Usage example:" -ForegroundColor Cyan
Write-Host "  $PYTHON_DIR\python.exe $scriptsDir\pipeline.py --input video.mp4 --frame frame.png" -ForegroundColor Gray
