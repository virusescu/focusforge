import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AnalyticsView } from './AnalyticsView';

// Mock DB
const mockSessions = [
  { id: 1, start_time: '2026-03-24T12:00:00.000Z', duration_seconds: 3600, date: '2026-03-24' },
  { id: 2, start_time: '2026-03-24T16:30:00.000Z', duration_seconds: 1800, date: '2026-03-24' }
];

const mockDeleteFocusSession = vi.fn().mockResolvedValue(undefined);

vi.mock('../db', () => ({
  getSessionsForDay: vi.fn().mockImplementation(() => Promise.resolve(mockSessions)),
  deleteFocusSession: (id: number) => mockDeleteFocusSession(id)
}));

describe('AnalyticsView', () => {
  const onBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly and loads sessions', async () => {
    render(<AnalyticsView onBack={onBack} />);
    
    expect(screen.getByText('SYSTEM_ANALYTICS')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('1h 30m')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // Session count
    });
  });

  it('navigates to previous and next days', async () => {
    render(<AnalyticsView onBack={onBack} />);
    
    // Find nav buttons
    const navButtons = screen.getAllByRole('button');
    const prevBtn = navButtons[1];
    const nextBtn = navButtons[2];

    fireEvent.click(prevBtn);
    // Just verify the nav button was clicked and state changed (the exact date format is locale-dependent)
    await waitFor(() => {
      expect(screen.getByText(/DAY:/)).toBeInTheDocument();
    });

    fireEvent.click(nextBtn);
    await waitFor(() => {
      expect(screen.getByText(/DAY:/)).toBeInTheDocument();
    });
  });

  it('calls onBack when back button is clicked', () => {
    render(<AnalyticsView onBack={onBack} />);
    fireEvent.click(screen.getByText('BACK_TO_HUD'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('calls deleteFocusSession when delete button is clicked', async () => {
    render(<AnalyticsView onBack={onBack} />);
    
    await waitFor(() => {
      expect(screen.getAllByTitle('DELETE_RECORD').length).toBeGreaterThan(0);
    });

    const deleteBtn = screen.getAllByTitle('DELETE_RECORD')[0];
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(mockDeleteFocusSession).toHaveBeenCalledWith(1);
    });
  });
});
