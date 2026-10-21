import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WindowControls } from './WindowControls';

// Use vi.hoisted to ensure mocks are available when vi.mock is evaluated
const { mockMinimize, mockClose, mockToggleMaximize } = vi.hoisted(() => {
  return {
    mockMinimize: vi.fn(),
    mockToggleMaximize: vi.fn(),
    mockClose: vi.fn(),
  };
});

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    minimize: mockMinimize,
    close: mockClose,
    toggleMaximize: mockToggleMaximize,
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

  it('toggles maximize from the button', () => {
    render(<WindowControls />);
    fireEvent.click(screen.getByTitle('MAXIMIZE_SYSTEM (F11)'));
    expect(mockToggleMaximize).toHaveBeenCalledTimes(1);
  });

  it('toggles maximize on F11', () => {
    render(<WindowControls />);
    fireEvent.keyDown(window, { key: 'F11' });
    expect(mockToggleMaximize).toHaveBeenCalledTimes(1);
  });
});
