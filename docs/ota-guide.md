# OTA Setup — Manual Steps

These are the one-time steps you need to do before the first automated release works.

---

## Step 1 — Generate Signing Keys

Run this once on your machine:

```bash
npm run tauri signer generate -- -w ~/.tauri/focusforge.key
```

This produces two files:
- `~/.tauri/focusforge.key` — **private key** (never commit this)
- `~/.tauri/focusforge.key.pub` — **public key** (goes into tauri.conf.json)

---

## Step 2 — Add Secrets to GitHub

Go to: `https://github.com/virusescu/focusforge` → Settings → Secrets and variables → Actions → New repository secret

Add these secrets:

| Name | Value |
|------|-------|
| `TAURI_SIGNING_PRIVATE_KEY` | Full contents of `~/.tauri/focusforge.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | The password you chose when generating the key |
| `VITE_GOOGLE_CLIENT_ID` | Your Google OAuth client ID |
| `VITE_GOOGLE_CLIENT_SECRET` | Your Google OAuth client secret |
| `TELEGRAM_BOT_TOKEN` | Token from @BotFather (e.g. `123456789:ABCdef...`) |
| `TELEGRAM_CHAT_ID` | Your Telegram chat ID (see instructions below) |

#### Setting up the Telegram bot

1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Send `/newbot` and follow the prompts — choose a name and username for your bot
3. BotFather will reply with a token like `123456789:ABCdefGHI...` — this is your `TELEGRAM_BOT_TOKEN`

#### Getting your Chat ID

1. Send any message to your new bot in Telegram
2. Open this URL in your browser (replace `YOUR_TOKEN` with your actual token):
   ```
   https://api.telegram.org/botYOUR_TOKEN/getUpdates
   ```
3. Look for `"chat":{"id":XXXXXXXXX}` in the JSON response — that number is your `TELEGRAM_CHAT_ID`

> If the response is empty (`"result":[]`), make sure you sent a message to the bot first, then try again.

---

## Step 3 — Embed the Public Key in tauri.conf.json

Open `~/.tauri/focusforge.key.pub` and copy its contents.

Add the following to `src-tauri/tauri.conf.json` under the root object:

```json
"plugins": {
  "updater": {
    "pubkey": "<paste contents of focusforge.key.pub here>",
    "endpoints": [
      "https://raw.githubusercontent.com/virusescu/focusforge/master/update.json"
    ]
  }
}
```

Commit this change to the repo.

---

## That's It

After these three steps, every future release is just:

```bat
deploy_release.bat
```

GitHub Actions handles the build, signing, release creation, and `update.json` update automatically.
