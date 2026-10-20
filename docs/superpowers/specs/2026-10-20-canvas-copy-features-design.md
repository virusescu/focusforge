# Canvas Copy Features — Design

**Date:** 2026-10-20  
**Status:** Ready for planning

---

## Intent and Why

Three connected improvements to reduce friction in the Canvas view and markdown rendering across the app:

1. Rename "Buckets" to "Canvas" everywhere — the current name doesn't reflect the freeform spatial nature of the view.
2. Quick-copy on canvas notes — copying a note's content currently requires entering edit mode, selecting all, and copying manually. A one-click copy button removes that friction.
3. `[c]` row copy marker and code block copy buttons — power-user feature for notes and objective details. Certain lines contain reusable content (commands, snippets, references). Marking them `[c]` makes them instantly copyable without selecting text, and the copy produces richly formatted output that pastes well into OneNote and similar tools.

---

## Goals

- Rename Buckets → Canvas across all user-visible text, routes, and internal identifiers where practical.
- Canvas note cards show a copy icon (on hover) that copies the full note as rich HTML + plain text to the clipboard in one click.
- In any markdown render (`MarkdownView`), lines containing `[c]` show a small copy icon. Clicking copies the rendered line as rich HTML + plain text (marker stripped). Shift-click copies the raw markdown of that line (marker stripped).
- Fenced code blocks in any markdown render get an automatic copy button (top-right corner). Clicking copies the raw code as plain text only.
- `[c]` markers are invisible in view mode — they never appear in rendered output.
- `[c]` markers are visible in edit mode — they appear as literal text so the user can see and edit them.

## Non-Goals

- No change to the canvas layout, bucket panels, drag/resize, or any other Canvas behaviour.
- No rich text editor — markdown stays as the authoring format.
- No database schema changes.
- Shift-click on a code block copy button has no special behaviour (code is already the raw source).

## Anti-Goals

- The copy button on a note card must not trigger when the user is trying to drag or interact with the note.
- `[c]` must not appear as visible text or affect layout in view mode.
- Copying should never produce markdown artifacts (like `[c]`) in the rich or plain output.

---

## Constraints

- Clipboard dual-format write: `text/html` + `text/plain` via the `ClipboardItem` API (already available in the Tauri WebView). Fallback: `navigator.clipboard.writeText` for environments that don't support `ClipboardItem`.
- `MarkdownView` uses `react-markdown` + remark plugins. The `[c]` marker must be handled as a remark plugin (MDAST transform) so it is stripped before rendering and a copy button is injected via a custom React component, consistent with how checkbox line indices are already threaded through via `hProperties`.
- All existing `MarkdownView` behaviour (task checkboxes, external links, scroll tables) must be unaffected.

---

## How It Gets Made

### 1. Rename Buckets → Canvas

**User-visible changes:**
- Sidebar nav label: "Buckets" → "Canvas"
- Page header/title in `BucketsPage`
- Any tooltips or aria-labels

**Internal identifier changes (builder's call on scope):**
- File renames are a nice-to-have; the builder may rename `BucketsPage` → `CanvasPage` and related files, or leave filenames and rename only user-facing strings. Either is acceptable — consistency is preferred.
- `view` state value `'buckets'` in `App.tsx` may stay as `'buckets'` internally (routing is not user-visible) or be renamed to `'canvas'`. Builder's call.

---

### 2. Note Card Quick-Copy

**Location:** `CanvasNoteView.tsx`

**Behaviour:**
- A small copy icon (e.g. `Copy` from lucide-react) appears in the note's header/toolbar area, visible on hover (or always visible — builder's call on subtlety).
- Click: copies the note's `content` field as dual-format (rich HTML rendered from markdown + plain text stripped of markdown).
- The button must not be positioned where it would conflict with the drag handle.
- No shift-click variant needed for the whole-note copy (the user can enter edit mode to get raw markdown).
- Brief visual feedback on copy (e.g. icon swaps to a checkmark for 1.5 s) — builder's call on implementation.

**Clipboard helper:** a shared utility function `copyToClipboard(markdown: string): Promise<void>` should be extracted to `src/utils/clipboard.ts`. It renders the markdown to HTML (using a headless render or a simple marked/remark pass), then writes both `text/html` and `text/plain` via `ClipboardItem`, falling back to `writeText` with the plain version.

