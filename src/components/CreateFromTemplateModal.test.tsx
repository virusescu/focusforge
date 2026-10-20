import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CreateFromTemplateModal } from './CreateFromTemplateModal';
import type { Bucket, Template } from '../types';

const mockAddObjective = vi.fn();
let mockBuckets: Bucket[];

const bucket = (id: number, name: string, kind: Bucket['kind']): Bucket => ({ id, name, color: '#fff', sort_order: id, kind, x: 0, y: 0, w: 1, h: 1 });
const CATEGORIES = [
  { id: 4, label: 'Hard', color: '#f44', sort_order: 0, coin_bounty: 50 },
  { id: 5, label: 'Easy', color: '#888', sort_order: 1, coin_bounty: 10 },
];

vi.mock('../contexts/FocusContext', () => ({
  useFocus: () => ({ buckets: mockBuckets, categories: CATEGORIES, addObjective: mockAddObjective }),
}));
vi.mock('../utils/audio', () => ({ soundEngine: { playClick: vi.fn() } }));

const BUG: Template = {
  id: 1,
  name: 'Bug',
  title: '$title',
  details: 'Bugfixing for issue id: $issueId.\nLink: [Jaas Link](http://ea.jaas.com/browse/$issueId)',
  color: '#ff4444',
  category_id: null,
  sort_order: 0,
};

const renderModal = (template: Template = BUG, props: { defaultBucketId?: number; defaultInMission?: boolean } = {}) => {
  const onClose = vi.fn();
  render(<CreateFromTemplateModal template={template} defaultInMission={props.defaultInMission ?? true} defaultBucketId={props.defaultBucketId} onClose={onClose} />);
  return { onClose };
};

const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const create = () => fireEvent.click(screen.getByRole('button', { name: 'CREATE_TASK' }));

