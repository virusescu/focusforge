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
