# Download and install FFmpeg
Write-Host "Downloading FFmpeg..."
$url = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
$output = "C:\Users\Administrator\ffmpeg.zip"
$extractPath = "C:\ffmpeg"

# Download
Invoke-WebRequest -Uri $url -OutFile $output

# Extract
Write-Host "Extracting..."
if (Test-Path $extractPath) {
    Remove-Item -Recurse -Force $extractPath
}
Expand-Archive -Path $output -DestinationPath $extractPath -Force

# Find the bin folder
$binPath = Get-ChildItem -Path $extractPath -Recurse -Directory -Filter "bin" | Select-Object -First 1 -ExpandProperty FullName

Write-Host "FFmpeg bin path: $binPath"

# Add to PATH for current user
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($currentPath -notlike "*$binPath*") {
    [Environment]::SetEnvironmentVariable("Path", "$currentPath;$binPath", "User")
    Write-Host "Added FFmpeg to user PATH"
}

# Clean up zip
Remove-Item $output -Force

Write-Host "Done! FFmpeg installed at: $binPath"
Write-Host "Please restart your terminal to use ffmpeg command"
