Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   FocusForge - Build Release Bundle" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Building release..." -ForegroundColor Yellow
Write-Host ""
npm run tauri build
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Build failed!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host ""
Write-Host "Release build complete!" -ForegroundColor Green
Write-Host "Find the installer in: " -NoNewline -ForegroundColor Green
Write-Host "src-tauri\target\release\bundle\"
Write-Host ""
Read-Host "Press Enter to exit"
