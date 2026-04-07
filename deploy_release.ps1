Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   FocusForge - Build Release Bundle" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# --- Auto-increment patch version ---
$tauriConfPath = "src-tauri\tauri.conf.json"
$cargoPath = "src-tauri\Cargo.toml"
$pkgPath = "package.json"

$tauriRaw = Get-Content $tauriConfPath -Raw
if ($tauriRaw -match '"version":\s*"(\d+)\.(\d+)\.(\d+)"') {
    $major = $Matches[1]
    $minor = $Matches[2]
    $patch = [int]$Matches[3] + 1
    $newVersion = "$major.$minor.$patch"

    Write-Host "Bumping version: $major.$minor.$($patch - 1) -> $newVersion" -ForegroundColor Yellow

    # Update tauri.conf.json
    $tauriRaw = $tauriRaw -replace '"version":\s*"\d+\.\d+\.\d+"', "`"version`": `"$newVersion`""
    Set-Content $tauriConfPath $tauriRaw -NoNewline

    # Update Cargo.toml — only the [package] version (first occurrence)
    $cargoLines = Get-Content $cargoPath
    $replaced = $false
    $cargoLines = $cargoLines | ForEach-Object {
        if (-not $replaced -and $_ -match '^version = "\d+\.\d+\.\d+"') {
            $replaced = $true
            "version = `"$newVersion`""
        } else {
            $_
        }
    }
    Set-Content $cargoPath $cargoLines

    # Update package.json
    $pkgRaw = Get-Content $pkgPath -Raw
    $pkgRaw = $pkgRaw -replace '"version":\s*"\d+\.\d+\.\d+"', "`"version`": `"$newVersion`""
    Set-Content $pkgPath $pkgRaw -NoNewline

    # Git commit the version bump
    git add $tauriConfPath $cargoPath $pkgPath
    git commit -m "chore: bump version to $newVersion"

    Write-Host ""
} else {
    Write-Host "WARNING: Could not parse version from $tauriConfPath" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Building Tauri app in release mode (v$newVersion)..." -ForegroundColor Yellow
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
