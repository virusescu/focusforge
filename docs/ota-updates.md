# OTA Updates for FocusForge

FocusForge is a **Tauri 2** desktop app. Tauri ships a first-party updater plugin (`tauri-plugin-updater`) that handles the full update lifecycle: version checking, download, signature verification, and installation.

---

## How It Works (Conceptual Flow)

```
App starts (or user triggers check)
    ↓
Fetch update metadata JSON from a public URL
    ↓
Compare remote version with current app version
    ↓
[No update] → do nothing
[Update available] → notify user (prompt or silent)
    ↓
User accepts → download signed installer
    ↓
Verify signature against embedded public key
    ↓
Install + prompt restart
```

---

## What You Actually Need

### 1. Tauri Updater Plugin

Add to `src-tauri/Cargo.toml`:
```toml
[dependencies]
tauri-plugin-updater = "2"
```

Register in `src-tauri/src/lib.rs`:
```rust
tauri::Builder::default()
    .plugin(tauri_plugin_updater::Builder::new().build())
```

Configure in `tauri.conf.json`:
```json
{
  "plugins": {
    "updater": {
      "pubkey": "YOUR_PUBLIC_KEY_HERE",
      "endpoints": [
        "https://your-server.com/focusforge/update/{{target}}/{{arch}}/{{current_version}}"
      ]
    }
  }
}
```

> `{{target}}`, `{{arch}}`, and `{{current_version}}` are template variables Tauri fills in automatically at runtime.

---

### 2. Signing Keys (Mandatory)

Tauri 2 **requires** cryptographic signing — unsigned updates are rejected.

Generate a key pair once:
```bash
npm run tauri signer generate -- -w ~/.tauri/focusforge.key
```

This produces:
- `~/.tauri/focusforge.key` — **private key** (never commit this)
- `~/.tauri/focusforge.key.pub` — **public key** (embed this in `tauri.conf.json`)

Set the private key as an environment variable during builds:
```bash
TAURI_SIGNING_PRIVATE_KEY=<contents of .key file>
TAURI_SIGNING_PRIVATE_KEY_PASSWORD=<your password>
```

---

### 3. Update Metadata Endpoint

The app polls a URL that returns a JSON response in this shape:

```json
{
  "version": "1.2.0",
  "notes": "Bug fixes and performance improvements.",
  "pub_date": "2026-04-06T00:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "url": "https://your-server.com/releases/focusforge_1.2.0_x64-setup.nsis.zip",
      "signature": "<base64 signature from build output>"
    }
  }
}
```

This JSON file can be:
- A static file hosted on **GitHub Releases** (free, simplest)
- A file on **S3 / Cloudflare R2**
- A lightweight API endpoint that reads from your release pipeline

---

### 4. Signed Release Artifacts

Each release build must be signed. Running `npm run tauri build` with the private key env var set will automatically produce `.sig` files alongside each installer.

You need to publish:
- The installer (`.msi`, `.nsis.zip` on Windows; `.dmg` on macOS)
- The `.sig` signature file
- The updated metadata JSON pointing to both

---

### 5. Frontend Integration

Trigger an update check from the React/TS side:

```typescript
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

async function checkForUpdates() {
  const update = await check();
  if (update) {
    // Show a prompt to the user
    await update.downloadAndInstall();
    await relaunch();
  }
}
```

You can call this on app startup, on a timer, or via a manual "Check for Updates" button in settings.

---

## Simplest Viable Setup: GitHub Releases

1. Make the repo public (GitHub Releases download URLs require no auth on public repos).
2. On each release, run `npm run tauri build` in CI (GitHub Actions) with the private key in secrets.
3. Upload the built installer + `.sig` to a GitHub Release.
4. Host a static `update.json` file (via GitHub Pages or raw GitHub) pointing to the latest release artifacts.
5. Set `endpoints` in `tauri.conf.json` to that JSON URL.

This costs **$0** and is the standard approach for indie Tauri apps.

---

## Manual Release Workflow (No Automation)

Every time you ship a new version, do this:

