import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { BucketSelect } from './BucketSelect';
import type { Bucket } from '../types';

vi.mock('../utils/audio', () => ({ soundEngine: { playClick: vi.fn() } }));

const bucket = (id: number, name: string, color: string): Bucket => ({ id, name, color, sort_order: id, kind: 'custom', x: 0, y: 0, w: 1, h: 1 });
const BUCKETS = [bucket(2, 'Unsorted', '#888888'), bucket(9, 'Work', '#3388ff'), bucket(10, 'Home', '#44cc88')];

function Harness({ onChange = vi.fn(), initial = 2 }: { onChange?: (id: number) => void; initial?: number }) {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <>
      <div data-testid="outside" />
      <BucketSelect ariaLabel="Bucket" buckets={BUCKETS} value={value} onChange={id => { setValue(id); onChange(id); }} />
    </>
  );
}

const trigger = () => screen.getByLabelText('Bucket');
const options = () => within(screen.getByRole('listbox')).getAllByRole('option');

describe('BucketSelect', () => {
  it('shows the selected bucket with its color swatch', () => {
    render(<Harness initial={9} />);
    expect(trigger()).toHaveTextContent('Work');
    expect(trigger().querySelector('span')?.getAttribute('style')).toMatch(/rgb\(51, 136, 255\)|#3388ff/i);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('lists every bucket, each with its color, and marks the selected one', () => {
    render(<Harness initial={9} />);
    fireEvent.click(trigger());
    expect(options().map(o => o.textContent)).toEqual(['Unsorted', 'Work', 'Home']);
    expect(options().every(o => /background-color/.test(o.querySelector('span')?.getAttribute('style') ?? ''))).toBe(true);
    expect(options()[1]).toHaveAttribute('aria-selected', 'true');
  });

  it('lists Unsorted first, whatever order the buckets come in', () => {
    const unsortedLast = [bucket(9, 'Work', '#3388ff'), bucket(10, 'Home', '#44cc88'), { ...bucket(2, 'Unsorted', '#888888'), kind: 'unsorted' as const }];
    render(<BucketSelect ariaLabel="Bucket" buckets={unsortedLast} value={9} onChange={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Bucket'));
    expect(options().map(o => o.textContent)).toEqual(['Unsorted', 'Work', 'Home']);
  });

  it('picking an option reports it and closes the list', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('option', { name: 'Home' }));
    expect(onChange).toHaveBeenCalledWith(10);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger()).toHaveTextContent('Home');
  });

  it('picking the current bucket reports nothing', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('option', { name: 'Unsorted' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('arrow keys move and Enter picks', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(trigger());
    const list = screen.getByRole('listbox');
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it('Escape closes only the list and keeps the key from reaching the page', () => {
    const pageKey = vi.fn();
    window.addEventListener('keydown', pageKey);
    render(<Harness />);
    fireEvent.click(trigger());
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(pageKey).not.toHaveBeenCalled();
    window.removeEventListener('keydown', pageKey);
  });

  it('Escape closes the list even when the focus is not on it', () => {
    render(<Harness />);
    fireEvent.click(trigger());
    (screen.getByTestId('outside') as HTMLElement).focus();
    fireEvent.keyDown(screen.getByTestId('outside'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('pressing outside closes the list without picking', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(trigger());
    fireEvent.pointerDown(screen.getByTestId('outside'));
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});
