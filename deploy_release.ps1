Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   FocusForge - Build Release Bundle" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Building Tauri app in release mode..." -ForegroundColor Yellow
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

$msiFiles = Get-ChildItem -Path "src-tauri\target\release\bundle\msi\*.msi" -ErrorAction SilentlyContinue
if ($msiFiles) {
    $msi = $msiFiles | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    Write-Host "Found MSI: " -NoNewline -ForegroundColor Cyan
    Write-Host $msi.Name
    $answer = Read-Host "Do you want to install it now? (Y/N)"
    if ($answer -eq 'Y' -or $answer -eq 'y') {
        Write-Host "Launching installer..." -ForegroundColor Yellow
        Start-Process msiexec.exe -ArgumentList "/i", "`"$($msi.FullName)`"" -Wait
        Write-Host "Done." -ForegroundColor Green
    }
} else {
    Write-Host "No .msi file found in bundle output." -ForegroundColor Yellow
}

Read-Host "Press Enter to exit"
