$ErrorActionPreference = "Stop"

function Write-Header($title) {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "   $title" -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""
}

function Check-OK($label, $value) {
    Write-Host "  " -NoNewline
    Write-Host "[OK]" -ForegroundColor Green -NoNewline
    Write-Host " $label $value"
}

function Check-Missing($label, $hint) {
    Write-Host "  " -NoNewline
    Write-Host "[MISSING]" -ForegroundColor Red -NoNewline
    Write-Host " $label"
    if ($hint) {
        Write-Host "           $hint" -ForegroundColor DarkGray
    }
}

Write-Header "FocusForge - Dependency Checker"

$missing = 0

# ---- Node.js ----
Write-Host "[1/6] Checking Node.js..." -ForegroundColor White
try {
    $v = node --version 2>&1
    Check-OK "Node.js" $v
} catch {
    Check-Missing "Node.js is not installed." "Download: https://nodejs.org/  (LTS recommended)"
    $missing++
}

# ---- npm ----
Write-Host "[2/6] Checking npm..." -ForegroundColor White
try {
    $v = npm --version 2>&1
    Check-OK "npm" $v
} catch {
    Check-Missing "npm is not installed (should come with Node.js)." ""
    $missing++
}

# ---- Cargo ----
Write-Host "[3/6] Checking Rust (cargo)..." -ForegroundColor White
try {
    $v = cargo --version 2>&1
    Check-OK "" $v
} catch {
    Check-Missing "Rust is not installed." "Download: https://rustup.rs/ — run rustup-init.exe then restart terminal"
    $missing++
}

# ---- rustc ----
Write-Host "[4/6] Checking Rust compiler (rustc)..." -ForegroundColor White
try {
    $v = rustc --version 2>&1
    Check-OK "" $v
} catch {
    Check-Missing "rustc not found." "Re-run the rustup installer."
    $missing++
}

# ---- WebView2 ----
Write-Host "[5/6] Checking Microsoft WebView2 Runtime..." -ForegroundColor White
$wv2Keys = @(
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
    "HKCU:\Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
)
$wv2Found = $wv2Keys | Where-Object { Test-Path $_ }
if ($wv2Found) {
    Check-OK "Microsoft WebView2 Runtime found" ""
} else {
    Check-Missing "Microsoft WebView2 Runtime is not installed." "Download: https://developer.microsoft.com/en-us/microsoft-edge/webview2/ (Evergreen x64)"
    $missing++
}

# ---- MSVC Build Tools ----
Write-Host "[6/6] Checking MSVC Build Tools (Visual C++)..." -ForegroundColor White
$clFound = Get-Command cl.exe -ErrorAction SilentlyContinue
$vswhereExe = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$vswhereFound = $false
if (-not $clFound -and (Test-Path $vswhereExe)) {
    $vsPath = & $vswhereExe -latest -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2>$null
    $vswhereFound = $vsPath -ne $null -and $vsPath -ne ""
}
if ($clFound) {
    Check-OK "MSVC cl.exe found in PATH" ""
} elseif ($vswhereFound) {
    Check-OK "MSVC Build Tools found via vswhere" ""
} else {
    Check-Missing "MSVC Build Tools (Visual C++ compiler) not found." "Install: https://visualstudio.microsoft.com/visual-cpp-build-tools/"
    $missing++
}

# ---- Summary ----
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
if ($missing -eq 0) {
    Write-Host "  All dependencies found! You are good to go." -ForegroundColor Green
    Write-Host ""
    Write-Host "  Next steps:" -ForegroundColor Yellow
    Write-Host "    1. npm install          (install JS dependencies)" -ForegroundColor DarkGray
    Write-Host "    2. .\run_debug.bat       (start dev server)" -ForegroundColor DarkGray
    Write-Host "    3. .\deploy_release.bat  (build installer)" -ForegroundColor DarkGray
} else {
    Write-Host "  $missing dependenc$(if($missing -eq 1){'y is'}else{'ies are'}) MISSING (see above)." -ForegroundColor Red
    Write-Host "  Install them, restart your terminal, and run setup again." -ForegroundColor Yellow
}
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