1. **Bump the version** in `src-tauri/tauri.conf.json`:
   ```json
   { "version": "1.1.0" }
   ```

2. **Build with signing env vars set:**
   ```bash
   TAURI_SIGNING_PRIVATE_KEY=$(cat ~/.tauri/focusforge.key) \
   TAURI_SIGNING_PRIVATE_KEY_PASSWORD=yourpassword \
   npm run tauri build
   ```
   This produces (on Windows):
   - `src-tauri/target/release/bundle/nsis/FocusForge_1.1.0_x64-setup.exe`
   - `src-tauri/target/release/bundle/nsis/FocusForge_1.1.0_x64-setup.nsis.zip`
   - `src-tauri/target/release/bundle/nsis/FocusForge_1.1.0_x64-setup.nsis.zip.sig`

3. **Create a GitHub Release:**
   - Go to your repo → Releases → Draft a new release
   - Tag: `v1.1.0`
   - Write release notes
   - Upload the `.nsis.zip` and `.nsis.zip.sig` files

4. **Copy the download URL** of the uploaded `.nsis.zip` from the release page.

5. **Update `update.json`** with the new version, URL, and the contents of the `.sig` file (base64 string):
   ```json
   {
     "version": "1.1.0",
     "notes": "What changed in this release.",
     "pub_date": "2026-04-06T00:00:00Z",
     "platforms": {
       "windows-x86_64": {
         "url": "https://github.com/you/focusforge/releases/download/v1.1.0/FocusForge_1.1.0_x64-setup.nsis.zip",
         "signature": "<paste contents of .sig file here>"
       }
     }
   }
   ```

6. **Commit and push `update.json`** — the app will pick it up on next check.

**The easy parts:** steps 1, 3, 6.
**The parts easy to forget:** bumping the version, updating the JSON, using the signing env vars.

---

## Automated Release Workflow (GitHub Actions)

Set this up once and releasing becomes: push a git tag → everything else is automatic.

### Step 1 — Store secrets in GitHub

Go to your repo → Settings → Secrets and variables → Actions, and add:
- `TAURI_SIGNING_PRIVATE_KEY` — contents of `~/.tauri/focusforge.key`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — your key password

### Step 2 — Create the workflow file

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'  # triggers on tags like v1.1.0

jobs:
  release:
    runs-on: windows-latest
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 'lts/*'

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Install dependencies
        run: npm install

      - name: Build and release
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: FocusForge ${{ github.ref_name }}
          releaseBody: 'See release notes.'
          releaseDraft: true   # set to false to publish immediately
          prerelease: false
```

### Step 3 — Release by pushing a tag

```bash
# Bump version in tauri.conf.json first, then:
git add src-tauri/tauri.conf.json
git commit -m "chore: bump version to 1.1.0"
git tag v1.1.0
git push origin master --tags
```

GitHub Actions builds, signs, and creates a draft release automatically. You just review it and click Publish.

### Step 4 — Update `update.json`

This part is still manual unless you add a second workflow step. After publishing the release, grab the asset URLs and the `.sig` content and update your `update.json` file. A fully automated version would use a script in the workflow to generate and commit this file — worth doing once releases become frequent.

---

## What a Public HTTP Link Alone Won't Give You

| Requirement | Just a download link | Full updater setup |
|---|---|---|
| App knows a new version exists | No | Yes |
| User is notified in-app | No | Yes |
| Signature verified before install | No | Yes (mandatory) |
| Works silently / automatically | No | Yes |
| Platform-specific installer | Manual | Automatic |

---

## Summary of Changes Required

- [ ] Add `tauri-plugin-updater` dependency and register it in Rust
- [ ] Generate signing key pair; store private key securely (env var / CI secret)
- [ ] Embed public key in `tauri.conf.json` and configure `endpoints`
- [ ] Set up a release pipeline (GitHub Actions recommended) that builds with `TAURI_SIGNING_PRIVATE_KEY` set
- [ ] Host a metadata JSON file at a stable public URL
- [ ] Add update check logic to the frontend (startup hook or settings UI)
- [ ] Bump `version` in `tauri.conf.json` on each release
