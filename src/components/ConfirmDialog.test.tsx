import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDialog } from './ConfirmDialog';

const setup = () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmDialog
      title="DELETE_NOTE"
      message="Its text will be lost."
      confirmLabel="DELETE"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );
  return { onConfirm, onCancel };
};

describe('ConfirmDialog', () => {
  it('shows the title, the message and both buttons', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'DELETE_NOTE' })).toBeInTheDocument();
    expect(screen.getByText('Its text will be lost.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'DELETE' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CANCEL' })).toBeInTheDocument();
  });

  it('confirming runs onConfirm only', () => {
    const { onConfirm, onCancel } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'DELETE' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('Cancel, the X and Escape all cancel without confirming', () => {
    const { onConfirm, onCancel } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'CANCEL' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(3);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('starts focused on Cancel, so a stray Enter or Space cannot delete anything', () => {
    setup();
    expect(screen.getByRole('button', { name: 'CANCEL' })).toHaveFocus();
  });

  it('Enter does not confirm from anywhere in the dialog', () => {
    const { onConfirm } = setup();
    fireEvent.keyDown(screen.getByRole('button', { name: 'CANCEL' }), { key: 'Enter' });
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter' });
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
