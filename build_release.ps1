Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   FocusForge - Build Release Bundle" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# --- Robust .env loading (handles multi-line keys) ---
$envFile = Join-Path $PSScriptRoot ".env"
if (Test-Path $envFile) {
    Write-Host "Loading signing environment from .env..." -ForegroundColor Yellow
    $content = Get-Content $envFile -Raw
    # Regex to find Key="Value" even if Value spans multiple lines
    $matches = [regex]::Matches($content, '(?m)^([^#\s][^=]*)=(?:(?:"([^"]*)")|(?:''([^'']*)'')|([^#\s\r\n]*))')
    foreach ($m in $matches) {
        $name = $m.Groups[1].Value.Trim()
        $value = $m.Groups[2].Value # Double quoted
        if (-not $value) { $value = $m.Groups[3].Value } # Single quoted
        if (-not $value) { $value = $m.Groups[4].Value } # Unquoted
        
        if ($name) {
            Set-Content "env:$name" $value
            [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

# --- Safety Check ---
if (-not $env:TAURI_SIGNING_PRIVATE_KEY) {
    Write-Host "CRITICAL: TAURI_SIGNING_PRIVATE_KEY is EMPTY!" -ForegroundColor Red
} else {
    $lineCount = ($env:TAURI_SIGNING_PRIVATE_KEY -split "`n").Count
    Write-Host "Found signing key ($lineCount lines detected)." -ForegroundColor Green
}

Write-Host ""
Write-Host "Building release..." -ForegroundColor Yellow
Write-Host ""

npx tauri build --verbose

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Build failed!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "Release build complete!" -ForegroundColor Green
Write-Host ""

# --- List artifacts ---
Write-Host "Generated Artifacts:" -ForegroundColor Cyan
$bundlePath = Join-Path $PSScriptRoot "src-tauri\target\release\bundle"
if (Test-Path $bundlePath) {
    Get-ChildItem -Path $bundlePath -Recurse | Where-Object { -not $_.PSIsContainer } | ForEach-Object {
        $fullPath = $_.FullName
        $relative = $fullPath.Replace($PSScriptRoot, "").TrimStart("\")
        Write-Host " - $relative" -ForegroundColor Gray
    }
}

Write-Host ""
Read-Host "Press Enter to exit"
