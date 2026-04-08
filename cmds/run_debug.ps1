Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   FocusForge - Dev Server (Debug)" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Starting Tauri dev server with hot-reload..." -ForegroundColor Yellow
Write-Host ""

# --- Project root is one level up from cmds/ ---
$projectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $projectRoot
npm run tauri dev
Pop-Location
