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

describe('ContextMenu submenus', () => {
  const setupSub = () => {
    const onClose = vi.fn();
    const onPick = vi.fn();
    render(
      <ContextMenu
        x={10}
        y={20}
        onClose={onClose}
        items={[
          { label: 'Plain', onSelect: vi.fn() },
          { label: 'Move', submenu: [{ label: 'One', onSelect: onPick }, { label: 'Two', checked: true, onSelect: vi.fn() }] },
        ]}
      />,
    );
    return { onClose, onPick };
  };

  it('keeps the nested list closed until its item is hovered or clicked', () => {
    setupSub();
    expect(screen.queryByRole('menuitem', { name: 'One' })).toBeNull();
    fireEvent.mouseEnter(screen.getByRole('menuitem', { name: 'Move' }).parentElement as HTMLElement);
    expect(screen.getByRole('menuitem', { name: 'One' })).toBeInTheDocument();
  });

  it('opens on click too, and a click on the item again closes it', () => {
    setupSub();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move' }));
    expect(screen.getByRole('menuitem', { name: 'One' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move' }));
    expect(screen.queryByRole('menuitem', { name: 'One' })).toBeNull();
  });

  it('hovering another item closes the nested list', () => {
    setupSub();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move' }));
    fireEvent.mouseEnter(screen.getByRole('menuitem', { name: 'Plain' }));
    expect(screen.queryByRole('menuitem', { name: 'One' })).toBeNull();
  });

  it('picking a nested item runs it and closes the whole menu; the checked one shows a check', () => {
    const { onClose, onPick } = setupSub();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move' }));
    expect(screen.getByRole('menuitem', { name: 'Two' }).querySelector('svg')).not.toBeNull();
    expect(screen.getByRole('menuitem', { name: 'One' }).querySelector('svg')).toBeNull();
    fireEvent.click(screen.getByRole('menuitem', { name: 'One' }));
    expect(onPick).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalled();
  });

  it('a press inside the nested list is not an outside press', () => {
    const { onClose } = setupSub();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move' }));
    fireEvent.pointerDown(screen.getByRole('menuitem', { name: 'One' }));
    expect(onClose).not.toHaveBeenCalled();
  });
});

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

  it('is a details-pane barrier, so using it does not close an open details pane', () => {
    setup();
    expect(screen.getByRole('menu').closest('[data-details-barrier]')).not.toBeNull();
  });

  it('is rendered in document.body, outside its React parent', () => {
    setup();
    expect(screen.getByRole('menu').parentElement).toBe(document.body);
  });
});
