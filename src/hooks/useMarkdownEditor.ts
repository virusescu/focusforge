import { useState, useRef, useCallback } from 'react';
import { soundEngine } from '../utils/audio';

export interface MarkdownEditorOptions {
  initialText?: string;
  onSave: () => void;   // Esc
  onCancel: () => void; // Shift+Esc
}

// Text state and editing helpers for a markdown textarea: toolbar actions, Ctrl shortcuts,
// line duplicate/move, Esc to save / Shift+Esc to cancel, and auto-link on paste.
export function useMarkdownEditor({ initialText = '', onSave, onCancel }: MarkdownEditorOptions) {
  const [text, setText] = useState(initialText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const wrapSelection = useCallback((before: string, after: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    soundEngine.playClick();
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = text.slice(start, end);

    const markerBefore = text.slice(start - before.length, start);
    const markerAfter = text.slice(end, end + after.length);
    if (selected && markerBefore === before && markerAfter === after) {
      const newText = text.slice(0, start - before.length) + selected + text.slice(end + after.length);
      setText(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start - before.length, start - before.length + selected.length);
      }, 0);
      return;
    }

    const inner = selected || 'text';
    const newText = text.slice(0, start) + before + inner + after + text.slice(end);
    setText(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + inner.length);
    }, 0);
  }, [text]);

  const insertLink = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    soundEngine.playClick();
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = text.slice(start, end);
    const linkText = selected || 'link text';
    const insertion = `[${linkText}](url)`;
    setText(text.slice(0, start) + insertion + text.slice(end));
    const urlStart = start + linkText.length + 3;
    const urlEnd = urlStart + 3;
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(urlStart, urlEnd);
    }, 0);
  }, [text]);

  const insertTemplate = useCallback((template: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    soundEngine.playClick();
    const pos = textarea.selectionStart;
    // If cursor is not at the start of a line, prepend a newline
    const charBefore = pos > 0 ? text[pos - 1] : '\n';
    const prefix = charBefore !== '\n' ? '\n' : '';
    const insertion = prefix + template;
    setText(text.slice(0, pos) + insertion + text.slice(pos));
    const newCursor = pos + insertion.length;
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursor, newCursor);
    }, 0);
  }, [text]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (e.shiftKey) {
        onCancel();
      } else {
        onSave();
      }
      return;
    }
    if (!e.ctrlKey) return;
    if (e.key === 'b' || e.key === 'B') { e.preventDefault(); wrapSelection('**', '**'); return; }
    if (e.key === 'i' || e.key === 'I') { e.preventDefault(); wrapSelection('_', '_'); return; }
    if (e.key === 's' || e.key === 'S') { e.preventDefault(); wrapSelection('~~', '~~'); return; }
    if (e.key === '1') { e.preventDefault(); insertTemplate('# '); return; }
    if (e.key === '2') { e.preventDefault(); insertTemplate('## '); return; }
    if (e.key === '3') { e.preventDefault(); insertTemplate('### '); return; }
    if (e.key === 'l' || e.key === 'L') { e.preventDefault(); insertTemplate('- '); return; }
    if (e.key === 't' || e.key === 'T') { e.preventDefault(); insertTemplate('- [ ] '); return; }
    if (e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      soundEngine.playClick();
      const textarea = e.currentTarget;
      const pos = textarea.selectionStart;
      const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
      const lineEndIdx = text.indexOf('\n', pos);
      const lineEnd = lineEndIdx === -1 ? text.length : lineEndIdx;
      const currentLine = text.slice(lineStart, lineEnd);
      setText(text.slice(0, lineEnd) + '\n' + currentLine + text.slice(lineEnd));
      const newPos = lineEnd + 1 + (pos - lineStart);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newPos, newPos);
      }, 0);
      return;
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const textarea = e.currentTarget;
      const pos = textarea.selectionStart;
      const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
      const lineEndIdx = text.indexOf('\n', pos);
      const lineEnd = lineEndIdx === -1 ? text.length : lineEndIdx;
      const currentLine = text.slice(lineStart, lineEnd);
      const offsetInLine = pos - lineStart;

      if (e.key === 'ArrowUp' && lineStart > 0) {
        e.preventDefault();
        soundEngine.playClick();
        const prevLineEnd = lineStart - 1;
        const prevLineStart = text.lastIndexOf('\n', prevLineEnd - 1) + 1;
        const prevLine = text.slice(prevLineStart, prevLineEnd);
        setText(text.slice(0, prevLineStart) + currentLine + '\n' + prevLine + text.slice(lineEnd));
        const newPos = prevLineStart + Math.min(offsetInLine, currentLine.length);
        setTimeout(() => { textarea.focus(); textarea.setSelectionRange(newPos, newPos); }, 0);
      } else if (e.key === 'ArrowDown' && lineEndIdx !== -1) {
        e.preventDefault();
        soundEngine.playClick();
        const nextLineStart = lineEnd + 1;
        const nextLineEndIdx = text.indexOf('\n', nextLineStart);
        const nextLineEnd = nextLineEndIdx === -1 ? text.length : nextLineEndIdx;
        const nextLine = text.slice(nextLineStart, nextLineEnd);
        setText(text.slice(0, lineStart) + nextLine + '\n' + currentLine + text.slice(nextLineEnd));
        const newPos = lineStart + nextLine.length + 1 + Math.min(offsetInLine, currentLine.length);
        setTimeout(() => { textarea.focus(); textarea.setSelectionRange(newPos, newPos); }, 0);
      }
    }
  };

  // Pasting a URL over a selection turns the selection into a link
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData('text/plain').trim();
    if (!/^https?:\/\/\S+$/.test(pasted)) return;
    const textarea = e.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start === end) return;
    e.preventDefault();
    const replacement = `[${text.slice(start, end)}](${pasted})`;
    setText(text.slice(0, start) + replacement + text.slice(end));
    const newEnd = start + replacement.length;
    setTimeout(() => { textarea.focus(); textarea.setSelectionRange(newEnd, newEnd); }, 0);
  }, [text]);

  return { text, setText, textareaRef, wrapSelection, insertTemplate, insertLink, handleKeyDown, handlePaste };
}

export type MarkdownEditor = ReturnType<typeof useMarkdownEditor>;
