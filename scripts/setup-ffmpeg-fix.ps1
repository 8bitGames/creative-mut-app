# FFmpeg Setup Script for Windows
# Downloads and extracts FFmpeg to resources/ffmpeg

$ErrorActionPreference = "Stop"

Write-Host "Setting up FFmpeg for MUT Hologram Studio..." -ForegroundColor Cyan

# Create directory
$resourcesDir = Join-Path $PSScriptRoot "..\resources\ffmpeg"
New-Item -ItemType Directory -Force -Path $resourcesDir | Out-Null

# Check if already exists
if ((Test-Path (Join-Path $resourcesDir "ffmpeg.exe")) -and (Test-Path (Join-Path $resourcesDir "ffprobe.exe"))) {
    Write-Host "FFmpeg already exists in resources/ffmpeg" -ForegroundColor Green
    exit 0
}

# Download FFmpeg
$ffmpegUrl = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
$tempDir = Join-Path $env:TEMP "ffmpeg-download"
$zipFile = Join-Path $tempDir "ffmpeg.zip"

Write-Host "Creating temp directory..."
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

Write-Host "Downloading FFmpeg from GitHub..."
Write-Host "URL: $ffmpegUrl"

try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $ffmpegUrl -OutFile $zipFile -UseBasicParsing
    Write-Host "Download complete!" -ForegroundColor Green
} catch {
    Write-Host "Download failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host "Extracting archive..."
$extractDir = Join-Path $tempDir "extracted"
Expand-Archive -Path $zipFile -DestinationPath $extractDir -Force

# Find the bin directory
$binDir = Get-ChildItem -Path $extractDir -Recurse -Directory -Filter "bin" | Select-Object -First 1

if ($binDir) {
    Write-Host "Found bin directory: $($binDir.FullName)"

    # Copy executables
    $ffmpegExe = Join-Path $binDir.FullName "ffmpeg.exe"
    $ffprobeExe = Join-Path $binDir.FullName "ffprobe.exe"

    if (Test-Path $ffmpegExe) {
        Copy-Item -Path $ffmpegExe -Destination $resourcesDir -Force
        Write-Host "Copied ffmpeg.exe" -ForegroundColor Green
    }

    if (Test-Path $ffprobeExe) {
        Copy-Item -Path $ffprobeExe -Destination $resourcesDir -Force
        Write-Host "Copied ffprobe.exe" -ForegroundColor Green
    }
} else {
    Write-Host "ERROR: Could not find bin directory in extracted archive" -ForegroundColor Red
    exit 1
}

# Cleanup
Write-Host "Cleaning up temporary files..."
Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue

# Verify
Write-Host ""
Write-Host "Verification:" -ForegroundColor Cyan
$ffmpegPath = Join-Path $resourcesDir "ffmpeg.exe"
$ffprobePath = Join-Path $resourcesDir "ffprobe.exe"

if ((Test-Path $ffmpegPath) -and (Test-Path $ffprobePath)) {
    Write-Host "SUCCESS: FFmpeg setup complete!" -ForegroundColor Green
    Write-Host "  - ffmpeg.exe: $ffmpegPath"
    Write-Host "  - ffprobe.exe: $ffprobePath"

    # Show version
    & $ffmpegPath -version | Select-Object -First 1
} else {
    Write-Host "ERROR: FFmpeg setup failed" -ForegroundColor Red
    exit 1
}
