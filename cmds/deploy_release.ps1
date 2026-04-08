Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   FocusForge - Build Release Bundle" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# --- Project root is one level up from cmds/ ---
$projectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $projectRoot

# --- Sync with server ---
Write-Host "Synchronizing with remote repository..." -ForegroundColor Yellow
git pull
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to pull from remote! Please resolve conflicts manually." -ForegroundColor Red
    exit 1
}
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
    git add $tauriConfPath $cargoPath $pkgPath "src-tauri\Cargo.lock"
    git commit -m "chore: bump version to $newVersion"

    Write-Host ""
} else {
    Write-Host "WARNING: Could not parse version from $tauriConfPath" -ForegroundColor Red

    exit 1
}

Write-Host "Tagging and pushing v$newVersion to trigger GitHub Actions build..." -ForegroundColor Yellow
Write-Host ""

git tag "v$newVersion"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to create git tag!" -ForegroundColor Red

    exit 1
}

git push origin master
git push origin "v$newVersion"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to push to origin!" -ForegroundColor Red

    exit 1
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Released v$newVersion" -ForegroundColor Green
Write-Host "  GitHub Actions is building now." -ForegroundColor Green
Write-Host "  Check: https://github.com/virusescu/focusforge/actions" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

Pop-Location
