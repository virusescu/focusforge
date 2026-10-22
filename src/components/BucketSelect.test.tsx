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

  describe('keyboard on the closed trigger', () => {
    it('opening the list moves the keyboard into it', () => {
      render(<Harness />);
      fireEvent.click(trigger());
      expect(screen.getByRole('listbox')).toHaveFocus();
    });

    it('Backspace picks the "all" entry when there is one, and does nothing otherwise', () => {
      const onClear = vi.fn();
      const { unmount } = render(<BucketSelect ariaLabel="Bucket" buckets={BUCKETS} value={9} allLabel="All buckets" onChange={vi.fn()} onClear={onClear} />);
      fireEvent.keyDown(trigger(), { key: 'Backspace' });
      expect(onClear).toHaveBeenCalledOnce();
      unmount();
      const onChange = vi.fn();
      render(<BucketSelect ariaLabel="Bucket" buckets={BUCKETS} value={9} onChange={onChange} />);
      fireEvent.keyDown(trigger(), { key: 'Backspace' });
      expect(onChange).not.toHaveBeenCalled();
    });

    it('Up and Down cycle through the options without opening the list, wrapping around', () => {
      const onChange = vi.fn();
      render(<Harness initial={9} onChange={onChange} />);
      fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
      expect(trigger()).toHaveTextContent('Home');
      fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
      expect(trigger()).toHaveTextContent('Unsorted'); // wrapped
      fireEvent.keyDown(trigger(), { key: 'ArrowUp' });
      expect(trigger()).toHaveTextContent('Home');
      expect(screen.queryByRole('listbox')).toBeNull();
      expect(onChange).toHaveBeenCalledTimes(3);
    });

    it('Space and Enter open the list, and the keys do not reach the page', () => {
      const onWindowKey = vi.fn();
      window.addEventListener('keydown', onWindowKey);
      render(<Harness />);
      fireEvent.keyDown(trigger(), { key: ' ' });
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      window.removeEventListener('keydown', onWindowKey);
      expect(onWindowKey).not.toHaveBeenCalled();
    });

    it('with an "all" entry the cycle includes it', () => {
      const onClear = vi.fn();
      render(
        <BucketSelect ariaLabel="Bucket" buckets={BUCKETS} value={2} allLabel="All buckets" onChange={vi.fn()} onClear={onClear} />,
      );
      fireEvent.keyDown(trigger(), { key: 'ArrowUp' }); // Unsorted -> All
      expect(onClear).toHaveBeenCalledOnce();
    });
  });

  describe('with an "all" entry', () => {
    function AllHarness({ onClear = vi.fn(), onChange = vi.fn() }: { onClear?: () => void; onChange?: (id: number) => void }) {
      const [value, setValue] = useState<number | null>(null);
      return (
        <BucketSelect
          ariaLabel="Bucket"
          buckets={BUCKETS}
          value={value}
          allLabel="All buckets"
          onChange={id => { setValue(id); onChange(id); }}
          onClear={() => { setValue(null); onClear(); }}
        />
      );
    }

    it('lists it first, without a color, and shows it while nothing is chosen', () => {
      render(<AllHarness />);
      expect(trigger()).toHaveTextContent('All buckets');
      fireEvent.click(trigger());
      expect(options().map(o => o.textContent)).toEqual(['All buckets', 'Unsorted', 'Work', 'Home']);
      expect(options()[0].querySelector('span[style]')).toBeNull();
      expect(options()[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('choosing a bucket reports it, and choosing "all" again reports a clear', () => {
      const onChange = vi.fn();
      const onClear = vi.fn();
      render(<AllHarness onChange={onChange} onClear={onClear} />);
      fireEvent.click(trigger());
      fireEvent.click(options()[2]);
      expect(onChange).toHaveBeenCalledWith(9);
      fireEvent.click(trigger());
      fireEvent.click(options()[0]);
      expect(onClear).toHaveBeenCalledOnce();
      expect(trigger()).toHaveTextContent('All buckets');
    });
  });
});
