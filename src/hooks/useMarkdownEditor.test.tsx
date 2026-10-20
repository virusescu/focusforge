import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useMarkdownEditor, type MarkdownEditor } from './useMarkdownEditor';
import { MarkdownToolbar, TABLE_TEMPLATE } from '../components/MarkdownToolbar';

vi.mock('../utils/audio', () => ({ soundEngine: { playClick: vi.fn() } }));

function Harness({ initialText = '', onSave = vi.fn(), onCancel = vi.fn() }: { initialText?: string; onSave?: (t: string) => void; onCancel?: () => void }) {
  // Annotated: the initializer refers to `editor` (TS7022 otherwise)
  const editor: MarkdownEditor = useMarkdownEditor({ initialText, onSave: () => { onSave(editor.text); }, onCancel });
  const { textareaRef } = editor;
  return (
    <>
      <textarea
        data-testid="ta"
        ref={textareaRef}
        value={editor.text}
        onChange={e => editor.setText(e.target.value)}
        onKeyDown={editor.handleKeyDown}
        onPaste={editor.handlePaste}
      />
      <MarkdownToolbar editor={editor} />
    </>
  );
}

const ta = () => screen.getByTestId('ta') as HTMLTextAreaElement;
const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));
const codeBlockButton = () => screen.getByTitle('Code block');

describe('code block button', () => {
  it('inserts an empty fenced block and leaves the cursor on the empty line inside it', async () => {
    render(<Harness />);
    fireEvent.click(codeBlockButton());
    await flush();
    expect(ta().value).toBe('```\n\n```');
    expect(ta().selectionStart).toBe(4);
    expect(ta().selectionEnd).toBe(4);
  });

  it('wraps the selected text in a fenced block and keeps it selected', async () => {
    render(<Harness initialText="npm run build" />);
    ta().setSelectionRange(0, 13);
    fireEvent.click(codeBlockButton());
    await flush();
    expect(ta().value).toBe('```\nnpm run build\n```');
    expect([ta().selectionStart, ta().selectionEnd]).toEqual([4, 17]);
  });

  it('starts the fence on its own line when the cursor is at the end of a line of text', async () => {
    render(<Harness initialText="intro text" />);
    ta().setSelectionRange(10, 10);
    fireEvent.click(codeBlockButton());
    await flush();
    expect(ta().value).toBe('intro text\n```\n\n```');
    expect(ta().selectionStart).toBe(15);
  });

  it('puts text that follows a mid-line selection on its own line after the block', async () => {
    render(<Harness initialText="a b c" />);
    ta().setSelectionRange(2, 3);
    fireEvent.click(codeBlockButton());
    await flush();
    expect(ta().value).toBe('a \n```\nb\n```\n c');
  });

  it('adds no extra blank lines when the selection is already whole lines', async () => {
    render(<Harness initialText={'one\ntwo\nthree'} />);
    ta().setSelectionRange(4, 7);
    fireEvent.click(codeBlockButton());
    await flush();
    expect(ta().value).toBe('one\n```\ntwo\n```\nthree');
  });

  it('preserves multi-line selections as they are', async () => {
    render(<Harness initialText={'$ cd app\n$ npm test'} />);
    ta().setSelectionRange(0, 19);
    fireEvent.click(codeBlockButton());
    await flush();
    expect(ta().value).toBe('```\n$ cd app\n$ npm test\n```');
  });
});

describe('useMarkdownEditor', () => {
  it('starts with initialText', () => {
    render(<Harness initialText="hello" />);
    expect(ta().value).toBe('hello');
  });

  it('Escape saves with the current text', () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    fireEvent.change(ta(), { target: { value: 'typed' } });
    fireEvent.keyDown(ta(), { key: 'Escape' });
    expect(onSave).toHaveBeenCalledWith('typed');
  });

  it('Shift+Escape cancels', () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(<Harness onSave={onSave} onCancel={onCancel} />);
    fireEvent.keyDown(ta(), { key: 'Escape', shiftKey: true });
    expect(onCancel).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('Ctrl+B wraps the selection, and again unwraps it', () => {
    render(<Harness initialText="hello" />);
    ta().setSelectionRange(0, 5);
    fireEvent.keyDown(ta(), { key: 'b', ctrlKey: true });
    expect(ta().value).toBe('**hello**');
    ta().setSelectionRange(2, 7);
    fireEvent.keyDown(ta(), { key: 'b', ctrlKey: true });
    expect(ta().value).toBe('hello');
  });

  it('the Table button inserts the table template on a new line', () => {
    render(<Harness initialText="intro" />);
    ta().setSelectionRange(5, 5);
    fireEvent.click(screen.getByTitle('Table'));
    expect(ta().value).toBe('intro\n' + TABLE_TEMPLATE);
  });

  it('pasting a URL over a selection makes a link', () => {
    render(<Harness initialText="docs" />);
    ta().setSelectionRange(0, 4);
    fireEvent.paste(ta(), { clipboardData: { getData: () => 'https://example.com' } });
    expect(ta().value).toBe('[docs](https://example.com)');
  });
});
