import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CategoryManagerModal } from './CategoryManagerModal';
import type { ObjectiveCategory } from '../types';

vi.mock('../utils/audio', () => ({
  soundEngine: { playClick: vi.fn(), playHover: vi.fn(), playReorder: vi.fn() },
}));

const cat = (id: number, label: string, sort_order: number): ObjectiveCategory => ({ id, label, color: '#ff0000', sort_order, coin_bounty: 25 });
const CATEGORIES = [cat(1, 'Hard', 0), cat(2, 'Normal', 1), cat(3, 'Easy', 2)];

const renderModal = (categories = CATEGORIES, counts = new Map<number, number>()) => {
  const props = {
    categories,
    onAdd: vi.fn().mockResolvedValue(undefined),
    onUpdate: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    onReorder: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
    objectiveCountByCategory: counts,
  };
  render(<CategoryManagerModal {...props} />);
  return props;
};

describe('CategoryManagerModal', () => {
  it('lists the categories in the order given, each with a drag handle', () => {
    renderModal();
    const labels = screen.getAllByDisplayValue(/Hard|Normal|Easy/).map(i => (i as HTMLInputElement).value);
    expect(labels).toEqual(['Hard', 'Normal', 'Easy']);
    expect(screen.getByRole('button', { name: 'Reorder Hard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reorder Easy' })).toBeInTheDocument();
  });

  it('renders a new order when the categories are reordered', () => {
    const { rerender } = (() => {
      const view = render(<CategoryManagerModal {...{
        categories: CATEGORIES, onAdd: vi.fn(), onUpdate: vi.fn(), onDelete: vi.fn(), onReorder: vi.fn(),
        onClose: vi.fn(), objectiveCountByCategory: new Map(),
      }} />);
      return view;
    })();
    rerender(<CategoryManagerModal {...{
      categories: [CATEGORIES[2], CATEGORIES[0], CATEGORIES[1]], onAdd: vi.fn(), onUpdate: vi.fn(), onDelete: vi.fn(), onReorder: vi.fn(),
      onClose: vi.fn(), objectiveCountByCategory: new Map(),
    }} />);
    const labels = screen.getAllByDisplayValue(/Hard|Normal|Easy/).map(i => (i as HTMLInputElement).value);
    expect(labels).toEqual(['Easy', 'Hard', 'Normal']);
  });

  it('editing a label does not start a drag or reorder', () => {
    const props = renderModal();
    const input = screen.getByDisplayValue('Normal');
    fireEvent.change(input, { target: { value: 'Medium' } });
    fireEvent.blur(input);
    expect(props.onUpdate).toHaveBeenCalledWith(2, 'Medium', '#ff0000', 25);
    expect(props.onReorder).not.toHaveBeenCalled();
  });

  it('deleting a category in use asks for confirmation first', () => {
    const props = renderModal(CATEGORIES, new Map([[1, 4]]));
    fireEvent.click(screen.getAllByTitle('Delete Category')[0]);
    expect(props.onDelete).not.toHaveBeenCalled();
    expect(screen.getByText('4 objective(s) use this tag. Delete?')).toBeInTheDocument();
    fireEvent.click(screen.getByText('YES'));
    expect(props.onDelete).toHaveBeenCalledWith(1);
  });

  it('adds a new category', () => {
    const props = renderModal();
    fireEvent.click(screen.getByText('ADD_CATEGORY'));
    expect(props.onAdd).toHaveBeenCalledWith('New Tag', '#666666');
  });
});
