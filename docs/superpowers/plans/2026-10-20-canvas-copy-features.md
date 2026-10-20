# Canvas Copy Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add quick-copy everywhere markdown is rendered — a `[c]` line marker, auto code-block copy buttons, a one-click note card copy, and rename Buckets → Canvas.

**Architecture:** A shared `clipboard.ts` utility writes dual-format (`text/html` + `text/plain`) to the clipboard using the DOM's own rendered output (no new markdown-to-HTML pipeline needed). A new remark plugin (`remarkCopyMarker`) strips `[c]` from MDAST text nodes and annotates nodes with `data-copy-line`/`data-copy-source` props, which custom React component overrides in `MarkdownView` read to render inline copy buttons. Code blocks get a standalone wrapper component. The note card reads its rendered DOM directly.

**Tech Stack:** React 19, react-markdown, remark (MDAST plugin), ClipboardItem API (Tauri WebView), lucide-react icons, Vitest + RTL.

**Spec:** `docs/superpowers/specs/2026-10-20-canvas-copy-features-design.md`

## Global Constraints

- `[c]` is case-sensitive and exact; `[C]` and `[copy]` are not markers.
- `[c]` inside a code span or fenced code block is never treated as a marker.
- `[c]` is invisible in view mode; visible as literal text in edit mode (textarea).
- Default click → `text/html` + `text/plain` (rich copy); Shift+click → raw markdown (plain only).
- Code block copy → `text/plain` only; no Shift+click variant.
- Note card copy → full note content, dual-format; no Shift+click variant.
- Visual feedback on copy: icon swaps to a checkmark for 1.5 s.
- Only `remark-gfm` and `remark-breaks` are already installed (no rehype-stringify).
- HTML for clipboard comes from the rendered DOM (`innerHTML`/`innerText`), not a separate pipeline.

## Review Focus

- `[c]` appears inside a code span (`` `foo [c]` ``) — must **not** be treated as a marker; rendered output must include the literal `[c]`.
- A line contains multiple `[c]` tokens — both must be stripped; only one copy button appears.
- Shift+click copy source should not contain the `[c]` token — verify stripping in the stored `data-copy-source`.
- `ClipboardItem` is unavailable (some older WebViews) — `copyRich` must fall back to `writeText` with the plain version.
- Copy button inside a list item with a task checkbox — both controls must render and be independently clickable without interfering.

---

### Task 1: Clipboard Utility

**Files:**
- Create: `src/utils/clipboard.ts`
- Test: `src/utils/clipboard.test.ts`

**Interfaces:**
- Produces:
  - `copyRich(html: string, plain: string): Promise<void>` — writes `text/html` + `text/plain` via `ClipboardItem`; falls back to `navigator.clipboard.writeText(plain)` if `ClipboardItem` is undefined.
  - `copyPlain(text: string): Promise<void>` — writes `text/plain` only via `navigator.clipboard.writeText`.

- [ ] **Step 1: Write failing tests**

```ts
// src/utils/clipboard.test.ts
import { copyRich, copyPlain } from './clipboard';

it('copyRich writes html and plain via ClipboardItem', async () => {
  const write = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('ClipboardItem', class { constructor(public data: Record<string, Blob>) {} });
  Object.assign(navigator, { clipboard: { write, writeText: vi.fn() } });
  await copyRich('<b>hi</b>', 'hi');
  expect(write).toHaveBeenCalledOnce();
  const item = write.mock.calls[0][0][0];
  expect(Object.keys(item.data)).toEqual(expect.arrayContaining(['text/html', 'text/plain']));
});

it('copyRich falls back to writeText when ClipboardItem is undefined', async () => {
  vi.stubGlobal('ClipboardItem', undefined);
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  await copyRich('<b>hi</b>', 'hi');
  expect(writeText).toHaveBeenCalledWith('hi');
});

it('copyPlain calls writeText with the given string', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  await copyPlain('hello');
  expect(writeText).toHaveBeenCalledWith('hello');
});
```

- [ ] **Step 2: Run tests — expect FAIL** (`copyRich is not a function`)

`npm test -- clipboard`

- [ ] **Step 3: Implement `src/utils/clipboard.ts`**

Export `copyRich(html, plain)` and `copyPlain(text)` with the signatures above. `copyRich` constructs a `ClipboardItem` with two `Blob` entries (`text/html`, `text/plain`), calls `navigator.clipboard.write([item])`, and catches the `ClipboardItem` undefined case with a try/typeof guard.

