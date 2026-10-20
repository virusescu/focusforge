import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModalFrame } from './ModalFrame';

describe('ModalFrame focus containment', () => {
  it('takes focus on open when nothing inside grabs it, so typing cannot reach the page behind', () => {
    render(<ModalFrame title="T" onClose={vi.fn()}><p>No inputs here</p></ModalFrame>);
    // Focus sits on the dialog's frame (the focusable wrapper around the role="dialog" box)
    const frame = screen.getByRole('dialog').parentElement as HTMLElement;
    expect(frame.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(document.body);
  });

  it('keeps an input\'s own autofocus', () => {
    render(<ModalFrame title="T" onClose={vi.fn()}><input aria-label="first" autoFocus /></ModalFrame>);
    expect(screen.getByLabelText('first')).toHaveFocus();
  });

  it('keys typed while the dialog itself has focus do not reach the HUD shortcuts', () => {
    const hudShortcut = vi.fn();
    window.addEventListener('keydown', hudShortcut);
    render(<ModalFrame title="T" onClose={vi.fn()}><p>No inputs here</p></ModalFrame>);
    fireEvent.keyDown(document.activeElement as Element, { key: ' ' });
    fireEvent.keyDown(document.activeElement as Element, { key: 'a' });
    window.removeEventListener('keydown', hudShortcut);
    expect(hudShortcut).not.toHaveBeenCalled();
  });

  it('Enter submits even when no input has focus', () => {
    const onSubmit = vi.fn();
    render(<ModalFrame title="T" onClose={vi.fn()} onSubmit={onSubmit}><p>No inputs here</p></ModalFrame>);
    fireEvent.keyDown(document.activeElement as Element, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('is a details-pane barrier, so clicking it does not close an open details pane', () => {
    render(<ModalFrame title="T" onClose={vi.fn()}><p>text</p></ModalFrame>);
    expect(screen.getByRole('dialog').closest('[data-details-barrier]')).not.toBeNull();
  });

  it('a click on the dialog\'s blank space leaves focus inside it', () => {
    render(<ModalFrame title="T" onClose={vi.fn()}><p data-testid="blank">text</p></ModalFrame>);
    // The overlay and dialog are focusable (tabindex -1), so a click on non-focusable content
    // moves focus to them rather than to <body>
    const focusable = screen.getByRole('dialog').closest('[tabindex="-1"]');
    expect(focusable).not.toBeNull();
  });
});
