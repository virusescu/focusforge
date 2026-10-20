import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SaveTemplateModal } from './SaveTemplateModal';
import type { StrategicObjective } from '../types';

const mockAddTemplate = vi.fn();
vi.mock('../contexts/FocusContext', () => ({
  useFocus: () => ({
    categories: [{ id: 4, label: 'Hard', color: '#ff4444', sort_order: 0, coin_bounty: 50 }],
    addTemplate: mockAddTemplate,
  }),
}));
vi.mock('../utils/audio', () => ({ soundEngine: { playClick: vi.fn() } }));

const TASK: StrategicObjective = {
  id: 7,
  text: '$title',
  created_at: '2026-10-20',
  is_mission: 1,
  category_id: 4,
  details: 'Issue $issueId\n[Link](http://x/$issueId)',
};

const renderModal = (task: StrategicObjective = TASK) => {
  const onClose = vi.fn();
  render(<SaveTemplateModal task={task} onClose={onClose} />);
  return { onClose };
};

describe('SaveTemplateModal', () => {
  beforeEach(() => mockAddTemplate.mockReset().mockResolvedValue(undefined));

  it('prefills the name with the task title and lists the fields it found', () => {
    renderModal();
    expect(screen.getByLabelText('NAME')).toHaveValue('$title');
    expect(screen.getByText('$title')).toBeInTheDocument();
    expect(screen.getByText('$issueId')).toBeInTheDocument();
    expect(screen.getAllByText('$issueId')).toHaveLength(1);
  });

  it('says so when the task has no fields', () => {
    renderModal({ ...TASK, text: 'Plain task', details: null });
    expect(screen.getByText(/no fields/i)).toBeInTheDocument();
  });

  it('defaults the color to the task category color, or the accent without a category', () => {
    renderModal();
    expect(screen.getByLabelText('COLOR')).toHaveValue('#ff4444');
  });

  it('uses the accent color when the task has no category', () => {
    renderModal({ ...TASK, category_id: null });
    expect(screen.getByLabelText('COLOR')).toHaveValue('#ee682b');
  });

  it('saves the task title, details and category under the chosen name and color', async () => {
    const { onClose } = renderModal();
    fireEvent.change(screen.getByLabelText('NAME'), { target: { value: 'Bug' } });
    fireEvent.change(screen.getByLabelText('COLOR'), { target: { value: '#00ff88' } });
    fireEvent.click(screen.getByRole('button', { name: 'SAVE_TEMPLATE' }));
    expect(mockAddTemplate).toHaveBeenCalledWith({
      name: 'Bug',
      title: '$title',
      details: 'Issue $issueId\n[Link](http://x/$issueId)',
      color: '#00ff88',
      category_id: 4,
    });
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it('stays open with the button grayed out until the save finishes, then closes', async () => {
    let finish!: () => void;
    mockAddTemplate.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'SAVE_TEMPLATE' }));
    expect(screen.getByRole('button', { name: 'SAVING...' })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
    finish();
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it('keeps the dialog and the typed name when the save fails, and lets the user retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockAddTemplate.mockRejectedValueOnce(new Error('offline'));
    const { onClose } = renderModal();
    fireEvent.change(screen.getByLabelText('NAME'), { target: { value: 'Bug' } });
    fireEvent.click(screen.getByRole('button', { name: 'SAVE_TEMPLATE' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not save/i);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText('NAME')).toHaveValue('Bug');

    fireEvent.click(screen.getByRole('button', { name: 'SAVE_TEMPLATE' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(mockAddTemplate).toHaveBeenCalledTimes(2);
  });

  it('does not save twice on a double click', async () => {
    renderModal();
    const save = screen.getByRole('button', { name: 'SAVE_TEMPLATE' });
    fireEvent.click(save);
    fireEvent.click(save);
    await waitFor(() => expect(mockAddTemplate).toHaveBeenCalledTimes(1));
  });

  it('a task without details saves an empty details string', async () => {
    renderModal({ ...TASK, details: null, category_id: null });
    fireEvent.click(screen.getByRole('button', { name: 'SAVE_TEMPLATE' }));
    await waitFor(() => expect(mockAddTemplate).toHaveBeenCalledWith(expect.objectContaining({ details: '', category_id: null })));
  });

  it('cannot save with an empty name', () => {
    renderModal();
    fireEvent.change(screen.getByLabelText('NAME'), { target: { value: '   ' } });
    const save = screen.getByRole('button', { name: 'SAVE_TEMPLATE' });
    expect(save).toBeDisabled();
    fireEvent.click(save);
    expect(mockAddTemplate).not.toHaveBeenCalled();
  });

  it('Enter in the name box saves', () => {
    renderModal();
    fireEvent.keyDown(screen.getByLabelText('NAME'), { key: 'Enter' });
    expect(mockAddTemplate).toHaveBeenCalledOnce();
  });

  it('Escape closes without saving', () => {
    const { onClose } = renderModal();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
    expect(mockAddTemplate).not.toHaveBeenCalled();
  });
});