- [ ] **Step 4: Run tests — expect PASS**

`npm test -- clipboard`

- [ ] **Step 5: Commit**

```bash
git add src/utils/clipboard.ts src/utils/clipboard.test.ts
git commit -m "feat: add clipboard utility for dual-format copy"
```

---

### Task 2: Rename Buckets → Canvas

**Files:**
- Modify: `src/components/BucketsPage.tsx`
- Modify: `src/components/SidebarLeft.tsx`

**Interfaces:** None (pure string changes).

- [ ] **Step 1: Update `BucketsPage.tsx` user-visible strings**

Change the following strings (leave internal identifiers like `handleNewBucket`, CSS class names, and `addBucket` unchanged):
- Toolbar `<h2>` text: `BUCKETS` → `CANVAS`
- `NEW_BUCKET` button label: `NEW_BUCKET` → `NEW_PANEL`
- `BucketsPageProps` interface name and export: `BucketsPage` → `CanvasPage` (rename the component and its file mention in the import in App.tsx)

Builder's call: file rename (`BucketsPage.tsx` → `CanvasPage.tsx`) is optional. If skipped, only the component export name changes.

- [ ] **Step 2: Update `SidebarLeft.tsx` user-visible strings**

- Button label `BUCKETS` → `CANVAS`
- `title` attribute: `"Buckets (B)"` → `"Canvas (B)"`
- `setStatusHint` call: `'OPEN_BUCKETS'` → `'OPEN_CANVAS'`

- [ ] **Step 3: Update `App.tsx` import if component was renamed**

If `BucketsPage` was renamed to `CanvasPage`, update the import and JSX usage in `App.tsx`.

- [ ] **Step 4: Run existing tests — expect PASS**

`npm test -- BucketsPage`

- [ ] **Step 5: Build — expect clean**

`npm run build`

- [ ] **Step 6: Commit**

```bash
git add src/components/BucketsPage.tsx src/components/SidebarLeft.tsx src/App.tsx
git commit -m "feat: rename Buckets to Canvas in all user-visible text"
```

---

### Task 3: MarkdownView — `[c]` Row Copy Marker

**Files:**
- Modify: `src/components/MarkdownView.tsx`
- Modify: `src/components/MarkdownView.module.scss`
- Modify: `src/components/MarkdownView.test.tsx`

**Interfaces:**
- Consumes: `copyRich(html, plain)` and `copyPlain(text)` from `src/utils/clipboard.ts` (Task 1).
- Produces: No new exports. `MarkdownView` props unchanged.

**Key design decisions:**
- `remarkCopyMarker` is a factory `(source: string) => Plugin` that captures the `rendered` string passed to `ReactMarkdown`. It uses MDAST node positions to extract the raw source of each matching line via `source.slice(node.position.start.offset, node.position.end.offset)`.
- It runs after `remarkGfm`/`remarkBreaks`/`remarkTaskLineIndex`. It walks `paragraph`, `heading`, and `listItem` nodes. For each, it collects all descendant `text` nodes, checks if their combined value contains `[c]`. If yes: strips `[c]` from the text node values, sets `data.hProperties['data-copy-line'] = 'true'` and `data.hProperties['data-copy-source'] = <raw source with [c] stripped>`.
- `[c]` inside `inlineCode` nodes is explicitly skipped (the plugin only inspects `text` nodes, not `inlineCode`).
- The `MARKDOWN_COMPONENTS` const is no longer fully stable — it depends on `rendered` (via the remark plugin factory). The components map itself (`p`, `h1`-`h6`, `li` overrides) remains stable (defined outside); only the `remarkPlugins` array is memoized inside the component.
- `CopyRowButton` is defined outside the component. It receives the raw markdown via a prop (`copySource: string`) and the DOM ref of its sibling content span via a ref. On click: reads `innerHTML`/`innerText` from the sibling, calls `copyRich`. On shift+click: calls `copyPlain(copySource)`. After copy, swaps icon to a checkmark for 1.5 s via local state.

- [ ] **Step 1: Write failing tests**

Add to `src/components/MarkdownView.test.tsx`:

