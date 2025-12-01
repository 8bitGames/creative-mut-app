# FFmpeg Setup Script for MUT Hologram Studio
# Downloads FFmpeg essentials build (~40-50MB instead of ~120MB full build)
#
# Usage: .\setup-ffmpeg.ps1 [-Force]

param(
    [switch]$Force
)

$ErrorActionPreference = "Stop"

# Configuration
$FFMPEG_VERSION = "7.0"
$FFMPEG_URL = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n${FFMPEG_VERSION}-latest-win64-gpl-${FFMPEG_VERSION}.zip"
$FFMPEG_ESSENTIALS_URL = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
$PROJECT_ROOT = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$RESOURCES_DIR = Join-Path $PROJECT_ROOT "resources"
$FFMPEG_DIR = Join-Path $RESOURCES_DIR "ffmpeg"
$TEMP_DIR = Join-Path $env:TEMP "ffmpeg-download"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host " FFmpeg Setup for MUT Hologram Studio" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check if FFmpeg already exists
if ((Test-Path (Join-Path $FFMPEG_DIR "ffmpeg.exe")) -and -not $Force) {
    Write-Host "[OK] FFmpeg already installed at: $FFMPEG_DIR" -ForegroundColor Green
    Write-Host "     Use -Force to re-download" -ForegroundColor Gray
    exit 0
}

# Create directories
Write-Host "[1/4] Creating directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $RESOURCES_DIR | Out-Null
New-Item -ItemType Directory -Force -Path $FFMPEG_DIR | Out-Null
New-Item -ItemType Directory -Force -Path $TEMP_DIR | Out-Null

# Download FFmpeg essentials
$zipFile = Join-Path $TEMP_DIR "ffmpeg-essentials.zip"
Write-Host "[2/4] Downloading FFmpeg essentials..." -ForegroundColor Yellow
Write-Host "      URL: $FFMPEG_ESSENTIALS_URL" -ForegroundColor Gray
Write-Host "      This may take a few minutes..." -ForegroundColor Gray

try {
    # Use faster download with progress
    $ProgressPreference = 'SilentlyContinue'  # Much faster download
    Invoke-WebRequest -Uri $FFMPEG_ESSENTIALS_URL -OutFile $zipFile -UseBasicParsing
    $ProgressPreference = 'Continue'
} catch {
    Write-Host "[ERROR] Failed to download FFmpeg: $_" -ForegroundColor Red
    exit 1
}

$fileSize = (Get-Item $zipFile).Length / 1MB
Write-Host "      Downloaded: $([math]::Round($fileSize, 1)) MB" -ForegroundColor Gray

# Extract
Write-Host "[3/4] Extracting FFmpeg..." -ForegroundColor Yellow
$extractDir = Join-Path $TEMP_DIR "extracted"
Expand-Archive -Path $zipFile -DestinationPath $extractDir -Force

# Find the bin directory (structure varies by build)
$binDir = Get-ChildItem -Path $extractDir -Recurse -Directory | Where-Object { $_.Name -eq "bin" } | Select-Object -First 1

if (-not $binDir) {
    Write-Host "[ERROR] Could not find FFmpeg bin directory in archive" -ForegroundColor Red
    exit 1
}

# Copy executables
Write-Host "[4/4] Installing FFmpeg executables..." -ForegroundColor Yellow
Copy-Item -Path (Join-Path $binDir.FullName "ffmpeg.exe") -Destination $FFMPEG_DIR -Force
Copy-Item -Path (Join-Path $binDir.FullName "ffprobe.exe") -Destination $FFMPEG_DIR -Force

# Verify installation
$ffmpegExe = Join-Path $FFMPEG_DIR "ffmpeg.exe"
if (Test-Path $ffmpegExe) {
    $version = & $ffmpegExe -version 2>&1 | Select-Object -First 1
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host " FFmpeg installed successfully!" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "Location: $FFMPEG_DIR" -ForegroundColor Gray
    Write-Host "Version:  $version" -ForegroundColor Gray

    # Show size
    $totalSize = (Get-ChildItem $FFMPEG_DIR -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
    Write-Host "Size:     $([math]::Round($totalSize, 1)) MB" -ForegroundColor Gray
} else {
    Write-Host "[ERROR] FFmpeg installation failed" -ForegroundColor Red
    exit 1
}

# Cleanup
Write-Host ""
Write-Host "Cleaning up temporary files..." -ForegroundColor Gray
Remove-Item -Path $TEMP_DIR -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Done! FFmpeg is ready for use." -ForegroundColor Green
