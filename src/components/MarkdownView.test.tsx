import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MarkdownView } from './MarkdownView';

vi.mock('@tauri-apps/plugin-shell', () => ({ open: vi.fn() }));
vi.mock('../utils/audio', () => ({
  soundEngine: { playCheckboxUncheck: vi.fn() },
  playCheckboxCheckWithFile: vi.fn(),
}));
vi.mock('../utils/clipboard', () => ({
  copyRich: vi.fn().mockResolvedValue(undefined),
  copyPlain: vi.fn().mockResolvedValue(undefined),
}));

const TABLE = '| Name | Qty |\n| :--- | ---: |\n| Apple | 3 |\n| Pear | 10 |';

import { copyRich, copyPlain } from '../utils/clipboard';

describe('MarkdownView', () => {
  it('renders a GFM table with header and body cells', () => {
    const { container } = render(<MarkdownView source={TABLE} />);
    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Pear' })).toBeInTheDocument();
    // Wrapped so wide tables scroll horizontally instead of overflowing
    expect(table!.parentElement!.tagName).toBe('DIV');
    expect(table!.parentElement).not.toBe(container.firstChild);
  });

  it('applies column alignment', () => {
    render(<MarkdownView source={TABLE} />);
    expect(screen.getByRole('cell', { name: '10' }).style.textAlign).toBe('right');
  });

  it('toggling a task after extra blank lines changes the right source line', () => {
    const onChange = vi.fn();
    render(<MarkdownView source={'a\n\n\n- [ ] task'} onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith('a\n\n\n- [x] task');
  });

  it('is read-only without onChange', () => {
    render(<MarkdownView source={'- [ ] task'} />);
    expect(() => fireEvent.click(screen.getByRole('checkbox'))).not.toThrow();
  });
});

describe('[c] row copy marker', () => {
  beforeEach(() => {
    vi.mocked(copyRich).mockClear();
    vi.mocked(copyPlain).mockClear();
  });

  it('[c] marker is stripped from rendered output', () => {
    render(<MarkdownView source="hello world [c]" />);
    expect(screen.queryByText(/\[c\]/)).toBeNull();
    expect(screen.getByText(/hello world/)).toBeInTheDocument();
  });

  it('[c] on a line renders a copy button', () => {
    render(<MarkdownView source="copy this line [c]" />);
    expect(screen.getByRole('button', { name: /copy row/i })).toBeInTheDocument();
  });

  it('[c] inside a code span is not treated as a marker', () => {
    render(<MarkdownView source={'use `foo [c]` here'} />);
    expect(screen.getByText(/\[c\]/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /copy row/i })).toBeNull();
  });

  it('multiple [c] tokens on a line render only one copy button', () => {
    render(<MarkdownView source="text [c] more [c]" />);
    const buttons = screen.getAllByRole('button', { name: /copy row/i });
    expect(buttons).toHaveLength(1);
    expect(screen.queryByText(/\[c\]/)).toBeNull();
  });

  it('clicking copy button calls copyRich with html and plain', () => {
    render(<MarkdownView source="**bold text** [c]" />);
    fireEvent.click(screen.getByRole('button', { name: /copy row/i }));
    expect(copyRich).toHaveBeenCalledOnce();
  });

  it('shift+click copy button calls copyPlain with raw markdown (no [c])', () => {
    render(<MarkdownView source="**bold text** [c]" />);
    const btn = screen.getByRole('button', { name: /copy row/i });
    fireEvent.click(btn, { shiftKey: true });
    expect(copyPlain).toHaveBeenCalledOnce();
    const arg = vi.mocked(copyPlain).mock.calls[0][0] as string;
    expect(arg).toContain('**bold text**');
    expect(arg).not.toContain('[c]');
  });
});

describe('code block copy button', () => {
  beforeEach(() => {
    vi.mocked(copyPlain).mockClear();
    vi.mocked(copyRich).mockClear();
  });

  it('fenced code block renders a copy button', () => {
    render(<MarkdownView source={"```\nnpm run clean\n```"} />);
    expect(screen.getByRole('button', { name: /copy code/i })).toBeInTheDocument();
  });

  it('clicking code block copy button copies raw code via copyPlain', () => {
    render(<MarkdownView source={"```\nnpm run clean\n```"} />);
    fireEvent.click(screen.getByRole('button', { name: /copy code/i }));
    expect(copyPlain).toHaveBeenCalledOnce();
    expect(vi.mocked(copyPlain).mock.calls[0][0]).toContain('npm run clean');
  });

  it('[c] inside a fenced code block is not treated as a row marker', () => {
    render(<MarkdownView source={"```\nsome [c] code\n```"} />);
    // The [c] is visible inside the code block
    expect(screen.getByText(/\[c\]/)).toBeInTheDocument();
    // Only one button: the code copy button, no row copy button
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAccessibleName(/copy code/i);
  });
});
