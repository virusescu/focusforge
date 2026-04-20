# Improvements Batch 2

## 1. Line Reorder (Ctrl+Up / Ctrl+Down)
In edit mode, Ctrl+Up swaps the current line with the one above, Ctrl+Down swaps with below. Cursor stays within the moved line. Especially useful for reordering task lists and bullet points.

## 2. List Shortcuts (Ctrl+L, Ctrl+T)
- **Ctrl+L** inserts `- ` (unordered list item)
- **Ctrl+T** inserts `- [ ] ` (task list item)

Works the same as Ctrl+1/2/3 for headers — auto-prepends newline if needed.

## 3. NavigationGuard Popup Fixes

### Button Redesign
The "ABORT_NAVIGATION" (stay in session) button is now the prominent orange button. The "PROCEED_AND_SAVE" (end session) button is now a subdued red-tinted ghost button, making it clear which action is safe and which is destructive.

### Escape Key Bug Fix
Previously, pressing Escape while the popup was open would bubble to MainDisplay and call `resetTimer()`, ending the session. Now NavigationGuard captures the Escape key event and dismisses the popup without affecting the timer.

## 4. Auto-Link on Paste
When pasting a URL (http/https) while text is selected in edit mode, automatically wraps it as `[selected text](pasted URL)`. If nothing is selected, paste behaves normally.

## 5. Bold/Italic/Strikethrough Toggle
Ctrl+B, Ctrl+I, and Ctrl+S now work as on/off toggles. If the selected text is already wrapped with the corresponding markers (e.g., `**text**`), pressing the shortcut again removes the markers instead of adding extra ones.

## 6. Heading CSS Adjustments
- **h1**: 0.9rem -> 1.02rem (gold)
- **h2**: 0.78rem -> 0.9rem (orange)
- **h3/h4**: 0.72rem -> 0.84rem, color changed from #dddddd to #5ee8d6 (muted cyan), bottom margin reduced from 0.2rem to 0.1rem