---

### 3. `[c]` Row Copy Marker in MarkdownView

**Syntax:** `[c]` anywhere on a line marks that line as copyable. The marker is stripped from all output.

Examples:
```
Run this to reset: npm run clean [c]
**Important config:** VITE_KEY=abc123 [c]
```

**Remark plugin (`remarkCopyMarker`):**
- Walk the MDAST after remark-gfm.
- For each `paragraph`, `heading`, or `listItem` node, inspect the raw text content of its inline children.
- If the text contains `[c]` (case-sensitive, exact), set `data.hProperties['data-copy-line'] = true` on the node and strip the `[c]` from the text node's value.
- Builder's note: `[c]` inside a code span or fenced code block must NOT be treated as a copy marker — only in prose lines.

**React component:**
- Override the relevant block elements (`p`, `h1`–`h6`, `li`) in `MARKDOWN_COMPONENTS` to check for `data-copy-line`.
- When present, wrap the element's content with a `<span className={styles.copyRow}>` and append a small `<CopyRowButton>` component.
- `CopyRowButton` reads the rendered text of its sibling span and calls the clipboard helper on click. Shift-click passes the raw markdown line instead (the remark plugin should also store the raw source text in `data.hProperties['data-copy-source']`).

**Context threading:** follow the existing pattern in `MarkdownView` — use `createContext` to thread the copy source string down to `CopyRowButton` without prop drilling.

---

### 4. Code Block Copy Button

**Behaviour:**
- Every fenced code block (`pre > code`) gets a copy button in the top-right corner of the `pre` element.
- Clicking copies the raw code content as `text/plain` only (plain text, no HTML formatting).
- Visual feedback: same 1.5 s checkmark swap as note card.

**Implementation:**
- Override `pre` in `MARKDOWN_COMPONENTS` with a `CodeBlock` wrapper component that positions a copy button absolutely within the `pre`.
- The code content is available from `props.children` (the `code` element's text content).

---

## Clipboard Utility (`src/utils/clipboard.ts`)

```ts
// Writes markdown as rich HTML + plain text to clipboard.
// Falls back to plain text if ClipboardItem is unavailable.
export async function copyMarkdownAsRich(markdown: string): Promise<void>

// Writes plain text only.
export async function copyPlainText(text: string): Promise<void>
```

The rich copy renders markdown → HTML using a minimal remark/rehype pipeline (same plugins as `MarkdownView` minus the interactive ones). Plain text is the markdown stripped of all syntax (a simple regex pass is acceptable for single lines; a proper text extractor for full notes).

---

## Files Expected to Change

| File | Change |
|------|--------|
| `src/utils/clipboard.ts` | New — clipboard helper |
| `src/components/MarkdownView.tsx` | Add `remarkCopyMarker` plugin, `CopyRowButton`, `CodeBlock` component overrides |
| `src/components/MarkdownView.module.scss` | Styles for copy row button and code block copy button |
| `src/components/CanvasNoteView.tsx` | Add note-level copy button |
| `src/components/CanvasNoteView.module.scss` | Styles for note copy button |
| `src/components/BucketsPage.tsx` | Rename user-visible strings → "Canvas" |
| `src/components/SidebarLeft.tsx` | Nav label rename |
| `src/components/SidebarLeft.module.scss` | Possible if class names reference "buckets" |
| `src/App.tsx` | Route/view label if renamed |

---

## Builder Calls (Already Decided)

- `[c]` is case-sensitive and exact. `[C]` or `[copy]` are not markers.
- `[c]` inside code spans/fenced blocks is never treated as a marker.
- View mode: marker is invisible. Edit mode: marker is visible as literal text.
- Shift+click on a row copy button → raw markdown of that line (marker stripped).
- Shift+click on a code block copy button → no special behaviour (same as click).
- Copy button on note card: full note content, no shift-click variant.
- Clipboard format: `text/html` + `text/plain` for prose; `text/plain` only for code blocks.
- Visual feedback on copy: icon swaps to checkmark for ~1.5 s.
