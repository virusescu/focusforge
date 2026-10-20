import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { TemplateManagerModal } from './TemplateManagerModal';
import type { Template } from '../types';

const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockReorder = vi.fn();
let mockTemplates: Template[];

vi.mock('../contexts/FocusContext', () => ({
  useFocus: () => ({
    templates: mockTemplates,
    categories: [
      { id: 4, label: 'Hard', color: '#f44', sort_order: 0, coin_bounty: 50 },
      { id: 5, label: 'Easy', color: '#888', sort_order: 1, coin_bounty: 10 },
    ],
    updateTemplate: mockUpdate,
    deleteTemplate: mockDelete,
    reorderTemplates: mockReorder,
  }),
}));
vi.mock('../utils/audio', () => ({ soundEngine: { playClick: vi.fn(), playHover: vi.fn(), playReorder: vi.fn() } }));

const BUG: Template = { id: 1, name: 'Bug', title: '$title', details: 'Issue $issueId', color: '#ff4444', category_id: 4, sort_order: 0 };
const REVIEW: Template = { id: 2, name: 'Review', title: 'Review $pr', details: '', color: '#3388ff', category_id: null, sort_order: 1 };

const row = (name: string) => screen.getByDisplayValue(name).closest('[data-template-id]') as HTMLElement;

describe('TemplateManagerModal', () => {
  beforeEach(() => {
    mockTemplates = [BUG, REVIEW];
    mockUpdate.mockReset().mockResolvedValue(undefined);
    mockDelete.mockReset().mockResolvedValue(undefined);
    mockReorder.mockReset().mockResolvedValue(undefined);
  });

  it('lists the templates in order, each with a drag handle', () => {
    render(<TemplateManagerModal onClose={vi.fn()} />);
    const names = screen.getAllByLabelText('NAME').map(i => (i as HTMLInputElement).value);
    expect(names).toEqual(['Bug', 'Review']);
    expect(screen.getByRole('button', { name: 'Reorder Bug' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reorder Review' })).toBeInTheDocument();
  });

  it('shows each template\'s fields', () => {
    render(<TemplateManagerModal onClose={vi.fn()} />);
    expect(within(row('Bug')).getByText('$title')).toBeInTheDocument();
    expect(within(row('Bug')).getByText('$issueId')).toBeInTheDocument();
    expect(within(row('Review')).getByText('$pr')).toBeInTheDocument();
  });

  it('updates the fields live while typing, before anything is saved', () => {
    render(<TemplateManagerModal onClose={vi.fn()} />);
    fireEvent.change(within(row('Review')).getByLabelText('TITLE'), { target: { value: 'Review $pr by $author' } });
    expect(within(row('Review')).getByText('$author')).toBeInTheDocument();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('saves a renamed template on blur, keeping its other values', () => {
    render(<TemplateManagerModal onClose={vi.fn()} />);
    const name = within(row('Bug')).getByLabelText('NAME');
    fireEvent.change(name, { target: { value: 'Defect' } });
    fireEvent.blur(name);
    expect(mockUpdate).toHaveBeenCalledWith(1, { name: 'Defect', title: '$title', details: 'Issue $issueId', color: '#ff4444', category_id: 4 });
  });

  it('does not save when nothing changed on blur', () => {
    render(<TemplateManagerModal onClose={vi.fn()} />);
    fireEvent.blur(within(row('Bug')).getByLabelText('NAME'));
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('puts the old name back instead of saving an empty one', () => {
    render(<TemplateManagerModal onClose={vi.fn()} />);
    const name = within(row('Bug')).getByLabelText('NAME');
    fireEvent.change(name, { target: { value: '  ' } });
    fireEvent.blur(name);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(name).toHaveValue('Bug');
  });

  it('allows two templates to share a name', () => {
    render(<TemplateManagerModal onClose={vi.fn()} />);
    const name = within(row('Review')).getByLabelText('NAME');
    fireEvent.change(name, { target: { value: 'Bug' } });
    fireEvent.blur(name);
    expect(mockUpdate).toHaveBeenCalledWith(2, expect.objectContaining({ name: 'Bug' }));
  });

  it('saves title and details edits on blur', () => {
    render(<TemplateManagerModal onClose={vi.fn()} />);
    const details = within(row('Bug')).getByLabelText('DETAILS');
    fireEvent.change(details, { target: { value: 'Line one\nLine two $x' } });
    fireEvent.blur(details);
    expect(mockUpdate).toHaveBeenCalledWith(1, expect.objectContaining({ details: 'Line one\nLine two $x' }));
  });

  it('saves a color change immediately', () => {
    render(<TemplateManagerModal onClose={vi.fn()} />);
    fireEvent.change(within(row('Bug')).getByLabelText('COLOR'), { target: { value: '#00ff88' } });
    expect(mockUpdate).toHaveBeenCalledWith(1, expect.objectContaining({ color: '#00ff88' }));
  });

  it('saves a category change immediately, including back to none', () => {
    render(<TemplateManagerModal onClose={vi.fn()} />);
    const select = within(row('Bug')).getByLabelText('CATEGORY');
    fireEvent.change(select, { target: { value: '5' } });
    expect(mockUpdate).toHaveBeenLastCalledWith(1, expect.objectContaining({ category_id: 5 }));
    fireEvent.change(select, { target: { value: '' } });
    expect(mockUpdate).toHaveBeenLastCalledWith(1, expect.objectContaining({ category_id: null }));
  });

  it('asks before deleting', () => {
    render(<TemplateManagerModal onClose={vi.fn()} />);
    fireEvent.click(within(row('Bug')).getByTitle('Delete template'));
    expect(mockDelete).not.toHaveBeenCalled();
    fireEvent.click(within(row('Bug')).getByText('NO'));
    expect(mockDelete).not.toHaveBeenCalled();
    fireEvent.click(within(row('Bug')).getByTitle('Delete template'));
    fireEvent.click(within(row('Bug')).getByText('YES'));
    expect(mockDelete).toHaveBeenCalledWith(1);
  });

  it('explains how to make a template when there are none', () => {
    mockTemplates = [];
    render(<TemplateManagerModal onClose={vi.fn()} />);
    expect(screen.getByText(/Create template from task/)).toBeInTheDocument();
  });

  it('Escape closes it', () => {
    const onClose = vi.fn();
    render(<TemplateManagerModal onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