```tsx
it('[c] marker is stripped from rendered output', () => {
  render(<MarkdownView source="hello world [c]" />);
  expect(screen.queryByText(/\[c\]/)).toBeNull();
  expect(screen.getByText(/hello world/)).toBeInTheDocument();
});

it('[c] on a line renders a copy button', () => {
  render(<MarkdownView source="copy this line [c]" />);
  expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
});

it('[c] inside a code span is not treated as a marker', () => {
  render(<MarkdownView source={"use `foo [c]` here"} />);
  // The [c] inside the code span is visible as text, no copy button appears
  expect(screen.getByText(/\[c\]/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /copy/i })).toBeNull();
});

it('shift+click copy button calls clipboard with raw markdown', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText, write: vi.fn() } });
  vi.stubGlobal('ClipboardItem', undefined); // force plain fallback
  render(<MarkdownView source="**bold text** [c]" />);
  const btn = screen.getByRole('button', { name: /copy/i });
  await userEvent.keyboard('{Shift>}');
  await userEvent.click(btn);
  expect(writeText).toHaveBeenCalledWith(expect.stringContaining('**bold text**'));
  expect(writeText).toHaveBeenCalledWith(expect.not.stringContaining('[c]'));
});
```

- [ ] **Step 2: Run tests — expect FAIL**

`npm test -- MarkdownView`

- [ ] **Step 3: Implement `remarkCopyMarker(source: string)` in `MarkdownView.tsx`**

Factory function. Walk `paragraph`, `heading`, `listItem` nodes. Collect their `text`-type children (skip `inlineCode`). If any contain `[c]`: strip all `[c]` occurrences from text node values; set `data.hProperties['data-copy-line'] = 'true'`; set `data.hProperties['data-copy-source']` to `source.slice(node.position.start.offset, node.position.end.offset).replace(/\[c\]/g, '').trim()`.

- [ ] **Step 4: Implement `CopyRowButton` component in `MarkdownView.tsx`**

Props: `copySource: string`. Local state: `copied: boolean`. Renders a `<button>` with a `Copy` icon (or `Check` when `copied`). On click: if `e.shiftKey` → `copyPlain(copySource)`; else → read `innerHTML`/`innerText` from `e.currentTarget.previousElementSibling` and call `copyRich(html, plain)`. After either, set `copied = true`, `setTimeout(() => setCopied(false), 1500)`.

- [ ] **Step 5: Add `CopyParagraph`, `CopyHeading` wrapper components to `MARKDOWN_COMPONENTS`**

For `p`, `h1`–`h6`: check the `data-copy-line` prop. If present, render `<Tag><span ref>{children}</span><CopyRowButton copySource={data-copy-source} /></Tag>` with `className={styles.copyRow}`. If absent, render as normal. Extend existing `TaskListItem` to also check `data-copy-line` and append `CopyRowButton` when set.

- [ ] **Step 6: Update `MarkdownView` component to use memoized plugin list**

Replace the static `REMARK_PLUGINS` usage with:
```ts
const remarkPlugins = useMemo(
  () => [remarkGfm, remarkBreaks, remarkTaskLineIndex, remarkCopyMarker(rendered)],
  [rendered]
);
```

- [ ] **Step 7: Add styles to `MarkdownView.module.scss`**

`.copyRow` — `display: flex; align-items: baseline; gap: 4px;` (button sits inline after the text).  
Copy button — small, muted, only fully visible on `.copyRow:hover`. Builder's call on exact values, consistent with existing button styles.

- [ ] **Step 8: Run tests — expect PASS**

`npm test -- MarkdownView`

- [ ] **Step 9: Commit**

```bash
git add src/components/MarkdownView.tsx src/components/MarkdownView.module.scss src/components/MarkdownView.test.tsx
git commit -m "feat: add [c] row copy marker to MarkdownView"
```

---

### Task 4: MarkdownView — Code Block Copy Button

**Files:**
- Modify: `src/components/MarkdownView.tsx`
- Modify: `src/components/MarkdownView.module.scss`
- Modify: `src/components/MarkdownView.test.tsx`

**Interfaces:**
- Consumes: `copyPlain(text)` from `src/utils/clipboard.ts` (Task 1).
- Produces: No new exports.

- [ ] **Step 1: Write failing tests**

Add to `src/components/MarkdownView.test.tsx`:

