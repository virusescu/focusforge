import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';

const passthrough = ({ children }: { children: ReactNode }) => <>{children}</>;
const stub = (name: string) => () => <div data-testid={name} />;

vi.mock('@tauri-apps/plugin-updater', () => ({ check: vi.fn().mockResolvedValue(null) }));
vi.mock('./contexts/AuthContext', () => ({ useAuth: () => ({ authUser: { id: 1 }, needsSetup: false, loading: false }) }));
vi.mock('./contexts/UserContext', () => ({ UserProvider: passthrough }));
vi.mock('./contexts/GameContext', () => ({ GameProvider: passthrough }));
vi.mock('./contexts/AlarmContext', () => ({ AlarmProvider: passthrough, useAlarms: () => ({ activeAlarm: null, dismissAlarm: vi.fn() }) }));
vi.mock('./contexts/FocusContext', () => ({
  FocusProvider: passthrough,
  useFocus: () => ({
    activeObjectiveId: null, viewedObjectiveId: null, setViewedObjective: vi.fn(), setObjectiveMission: vi.fn(),
    objectivePool: [{ id: 1, text: 'Alpha', created_at: '', is_mission: 0, bucket_id: 2 }],
    buckets: [{ id: 2, name: 'Unsorted', color: '#888', sort_order: 1, kind: 'unsorted', x: 0, y: 0, w: 1, h: 1 }],
    categories: [], updateObjective: vi.fn(), deleteObjective: vi.fn(), duplicateObjective: vi.fn(), moveObjectiveToBucket: vi.fn(), templates: [], addTemplate: vi.fn(),
  }),
}));
for (const name of ['Header', 'SidebarLeft', 'SettingsModal', 'MainDisplay', 'SidebarRight', 'Footer', 'AnalyticsView', 'IntelligenceHub', 'GlitchOverlay', 'LoginScreen', 'SetupScreen', 'SeasonTransitionModal', 'VaultPage', 'BucketsPage', 'FireBackground', 'UpdatePrompt']) {
  vi.doMock(`./components/${name}`, () => ({ [name]: stub(name) }));
}
vi.mock('./components/AlarmOverlay', () => ({ default: () => null }));
vi.mock('./utils/audio', () => ({ soundEngine: new Proxy({}, { get: () => vi.fn() }) }));

describe('main screen search', () => {
  const renderApp = async () => {
    const { default: App } = await import('./App');
    return render(<StrictMode><App /></StrictMode>);
  };
  const popup = () => screen.queryByRole('dialog', { name: 'Search objectives' });

  it('S opens the search popup, and S again closes it', async () => {
    await renderApp();
    expect(popup()).toBeNull();
    fireEvent.keyDown(window, { key: 's' });
    expect(popup()).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'S' });
    expect(popup()).toBeNull();
  });

  it('S typed in a text box does not open it', async () => {
    await renderApp();
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 's' });
    input.remove();
    expect(popup()).toBeNull();
  });

  it('Escape closes it', async () => {
    await renderApp();
    fireEvent.keyDown(window, { key: 's' });
    fireEvent.keyDown(screen.getByLabelText('Search objectives', { selector: 'input' }), { key: 'Escape' });
    expect(popup()).toBeNull();
  });
});
