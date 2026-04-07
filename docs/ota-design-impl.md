# OTA Updates — Design & Implementation Tracker

Use this file to track progress. Check off items as they are completed. If the session is interrupted, resume from the first unchecked item.

---

## Progress Checklist

### One-Time Manual Setup (YOU do this)
- [x] Generate signing keys (`npm run tauri signer generate -- -w ~/.tauri/focusforge.key`)
- [x] Add `TAURI_SIGNING_PRIVATE_KEY` secret to GitHub repo
- [x] Add `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` secret to GitHub repo
- [x] Embed public key + endpoint into `tauri.conf.json` (see `docs/ota-guide.md`)

### Implementation (Claude does this)
- [x] Add `tauri-plugin-updater` to `src-tauri/Cargo.toml`
- [x] Register updater plugin in `src-tauri/src/lib.rs`
- [x] Add `plugins.updater` config to `src-tauri/tauri.conf.json` (pubkey placeholder + endpoint)
- [x] Add `@tauri-apps/plugin-updater` and `@tauri-apps/plugin-process` npm packages
- [x] Create update check hook in frontend (startup, shows prompt dialog)
- [x] Create `UpdatePrompt` component (version info + Update Now / Skip buttons)
- [x] Wire `UpdatePrompt` into `App.tsx` or root component
- [x] Modify `deploy_release.ps1` — replace local build with git tag + push
- [x] Create `.github/workflows/release.yml`
- [x] Create initial `update.json` in repo root (empty/placeholder for v0.1.2)
- [x] Commit everything

---

## Design

### Overview

FocusForge uses Tauri 2's `tauri-plugin-updater` for OTA updates. On startup, the app checks a static `update.json` file hosted on raw GitHub. If a newer version is available, a prompt dialog appears. The user can install immediately or skip. GitHub Actions handles building, signing, publishing, and updating `update.json` automatically when a release tag is pushed.

---

### Release Flow

```
Developer runs deploy_release.bat
    ↓
deploy_release.ps1:
  - Auto-increments patch version in tauri.conf.json, Cargo.toml, package.json
  - git commit "chore: bump version to x.x.x"
  - git tag vx.x.x
  - git push origin master + tag
    ↓
GitHub Actions triggers (.github/workflows/release.yml):
  - Builds app on windows-latest with signing env vars
  - Creates GitHub Release, uploads .nsis.zip + .nsis.zip.sig
  - Reads asset URL + .sig contents
  - Generates update.json
  - Commits and pushes update.json to master
    ↓
Next app startup → fetches update.json → prompts user → downloads + installs
```

---

### Section 1: deploy_release.ps1 Changes

Keep existing version bump logic (lines 1–44) unchanged. Replace everything after the `git commit` with:

```powershell
git tag "v$newVersion"
git push origin master
git push origin "v$newVersion"

Write-Host "Pushed v$newVersion — GitHub Actions will build and publish the release." -ForegroundColor Green
Read-Host "Press Enter to exit"
```

Remove: local `npm run tauri build`, MSI detection, and install prompt.

---

### Section 2: GitHub Actions Workflow

File: `.github/workflows/release.yml`

Trigger: `push` on tags matching `v*`

Steps:
1. Checkout repo
2. Setup Node (lts) and Rust (stable)
3. `npm install`
4. Run `tauri-apps/tauri-action@v0` with:
   - `GITHUB_TOKEN`, `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` from secrets
   - `releaseDraft: false`, `prerelease: false`
5. After release is created, run a script step that:
   - Uses `gh` CLI to get the `.nsis.zip` asset download URL and the `.nsis.zip.sig` asset contents
   - Writes `update.json` to repo root
   - `git commit` + `git push` back to master

`update.json` shape:
```json
{
  "version": "x.x.x",
  "notes": "Release vx.x.x",
  "pub_date": "<ISO timestamp>",
  "platforms": {
    "windows-x86_64": {
      "url": "<nsis.zip download URL>",
      "signature": "<contents of .sig file>"
    }
  }
}
```

---

### Section 3: Frontend Update Prompt

**Startup hook** — runs once on mount in `App.tsx` (or a top-level component):

```typescript
import { check } from '@tauri-apps/plugin-updater';

useEffect(() => {
  check().then(update => {
    if (update) setAvailableUpdate(update);
  });
}, []);
```

**`UpdatePrompt` component** — shown when `availableUpdate` is set:
- Displays: "Update available: vX.X.X" + release notes
- Button: **Update Now** → calls `update.downloadAndInstall()` then `relaunch()`
- Button: **Skip** → dismisses, no re-prompt until next startup

---

### Section 4: tauri.conf.json additions

```json
"plugins": {
  "updater": {
    "pubkey": "REPLACE_WITH_PUBLIC_KEY",
    "endpoints": [
      "https://raw.githubusercontent.com/virusescu/focusforge/master/update.json"
    ]
  }
}
```

The public key placeholder will be filled in manually after key generation (see `docs/ota-guide.md`).

---

### Section 5: Cargo.toml & lib.rs

Add dependency:
```toml
tauri-plugin-updater = "2"
```

Register in `lib.rs`:
```rust
.plugin(tauri_plugin_updater::Builder::new().build())
```

---

## Notes

- Repo: `github.com/virusescu/focusforge`
- Current version: `0.1.2` (next release will be `0.1.3`)
- Windows only for now (single platform in `update.json`)
- `update.json` lives in repo root, served via `raw.githubusercontent.com`
- Private key must NEVER be committed — lives only in `~/.tauri/` and GitHub Secrets
