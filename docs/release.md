# Build, Release and Updates

Related docs: [architecture.md](architecture.md)

## Scripts

The Windows scripts in the repo root are thin `.bat` wrappers around PowerShell
scripts in `cmds/`:

| Script | Runs | What it does |
|---|---|---|
| `setup.bat` | `cmds/setup.ps1` | Checks for Node, npm, cargo, rustc, the WebView2 runtime and the MSVC build tools. |
| `run_debug.bat` | `cmds/run_debug.ps1` | `npm run tauri dev` (hot reload). |
| `build_release.bat` | `cmds/build_release.ps1` | A local, **signed** release build. Loads `.env`, cleans the old bundles, runs `npx tauri build`, and offers to launch the installer. |
| `set_version.bat X.Y.Z` | `cmds/set_version.ps1` | Writes the version to `package.json`, `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json`. |
| `deploy_release.bat` | `cmds/deploy_release.ps1` | Bumps the version, tags it and pushes, which triggers CI (see below). |

npm scripts: `dev`, `build` (`tsc -b && vite build`), `lint`, `test`,
`test:watch`, `tauri`.

**Quick unsigned debug binary**, without installers and without needing a
signing key:

```bash
npx tauri build --debug --no-bundle
# → src-tauri/target/debug/app.exe
```

## Environment variables

These live in `.env`, which is git-ignored. Only the names are listed here:

| Variable | Used by |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | OAuth (compiled into the frontend) |
| `VITE_GOOGLE_CLIENT_SECRET` | OAuth (compiled into the frontend) |
| `TAURI_SIGNING_PRIVATE_KEY` | Signing updater artifacts (release builds only) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | The signing key's password |

Turso credentials are **not** environment variables. Each user enters them in
the app on first launch.

## Versioning

The version lives in three files that must stay in sync: `package.json`,
`src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json`. `src-tauri/Cargo.lock`
also records it.

## Release flow

```
deploy_release.bat
  1. git pull
  2. bump the patch version in tauri.conf.json, Cargo.toml, package.json
  3. commit "chore: bump version to X.Y.Z"  (also stages Cargo.lock)
  4. git tag vX.Y.Z
  5. git push origin master && git push origin vX.Y.Z
        │
        ▼
GitHub Actions  .github/workflows/release.yml   (on push of a v* tag, windows-latest)
  1. Telegram: "build started"
  2. npm install, Rust stable toolchain
  3. write TAURI_SIGNING_PRIVATE_KEY to a temp file
  4. gh release create vX.Y.Z  (or reuse it if it exists)
  5. tauri-apps/tauri-action: build + sign + upload bundles
  6. upload the NSIS *-setup.exe and *-setup.exe.sig
  7. generate update.json (version, notes, pub_date, windows-x86_64 url + signature)
  8. commit "chore: update update.json for vX.Y.Z" to master and push
  9. Telegram: "released successfully" / "build failed"
```

Because of step 8, **master moves forward after every release**. Pull before
starting new work.

> **Note:** `deploy_release.ps1` stages `Cargo.lock` but doesn't regenerate it,
> so the lock file's `app` version lags one release behind until the next local
> `cargo` build updates it. Commit that change when it shows up.

### GitHub secrets

These are configured under repo **Settings → Secrets → Actions**:
`TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`,
`VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_CLIENT_SECRET`, `TELEGRAM_BOT_TOKEN`,
`TELEGRAM_CHAT_ID`.

### First-time signing setup

Generate a key pair, keep the private key out of the repo, and put its contents
and password in the GitHub secrets above:

```bash
npm run tauri signer generate -- -w ~/.tauri/focusforge.key
```

The public key goes in `plugins.updater.pubkey` in `tauri.conf.json`.

## OTA updates

- **Endpoint:** `https://raw.githubusercontent.com/virusescu/focusforge/master/update.json` (`plugins.updater.endpoints`).
- **Check:** on startup `App.tsx` calls `check()` from `@tauri-apps/plugin-updater`. If a newer version exists, `UpdatePrompt` offers to install it and restart.
- **Verification:** the updater checks each download's signature against the public key in `tauri.conf.json`, so only builds signed with the release key are installed.
- **Platforms:** only `windows-x86_64` is published.