```tsx
it('fenced code block renders a copy button', () => {
  render(<MarkdownView source={"```\nnpm run clean\n```"} />);
  expect(screen.getByRole('button', { name: /copy code/i })).toBeInTheDocument();
});

it('clicking code block copy button copies raw code', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  render(<MarkdownView source={"```\nnpm run clean\n```"} />);
  await userEvent.click(screen.getByRole('button', { name: /copy code/i }));
  expect(writeText).toHaveBeenCalledWith('npm run clean\n');
});

it('[c] inside a fenced code block is not treated as a marker', () => {
  render(<MarkdownView source={"```\nsome [c] code\n```"} />);
  expect(screen.getByText(/\[c\]/)).toBeInTheDocument(); // visible in code
  // Only the code copy button; no row copy button
  expect(screen.getAllByRole('button').length).toBe(1);
});
```

- [ ] **Step 2: Run tests — expect FAIL**

`npm test -- MarkdownView`

- [ ] **Step 3: Implement `CodeBlock` component in `MarkdownView.tsx`**

Wraps `<pre>` with `position: relative`. Renders children plus a `<button aria-label="copy code">` absolutely positioned top-right. On click: reads the `<code>` element's `textContent` from `preRef.current` and calls `copyPlain(text)`. Local `copied` state swaps icon to checkmark for 1.5 s. Add `pre: CodeBlock` to `MARKDOWN_COMPONENTS`.

- [ ] **Step 4: Add styles to `MarkdownView.module.scss`**

`.codeBlock` — `position: relative`. Copy button: `position: absolute; top: 6px; right: 6px;`, muted, visible on `.codeBlock:hover`. Consistent with existing code block styles.

- [ ] **Step 5: Run tests — expect PASS**

`npm test -- MarkdownView`

- [ ] **Step 6: Commit**

```bash
git add src/components/MarkdownView.tsx src/components/MarkdownView.module.scss src/components/MarkdownView.test.tsx
git commit -m "feat: add copy button to fenced code blocks in MarkdownView"
```

---

### Task 5: CanvasNoteView — Note Card Quick-Copy

**Files:**
- Modify: `src/components/CanvasNoteView.tsx`
- Modify: `src/components/CanvasNoteView.module.scss`
- Modify: `src/components/CanvasNoteView.test.tsx`

**Interfaces:**
- Consumes: `copyRich(html, plain)` from `src/utils/clipboard.ts` (Task 1).
- Produces: No new exports.

- [ ] **Step 1: Write failing tests**

Add to `src/components/CanvasNoteView.test.tsx`:

```tsx
it('note card in view mode shows a copy button', () => {
  // render a note with content, isEditing=false
  // expect a button with aria-label matching /copy note/i
  expect(screen.getByRole('button', { name: /copy note/i })).toBeInTheDocument();
});

it('copy button is not visible when note is in edit mode', () => {
  // render with isEditing=true
  expect(screen.queryByRole('button', { name: /copy note/i })).toBeNull();
});
```

- [ ] **Step 2: Run tests — expect FAIL**

`npm test -- CanvasNoteView`

- [ ] **Step 3: Add copy button to `CanvasNoteView.tsx`**

In the view-mode branch (the `<>` fragment containing `.controls` and `.body`):
- Add a `bodyRef = useRef<HTMLDivElement>(null)` on the `.body` div.
- Add a `<CopyNoteButton bodyRef={bodyRef} />` component inside `.controls` (next to delete button).
- `CopyNoteButton`: on click, reads `bodyRef.current.innerHTML` and `bodyRef.current.innerText`, calls `copyRich(html, plain)`. Local `copied` state swaps icon for 1.5 s.
- Add `aria-label="copy note"` to the button.
- Button should be a `<button>` (same pattern as delete button), using `Copy` icon from lucide-react.

- [ ] **Step 4: Add styles to `CanvasNoteView.module.scss`**

Copy button styled consistently with `.deleteBtn`. Position it between the color input and delete button in `.controls`.

- [ ] **Step 5: Run tests — expect PASS**

`npm test -- CanvasNoteView`

- [ ] **Step 6: Run full test suite**

`npm test`

All tests pass.

- [ ] **Step 7: Build**

`npm run build`

Clean build with no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/CanvasNoteView.tsx src/components/CanvasNoteView.module.scss src/components/CanvasNoteView.test.tsx
git commit -m "feat: add quick-copy button to canvas note cards"
```
