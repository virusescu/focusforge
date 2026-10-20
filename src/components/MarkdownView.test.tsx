import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MarkdownView } from './MarkdownView';

vi.mock('@tauri-apps/plugin-shell', () => ({ open: vi.fn() }));
vi.mock('../utils/audio', () => ({
  soundEngine: { playCheckboxUncheck: vi.fn() },
  playCheckboxCheckWithFile: vi.fn(),
}));

const TABLE = '| Name | Qty |\n| :--- | ---: |\n| Apple | 3 |\n| Pear | 10 |';

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
