import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsModal } from './SettingsModal';

const mockUpdateSettings = vi.fn();

vi.mock('../contexts/UserContext', () => ({
  useUser: () => ({
    user: { debug_speed: 1, experience_lvl: 42, day_start_hour: 8, day_end_hour: 2 },
    name: 'Ada',
    email: 'ada@example.com',
    updateSettings: mockUpdateSettings,
    loading: false,
  }),
}));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ logout: vi.fn() }) }));
vi.mock('../contexts/FocusContext', () => ({
  useFocus: () => ({
    templates: [{ id: 1, name: 'Bug', title: '$t', details: '', color: '#f44', category_id: null, sort_order: 0 }],
    categories: [{ id: 4, label: 'Hard', color: '#f44', sort_order: 0, coin_bounty: 50 }],
    objectivePool: [],
    addCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
    reorderCategories: vi.fn(),
    updateTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
    reorderTemplates: vi.fn(),
  }),
}));
vi.mock('../utils/audio', () => ({
  soundEngine: { playClick: vi.fn(), playTab: vi.fn(), playKey: vi.fn(), playHover: vi.fn(), playReorder: vi.fn() },
  playObjectiveComplete: vi.fn(),
}));

const renderSettings = () => {
  const onClose = vi.fn();
  render(<SettingsModal onClose={onClose} />);
  return { onClose };
};

describe('SettingsModal managers', () => {
  beforeEach(() => mockUpdateSettings.mockReset().mockResolvedValue(undefined));

  it('has buttons to manage templates and categories', () => {
    renderSettings();
    expect(screen.getByRole('button', { name: /TEMPLATES/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /CATEGORIES/ })).toBeInTheDocument();
  });

  it('TEMPLATES opens the template manager on top of Settings', () => {
    const { onClose } = renderSettings();
    fireEvent.click(screen.getByRole('button', { name: /TEMPLATES/ }));
    expect(screen.getByRole('dialog', { name: 'MANAGE_TEMPLATES' })).toBeInTheDocument();
    expect(screen.getByText('SYSTEM_SETTINGS')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('CATEGORIES opens the category manager', () => {
    renderSettings();
    fireEvent.click(screen.getByRole('button', { name: /CATEGORIES/ }));
    expect(screen.getByText('MANAGE_CATEGORIES')).toBeInTheDocument();
  });

  it('Escape closes only the template manager, not Settings', () => {
    const { onClose } = renderSettings();
    fireEvent.click(screen.getByRole('button', { name: /TEMPLATES/ }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'MANAGE_TEMPLATES' })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('SYSTEM_SETTINGS')).toBeInTheDocument();
  });

  it('Escape closes only the category manager, not Settings', () => {
    const { onClose } = renderSettings();
    fireEvent.click(screen.getByRole('button', { name: /CATEGORIES/ }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText('MANAGE_CATEGORIES')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Enter typed in a manager does not apply and close Settings', () => {
    const { onClose } = renderSettings();
    fireEvent.click(screen.getByRole('button', { name: /TEMPLATES/ }));
    fireEvent.keyDown(screen.getByLabelText('NAME'), { key: 'Enter' });
    expect(mockUpdateSettings).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Enter in the category manager does not apply and close Settings either', () => {
    const { onClose } = renderSettings();
    fireEvent.click(screen.getByRole('button', { name: /CATEGORIES/ }));
    fireEvent.keyDown(screen.getByDisplayValue('Hard'), { key: 'Enter' });
    expect(mockUpdateSettings).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Settings\' own Escape and Enter still work with no manager open', async () => {
    const { onClose } = renderSettings();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(mockUpdateSettings).toHaveBeenCalledOnce();
  });

  it('clicks inside a manager do not close Settings', () => {
    const { onClose } = renderSettings();
    fireEvent.click(screen.getByRole('button', { name: /CATEGORIES/ }));
    fireEvent.click(screen.getByText('MANAGE_CATEGORIES'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
