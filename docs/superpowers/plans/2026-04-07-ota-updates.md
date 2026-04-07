# OTA Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add fully automated OTA updates to FocusForge — on startup the app checks for a new version and shows a prompt; releasing is done by running `deploy_release.bat` which triggers GitHub Actions to build, sign, publish, and update the metadata.

**Architecture:** `tauri-plugin-updater` handles version checking and installation. A React component mirrors the existing modal pattern (overlay + cyber-styled dialog). GitHub Actions builds on `windows-latest`, uploads release assets, then generates and commits `update.json` back to master. The deploy script replaces its local build step with a tag push.

**Tech Stack:** Tauri 2, `tauri-plugin-updater`, `@tauri-apps/plugin-updater`, `@tauri-apps/plugin-process`, React, SCSS Modules, GitHub Actions (`tauri-apps/tauri-action@v0`), PowerShell

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src-tauri/Cargo.toml` | Modify | Add `tauri-plugin-updater = "2"` dependency |
| `src-tauri/src/lib.rs` | Modify | Register updater plugin |
| `src/components/UpdatePrompt.tsx` | Create | Update available dialog component |
| `src/components/UpdatePrompt.module.scss` | Create | Cyber-styled modal matching existing design language |
| `src/App.tsx` | Modify | Add startup update check + render `<UpdatePrompt>` |
| `deploy_release.ps1` | Modify | Replace local build with git tag + push |
| `.github/workflows/release.yml` | Create | CI: build, sign, release, update update.json |
| `update.json` | Create | Initial placeholder metadata file |

> Note: `src-tauri/tauri.conf.json` already has the `plugins.updater` block with pubkey and endpoint — no changes needed.

---

## Task 1: Add Rust dependency and register plugin

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add `tauri-plugin-updater` to Cargo.toml**

Open `src-tauri/Cargo.toml`. Add the dependency after `tauri-plugin-store`:

```toml
[dependencies]
serde_json = "1.0"
serde = { version = "1.0", features = ["derive"] }
log = "0.4"
tauri = { version = "2", features = [] }
tauri-plugin-log = "2"
tauri-plugin-shell = "2"
tauri-plugin-store = "2"
tauri-plugin-updater = "2"
tiny_http = "0.12"
```

- [ ] **Step 2: Register the plugin in lib.rs**

Open `src-tauri/src/lib.rs`. Add `.plugin(tauri_plugin_updater::Builder::new().build())` after the store plugin registration:

```rust
mod oauth;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_store::Builder::default().build())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .invoke_handler(tauri::generate_handler![
      oauth::wait_for_oauth_callback,
      oauth::get_available_port,
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Debug)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
```

- [ ] **Step 3: Verify it compiles**

```bash
cd src-tauri && cargo check
```

Expected: no errors. First run will download `tauri-plugin-updater` — takes ~30 seconds.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/lib.rs
git commit -m "feat: register tauri-plugin-updater"
```

---

## Task 2: Install frontend npm packages

**Files:** (no source files — just package.json / node_modules)

- [ ] **Step 1: Install the two Tauri frontend plugins**

```bash
npm install @tauri-apps/plugin-updater @tauri-apps/plugin-process
```

- [ ] **Step 2: Verify packages are present**

```bash
grep -E "plugin-updater|plugin-process" package.json
```

Expected output (versions may differ):
```
"@tauri-apps/plugin-process": "^2.x.x",
"@tauri-apps/plugin-updater": "^2.x.x",
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install tauri updater and process frontend plugins"
```

---

## Task 3: Create UpdatePrompt component

**Files:**
- Create: `src/components/UpdatePrompt.tsx`
- Create: `src/components/UpdatePrompt.module.scss`

The component matches the existing modal pattern (NavigationGuard) — dark overlay, cyber border, monospace font. Uses green (`#00ff88`) accent since it's a positive system event, not a warning.

- [ ] **Step 1: Create `UpdatePrompt.tsx`**

```tsx
import { useState, type FC } from 'react';
import { Download, X, Zap } from 'lucide-react';
import type { Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import styles from './UpdatePrompt.module.scss';

interface UpdatePromptProps {
  update: Update;
  onSkip: () => void;
}

export const UpdatePrompt: FC<UpdatePromptProps> = ({ update, onSkip }) => {
  const [installing, setInstalling] = useState(false);

  const handleInstall = async () => {
    setInstalling(true);
    await update.downloadAndInstall();
    await relaunch();
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <Zap className={styles.icon} size={20} />
            <span className={styles.title}>SYSTEM_UPDATE // NEW_VERSION_DETECTED</span>
          </div>
          <div className={styles.id}>SYS: v{update.version}</div>
        </div>

        <div className={styles.content}>
          <p className={styles.message}>
            FORGE_UPDATE <span className={styles.highlight}>v{update.version}</span> IS READY FOR DEPLOYMENT.
            INSTALL NOW TO RECEIVE THE LATEST SYSTEM PATCHES.
          </p>
          {update.body && (
            <div className={styles.notes}>{update.body}</div>
          )}
          <div className={styles.subtext}>
            THE APP WILL RESTART AUTOMATICALLY AFTER INSTALLATION.
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.btnSkip} onClick={onSkip} disabled={installing}>
            <X size={16} />
            <span>SKIP_UPDATE</span>
          </button>
          <button className={styles.btnInstall} onClick={handleInstall} disabled={installing}>
            <Download size={16} />
            <span>{installing ? 'INSTALLING...' : 'INSTALL_NOW'}</span>
          </button>
        </div>

        <div className={styles.decoration}>
          <div className={styles.line} />
          <div className={styles.dots}>
            {[...Array(4)].map((_, i) => <div key={i} className={styles.dot} />)}
          </div>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Create `UpdatePrompt.module.scss`**

```scss
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: fadeIn 0.2s ease-out;
}

