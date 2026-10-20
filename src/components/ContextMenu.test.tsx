import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContextMenu } from './ContextMenu';

const setup = () => {
  const onClose = vi.fn();
  const onA = vi.fn();
  const onB = vi.fn();
  const onRowClick = vi.fn();
  render(
    <div onClick={onRowClick}>
      <ContextMenu x={10} y={20} onClose={onClose} items={[{ label: 'Alpha', onSelect: onA }, { label: 'Beta', onSelect: onB }]} />
    </div>,
  );
  return { onClose, onA, onB, onRowClick };
};

describe('ContextMenu', () => {
  it('renders its items in a menu', () => {
    setup();
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem').map(i => i.textContent)).toEqual(['Alpha', 'Beta']);
  });

  it('selecting an item runs it and closes the menu', () => {
    const { onA, onB, onClose } = setup();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Beta' }));
    expect(onB).toHaveBeenCalledOnce();
    expect(onA).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('a click in the menu does not reach the element that opened it', () => {
    const { onRowClick } = setup();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Alpha' }));
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('closes on Escape without letting other Escape handlers run', () => {
    const { onClose } = setup();
    const other = vi.fn();
    window.addEventListener('keydown', other);
    fireEvent.keyDown(window, { key: 'Escape' });
    window.removeEventListener('keydown', other);
    expect(onClose).toHaveBeenCalledOnce();
    expect(other).not.toHaveBeenCalled();
  });

  it('closes on a press outside, but not on a press inside', () => {
    const { onClose } = setup();
    fireEvent.pointerDown(screen.getByRole('menuitem', { name: 'Alpha' }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('is rendered in document.body, outside its React parent', () => {
    setup();
    expect(screen.getByRole('menu').parentElement).toBe(document.body);
  });
});
