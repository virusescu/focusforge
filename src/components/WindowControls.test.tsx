import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WindowControls } from './WindowControls';

// Use vi.hoisted to ensure mocks are available when vi.mock is evaluated
const { mockMinimize, mockClose } = vi.hoisted(() => {
  return {
    mockMinimize: vi.fn(),
    mockClose: vi.fn(),
  };
});

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    minimize: mockMinimize,
    close: mockClose,
  })
}));

describe('WindowControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders minimize and close buttons', () => {
    render(<WindowControls />);
    expect(screen.getByTitle('MINIMIZE_SYSTEM')).toBeInTheDocument();
    expect(screen.getByTitle('TERMINATE_PROCESS')).toBeInTheDocument();
  });

  it('calls minimize when minimize button is clicked', () => {
    render(<WindowControls />);
    const minimizeBtn = screen.getByTitle('MINIMIZE_SYSTEM');
    fireEvent.click(minimizeBtn);
    expect(mockMinimize).toHaveBeenCalledTimes(1);
  });

  it('calls close when close button is clicked', () => {
    render(<WindowControls />);
    const closeBtn = screen.getByTitle('TERMINATE_PROCESS');
    fireEvent.click(closeBtn);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