describe('CreateFromTemplateModal', () => {
  beforeEach(() => {
    localStorage.clear();
    mockAddObjective.mockReset().mockResolvedValue(undefined);
    mockBuckets = [bucket(1, 'Mission', 'mission'), bucket(2, 'Unsorted', 'unsorted'), bucket(9, 'Work', 'custom')];
  });

  it('is headed by the template name and has one input per field, in order', () => {
    renderModal();
    expect(screen.getByRole('dialog', { name: 'Bug' })).toBeInTheDocument();
    const labels = screen.getAllByRole('textbox').map(i => i.getAttribute('aria-label'));
    expect(labels).toEqual(['title', 'issueId']);
  });

  it('focuses the first field', () => {
    renderModal();
    expect(screen.getByLabelText('title')).toHaveFocus();
  });

  it('creates the task with the fields filled into the title and details', () => {
    const { onClose } = renderModal();
    fill('title', 'Crash on login');
    fill('issueId', 'ABC-7');
    create();
    expect(mockAddObjective).toHaveBeenCalledWith('Crash on login', null, false, {
      bucketId: 2,
      inMission: true,
      details: 'Bugfixing for issue id: ABC-7.\nLink: [Jaas Link](http://ea.jaas.com/browse/ABC-7)',
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('cannot create while the resulting title is empty', () => {
    renderModal();
    expect(screen.getByRole('button', { name: 'CREATE_TASK' })).toBeDisabled();
    fill('title', '   ');
    expect(screen.getByRole('button', { name: 'CREATE_TASK' })).toBeDisabled();
    create();
    expect(mockAddObjective).not.toHaveBeenCalled();
  });

  it('lets empty values through when the title still has text', () => {
    renderModal({ ...BUG, title: 'Bug $issueId' });
    create();
    expect(mockAddObjective).toHaveBeenCalledWith('Bug', null, false, expect.objectContaining({ details: 'Bugfixing for issue id: .\nLink: [Jaas Link](http://ea.jaas.com/browse/)' }));
  });

  it('still opens for a template without fields and creates it', () => {
    renderModal({ ...BUG, title: 'Weekly review', details: '' });
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    create();
    expect(mockAddObjective).toHaveBeenCalledWith('Weekly review', null, false, { bucketId: 2, inMission: true, details: null });
  });

  it('Enter creates a template without fields even though no input has focus', () => {
    renderModal({ ...BUG, title: 'Weekly review', details: '' });
    fireEvent.keyDown(document.activeElement as Element, { key: 'Enter' });
    expect(mockAddObjective).toHaveBeenCalledWith('Weekly review', null, false, { bucketId: 2, inMission: true, details: null });
  });

  it('prints $$ as one $ and never asks for an escaped name', () => {
    renderModal({ ...BUG, title: 'Cost $$5 of $$item for $who', details: '' });
    expect(screen.getAllByRole('textbox').map(i => i.getAttribute('aria-label'))).toEqual(['who']);
    fill('who', 'me');
    create();
    expect(mockAddObjective).toHaveBeenCalledWith('Cost $5 of $item for me', null, false, expect.anything());
  });

  it('inserts a value that looks like a placeholder verbatim', () => {
    renderModal({ ...BUG, title: '$a $b', details: '' });
    fill('a', '$b');
    fill('b', 'two');
    create();
    expect(mockAddObjective).toHaveBeenCalledWith('$b two', null, false, expect.anything());
  });

  describe('bucket picker', () => {
    it('lists task-holding buckets only, not the Mission pseudo-bucket', () => {
      renderModal();
      const options = Array.from((screen.getByLabelText('BUCKET') as HTMLSelectElement).options).map(o => o.text);
      expect(options).toEqual(['Unsorted', 'Work']);
    });

    it('defaults to the bucket of the panel it was opened from', () => {
      renderModal(BUG, { defaultBucketId: 9, defaultInMission: false });
      expect(screen.getByLabelText('BUCKET')).toHaveValue('9');
    });

    it('otherwise defaults to the last bucket used', () => {
      localStorage.setItem('last_bucket_id', '9');
      renderModal();
      expect(screen.getByLabelText('BUCKET')).toHaveValue('9');
    });

    it('falls back to Unsorted when the remembered bucket was deleted', () => {
      localStorage.setItem('last_bucket_id', '77');
      renderModal();
      expect(screen.getByLabelText('BUCKET')).toHaveValue('2');
    });

    it('creates in the chosen bucket', () => {
      renderModal();
      fill('title', 'x');
      fireEvent.change(screen.getByLabelText('BUCKET'), { target: { value: '9' } });
      create();
      expect(mockAddObjective).toHaveBeenCalledWith('x', null, false, expect.objectContaining({ bucketId: 9 }));
    });
  });

  describe('category picker', () => {
    it('offers no category plus every category', () => {
      renderModal();
      const options = Array.from((screen.getByLabelText('CATEGORY') as HTMLSelectElement).options).map(o => o.text);
      expect(options).toEqual(['No category', 'Hard', 'Easy']);
    });

    it('prefers the template\'s own category over the remembered one', () => {
      localStorage.setItem('last_category_id', '5');
      renderModal({ ...BUG, category_id: 4 });
      expect(screen.getByLabelText('CATEGORY')).toHaveValue('4');
    });

    it('uses the remembered category when the template has none', () => {
      localStorage.setItem('last_category_id', '5');
      renderModal();
      expect(screen.getByLabelText('CATEGORY')).toHaveValue('5');
    });

    it('falls back to no category when the remembered one was deleted', () => {
      localStorage.setItem('last_category_id', '99');
      renderModal();
      expect(screen.getByLabelText('CATEGORY')).toHaveValue('');
    });

    it('creates with the chosen category', () => {
      renderModal();
      fill('title', 'x');
      fireEvent.change(screen.getByLabelText('CATEGORY'), { target: { value: '4' } });
      create();
      expect(mockAddObjective).toHaveBeenCalledWith('x', 4, false, expect.anything());
    });
  });

  describe('Add to Mission', () => {
    it('is checked when opened from a surface that adds to Mission, and sent as inMission', () => {
      renderModal();
      expect(screen.getByLabelText('ADD_TO_MISSION')).toBeChecked();
    });

    it('is unchecked when opened from a bucket panel, and can be toggled', () => {
      renderModal(BUG, { defaultBucketId: 9, defaultInMission: false });
      const box = screen.getByLabelText('ADD_TO_MISSION');
      expect(box).not.toBeChecked();
      fill('title', 'x');
      fireEvent.click(box);
      create();
      expect(mockAddObjective).toHaveBeenCalledWith('x', null, false, expect.objectContaining({ inMission: true }));
    });
  });

  it('remembers the bucket and category it created with', () => {
    renderModal();
    fill('title', 'x');
    fireEvent.change(screen.getByLabelText('BUCKET'), { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText('CATEGORY'), { target: { value: '5' } });
    create();
    expect(localStorage.getItem('last_bucket_id')).toBe('9');
    expect(localStorage.getItem('last_category_id')).toBe('5');
  });

  it('Enter in a field creates and Escape cancels', () => {
    const { onClose } = renderModal();
    fill('title', 'x');
    fireEvent.keyDown(screen.getByLabelText('title'), { key: 'Enter' });
    expect(mockAddObjective).toHaveBeenCalledOnce();

    mockAddObjective.mockClear();
    onClose.mockClear();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
    expect(mockAddObjective).not.toHaveBeenCalled();
  });

  it('does not create twice on a double submit', () => {
    renderModal();
    fill('title', 'x');
    create();
    create();
    expect(mockAddObjective).toHaveBeenCalledTimes(1);
  });
});
