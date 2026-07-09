# Ensure executing in this script's directory
Set-Location $PSScriptRoot

Write-Host "1. Building the project..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed, aborting."
    exit $LASTEXITCODE
}

Write-Host "`n2. Starting Vite preview server in a background window..." -ForegroundColor Cyan
# Start the preview server in a new window so it runs concurrently
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npx vite preview --host 0.0.0.0 --port 4173"

Write-Host "`n3. Starting secure HTTPS tunnel..." -ForegroundColor Cyan
Write-Host "Press Ctrl+C in this window to stop the tunnel when finished." -ForegroundColor Yellow
$env:UNTUN_ACCEPT_CLOUDFLARE_NOTICE="true"
npx untun tunnel http://localhost:4173