.modal {
  width: 520px;
  background: #0a0a0a;
  border: 1px solid #00ff88;
  box-shadow: 0 0 30px rgba(0, 255, 136, 0.2);
  padding: 1.5rem;
  position: relative;
  overflow: hidden;
  animation: modalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 2px;
    background: linear-gradient(90deg, transparent, #00ff88, transparent);
  }
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  border-bottom: 1px solid rgba(0, 255, 136, 0.2);
  padding-bottom: 0.75rem;

  .titleGroup {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .icon {
    color: #00ff88;
    animation: pulse 2s infinite;
  }

  .title {
    font-size: 0.85rem;
    font-weight: 800;
    letter-spacing: 0.2em;
    color: #00ff88;
  }

  .id {
    font-size: 0.6rem;
    color: rgba(0, 255, 136, 0.4);
    font-family: var(--font-mono);
  }
}

.content {
  margin-bottom: 2.5rem;

  .message {
    font-size: 1.1rem;
    line-height: 1.6;
    color: #e5e5e5;
    margin-bottom: 1rem;
    font-family: var(--font-mono);

    .highlight {
      color: #00ff88;
      font-weight: bold;
      text-shadow: 0 0 10px rgba(0, 255, 136, 0.4);
    }
  }

  .notes {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
    font-family: var(--font-mono);
    border-left: 2px solid rgba(0, 255, 136, 0.3);
    padding-left: 0.75rem;
    margin-bottom: 1rem;
    white-space: pre-wrap;
  }

  .subtext {
    font-size: 0.7rem;
    color: rgba(255, 255, 255, 0.4);
    letter-spacing: 0.1em;
    font-weight: 600;
  }
}

.footer {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.btnSkip,
.btnInstall {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1.5rem;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: all 0.2s;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.btnSkip {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.3);
    color: white;
  }
}

.btnInstall {
  background: #00ff88;
  border: none;
  color: #0a0a0a;
  box-shadow: 0 0 15px rgba(0, 255, 136, 0.3);

  &:hover:not(:disabled) {
    background: #33ffaa;
    box-shadow: 0 0 25px rgba(0, 255, 136, 0.5);
    transform: translateY(-1px);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }
}

.decoration {
  margin-top: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;

  .line {
    flex: 1;
    height: 1px;
    background: rgba(0, 255, 136, 0.1);
  }

  .dots {
    display: flex;
    gap: 4px;

    .dot {
      width: 4px;
      height: 4px;
      background: rgba(0, 255, 136, 0.2);
    }
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes modalIn {
  from { transform: translateY(10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/UpdatePrompt.tsx src/components/UpdatePrompt.module.scss
git commit -m "feat: add UpdatePrompt component"
```

---

## Task 4: Wire update check into App.tsx

**Files:**
- Modify: `src/App.tsx`

The check runs once on mount inside `HudApp` (after providers are available). Only shown when the app is fully loaded and authenticated — not on the login or setup screens.

- [ ] **Step 1: Add imports and state to HudApp**

At the top of `src/App.tsx`, add the new imports:

```tsx
import { useState, useEffect } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import type { Update } from '@tauri-apps/plugin-updater';
import { UpdatePrompt } from './components/UpdatePrompt';
```

Replace the existing `import { useState } from 'react';` line with the above block (note: `useEffect` is added).

- [ ] **Step 2: Add update state and effect inside HudApp**

Inside the `HudApp` function, after the existing `useState`/`useFocus`/`useAuth` lines, add:

```tsx
const [availableUpdate, setAvailableUpdate] = useState<Update | null>(null);

useEffect(() => {
  check().then(update => {
    if (update) setAvailableUpdate(update);
  }).catch(() => {
    // silently ignore — no network, server down, etc.
  });
}, []);
```

- [ ] **Step 3: Render UpdatePrompt in JSX**

Inside the `HudApp` return, add `<UpdatePrompt>` alongside the existing modals. Place it after `<SeasonTransitionModal />`:

```tsx
return (
  <>
    <div className="hud-container">
      <GlitchOverlay />
      <Header />
      {view === 'hud' ? (
        <>
          <SidebarLeft />
          <MainDisplay onViewAnalytics={() => handleViewAnalytics()} onViewIntel={handleViewIntel} onViewVault={handleViewVault} />
          <SidebarRight onViewAnalytics={(date) => handleViewAnalytics(date)} onViewIntel={handleViewIntel} onViewVault={handleViewVault} />
        </>
      ) : view === 'analytics' ? (
        <AnalyticsView initialDate={analyticsDate} onBack={() => setView('hud')} />
      ) : view === 'vault' ? (
        <VaultPage onBack={() => setView('hud')} />
      ) : (
        <IntelligenceHub onBack={() => setView('hud')} />
      )}
      <Footer />

      {pendingNavigation && (
        <NavigationGuard
          onConfirm={handleConfirmNavigation}
          onCancel={handleCancelNavigation}
        />
      )}
    </div>
    <RewardToast />
    <SeasonTransitionModal />
    {availableUpdate && (
      <UpdatePrompt
        update={availableUpdate}
        onSkip={() => setAvailableUpdate(null)}
      />
    )}
  </>
);
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run build
```

Expected: build completes with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: check for updates on startup and show prompt"
```

---

## Task 5: Modify deploy_release.ps1

**Files:**
- Modify: `deploy_release.ps1`

Keep the version bump logic (lines 1–51) exactly as-is. Replace everything from line 53 onwards with a tag + push.

- [ ] **Step 1: Replace the build section**

The current file from line 53 onwards is:
```powershell
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
```

Replace it with:
```powershell
Write-Host "Tagging and pushing v$newVersion to trigger GitHub Actions build..." -ForegroundColor Yellow
Write-Host ""

git tag "v$newVersion"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to create git tag!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

git push origin master
git push origin "v$newVersion"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to push to origin!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Released v$newVersion" -ForegroundColor Green
Write-Host "  GitHub Actions is building now." -ForegroundColor Green
Write-Host "  Check: https://github.com/virusescu/focusforge/actions" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

Read-Host "Press Enter to exit"
```

- [ ] **Step 2: Commit**

```bash
git add deploy_release.ps1
git commit -m "feat: deploy_release now tags and pushes instead of building locally"
```

---

## Task 6: Create GitHub Actions workflow

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Create `.github/workflows/` directory and `release.yml`**

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: windows-latest
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 'lts/*'

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Install dependencies
        run: npm install

      - name: Build and release
        id: tauri
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: FocusForge ${{ github.ref_name }}
          releaseBody: Release ${{ github.ref_name }}
          releaseDraft: false
          prerelease: false

      - name: Generate update.json
        shell: pwsh
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          $version = "${{ github.ref_name }}".TrimStart('v')
          $repo = "virusescu/focusforge"
          $tag = "${{ github.ref_name }}"

          # Get release assets
          $release = gh api repos/$repo/releases/tags/$tag | ConvertFrom-Json

          # Find the .nsis.zip asset and its .sig
          $zipAsset = $release.assets | Where-Object { $_.name -like "*.nsis.zip" } | Select-Object -First 1
          $sigAsset  = $release.assets | Where-Object { $_.name -like "*.nsis.zip.sig" } | Select-Object -First 1

          if (-not $zipAsset -or -not $sigAsset) {
            Write-Error "Could not find nsis.zip or .sig asset in release"
            exit 1
          }

          $zipUrl = $zipAsset.browser_download_url

          # Download the .sig file contents
          $sigContent = gh api $sigAsset.url --header "Accept: application/octet-stream"

          $pubDate = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")

          $updateJson = @{
            version = $version
            notes   = "Release v$version"
            pub_date = $pubDate
            platforms = @{
              "windows-x86_64" = @{
                url       = $zipUrl
                signature = $sigContent
              }
            }
          } | ConvertTo-Json -Depth 5

          Set-Content -Path "update.json" -Value $updateJson -NoNewline
          Write-Host "Generated update.json for v$version"

      - name: Commit update.json
        shell: pwsh
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add update.json
          git commit -m "chore: update update.json for ${{ github.ref_name }}"
          git push origin HEAD:master
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "feat: add GitHub Actions release workflow"
```

---

## Task 7: Create initial update.json

**Files:**
- Create: `update.json`

This placeholder tells existing installs (once the updater is wired in) that they are already on the latest version. It will be overwritten by CI on first real release.

- [ ] **Step 1: Create `update.json` in repo root**

```json
{
  "version": "0.1.2",
  "notes": "Initial release.",
  "pub_date": "2026-04-07T00:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "url": "",
      "signature": ""
    }
  }
}
```

- [ ] **Step 2: Commit and push everything**

```bash
git add update.json
git commit -m "chore: add initial update.json placeholder"
git push origin master
```

---

## Task 8: Update progress tracker

**Files:**
- Modify: `docs/ota-design-impl.md`

- [ ] **Step 1: Mark all implementation items as complete**

Open `docs/ota-design-impl.md` and change all `- [ ]` items under "Implementation (Claude does this)" to `- [x]`.

- [ ] **Step 2: Commit**

```bash
git add docs/ota-design-impl.md
git commit -m "chore: mark OTA implementation complete in tracker"
```

---

## Self-Review Notes

- `tauri.conf.json` already has `plugins.updater` with pubkey and endpoint — Task 1 correctly skips it
- `Update` type is imported from `@tauri-apps/plugin-updater` in both the component and App.tsx — consistent
- The `check()` catch silently swallows errors — correct, update checks should never crash the app
- `update.json` URL in `tauri.conf.json`: `https://raw.githubusercontent.com/virusescu/focusforge/master/update.json` — matches where we commit it
- The workflow uses `HEAD:master` for the push-back to avoid detached HEAD issues on tag checkouts
- `gh api` is pre-installed on `windows-latest` GitHub Actions runners — no extra setup needed
