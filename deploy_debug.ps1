Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   FocusForge - Build Debug Bundle" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Building Tauri app in debug mode..." -ForegroundColor Yellow
Write-Host ""
npm run tauri build -- --debug
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Build failed!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host ""
Write-Host "Debug build complete!" -ForegroundColor Green
Write-Host "Find the output in: " -NoNewline -ForegroundColor Green
Write-Host "src-tauri\target\debug\bundle\"
Write-Host ""
Read-Host "Press Enter to exit"
