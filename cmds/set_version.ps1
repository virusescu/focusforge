param(
    [Parameter(Mandatory=$true)]
    [string]$NewVersion
)

# Strip leading 'v' if present
$NewVersion = $NewVersion.TrimStart('v')

Write-Host "Updating project version to $NewVersion..." -ForegroundColor Cyan

# --- Project root is one level up from cmds/ ---
$projectRoot = Split-Path $PSScriptRoot -Parent

$tauriConfPath = Join-Path $projectRoot "src-tauri\tauri.conf.json"
$cargoPath = Join-Path $projectRoot "src-tauri\Cargo.toml"
$pkgPath = Join-Path $projectRoot "package.json"

# 1. Update tauri.conf.json
if (Test-Path $tauriConfPath) {
    $raw = Get-Content $tauriConfPath -Raw
    $raw = $raw -replace '"version":\s*"\d+\.\d+\.\d+"', "`"version`": `"$NewVersion`""
    Set-Content $tauriConfPath $raw -NoNewline
    Write-Host " - Updated $tauriConfPath" -ForegroundColor Gray
}

# 2. Update Cargo.toml (main package version only)
if (Test-Path $cargoPath) {
    $lines = Get-Content $cargoPath
    $replaced = $false
    $newLines = $lines | ForEach-Object {
        if (-not $replaced -and $_ -match '^version = "\d+\.\d+\.\d+"') {
            $replaced = $true
            "version = `"$NewVersion`""
        } else {
            $_
        }
    }
    Set-Content $cargoPath $newLines
    Write-Host " - Updated $cargoPath" -ForegroundColor Gray
}

# 3. Update package.json
if (Test-Path $pkgPath) {
    $raw = Get-Content $pkgPath -Raw
    $raw = $raw -replace '"version":\s*"\d+\.\d+\.\d+"', "`"version`": `"$NewVersion`""
    Set-Content $pkgPath $raw -NoNewline
    Write-Host " - Updated $pkgPath" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Successfully set version to $NewVersion" -ForegroundColor Green
