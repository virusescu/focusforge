import { useState, useEffect, useRef, useCallback } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import type { Update } from '@tauri-apps/plugin-updater';
import { UpdatePrompt } from './components/UpdatePrompt';
import { Header } from './components/Header';
import { SidebarLeft } from './components/SidebarLeft';
import { SettingsModal } from './components/SettingsModal';
import { MainDisplay } from './components/MainDisplay';
import { SidebarRight } from './components/SidebarRight';
import { Footer } from './components/Footer';
import { AnalyticsView } from './components/AnalyticsView';
import { IntelligenceHub } from './components/IntelligenceHub';
import { GlitchOverlay } from './components/GlitchOverlay';
import { LoginScreen } from './components/LoginScreen';
import { SetupScreen } from './components/SetupScreen';
import { useFocus } from './contexts/FocusContext';
import { useAuth } from './contexts/AuthContext';
import { useAlarms } from './contexts/AlarmContext';
import { UserProvider } from './contexts/UserContext';
import { FocusProvider } from './contexts/FocusContext';
import { GameProvider } from './contexts/GameContext';
import { AlarmProvider } from './contexts/AlarmContext';

import { SeasonTransitionModal } from './components/SeasonTransitionModal';
import { VaultPage } from './components/VaultPage';
import { BucketsPage } from './components/BucketsPage';
import { FireBackground } from './components/FireBackground';
import AlarmOverlay from './components/AlarmOverlay';

const LEFT_SIDEBAR_WIDTH_KEY = 'left_sidebar_width';
const LEFT_SIDEBAR_MIN = 280;
const LEFT_SIDEBAR_MAX = 600;
const LEFT_SIDEBAR_DEFAULT = 350;

function loadLeftSidebarWidth(): number {
  const stored = Number(localStorage.getItem(LEFT_SIDEBAR_WIDTH_KEY));
  if (!Number.isFinite(stored) || stored === 0) return LEFT_SIDEBAR_DEFAULT;
  return Math.max(LEFT_SIDEBAR_MIN, Math.min(LEFT_SIDEBAR_MAX, stored));
}

function HudApp() {
  const [view, setView] = useState<'hud' | 'analytics' | 'intel' | 'vault' | 'buckets'>('hud');
  const [analyticsDate, setAnalyticsDate] = useState<Date>(new Date());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(false);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(350);
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(loadLeftSidebarWidth);
  const resizingRef = useRef(false);
  const { activeObjectiveId } = useFocus();
  const { activeAlarm, dismissAlarm } = useAlarms();
  const [availableUpdate, setAvailableUpdate] = useState<Update | null>(null);

  useEffect(() => {
    localStorage.setItem('last_app_use', Date.now().toString());
  }, []);

  useEffect(() => {
    check().then(update => {
      if (update) setAvailableUpdate(update);
    }).catch(err => {
      console.error('Update check failed:', err);
    });
  }, []);

  useEffect(() => {
    if (activeObjectiveId !== null) {
      setDetailsPanelOpen(true);
    } else {
      setDetailsPanelOpen(false);
    }
  }, [activeObjectiveId]);

  const handleViewAnalytics = (dateStr?: string) => {
    if (dateStr) setAnalyticsDate(new Date(dateStr));
    else setAnalyticsDate(new Date());
    setView('analytics');
  };

  const handleViewIntel = () => setView('intel');
  const handleViewVault = () => setView('vault');
  const handleViewBuckets = () => setView('buckets');

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    const startX = e.clientX;
    const startWidth = rightSidebarWidth;
    const onMouseMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX;
      setRightSidebarWidth(Math.max(280, Math.min(700, startWidth + delta)));
    };
    const onMouseUp = () => {
      resizingRef.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [rightSidebarWidth]);

  const handleLeftResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftSidebarWidth;
    let latest = startWidth;
    const onMouseMove = (ev: MouseEvent) => {
      latest = Math.max(LEFT_SIDEBAR_MIN, Math.min(LEFT_SIDEBAR_MAX, startWidth + ev.clientX - startX));
      setLeftSidebarWidth(latest);
    };
    const onMouseUp = () => {
      localStorage.setItem(LEFT_SIDEBAR_WIDTH_KEY, String(latest));
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [leftSidebarWidth]);

  return (
    <>
      <FireBackground />
      <div className="hud-container" style={{ gridTemplateColumns: `${leftSidebarWidth}px 1fr ${rightSidebarWidth}px` }}>
        <GlitchOverlay />
        <Header onOpenSettings={() => setIsSettingsOpen(true)} onViewVault={handleViewVault} />
        {view === 'hud' ? (
          <>
            <div className="left-sidebar-wrapper">
              <SidebarLeft onOpenDetails={() => setDetailsPanelOpen(true)} onViewBuckets={handleViewBuckets} />
              <div className="resize-handle resize-handle-right" data-details-barrier onMouseDown={handleLeftResizeStart} />
            </div>
            <MainDisplay
              onViewAnalytics={() => handleViewAnalytics()}
              onViewIntel={handleViewIntel}
              onViewVault={handleViewVault}
              onViewBuckets={handleViewBuckets}
              onOpenDetails={() => setDetailsPanelOpen(true)}
              detailsPanelOpen={detailsPanelOpen}
            />
            <div className="right-sidebar-wrapper">
              <div className="resize-handle" data-details-barrier onMouseDown={handleResizeStart} />
              <SidebarRight
                onViewAnalytics={(date) => handleViewAnalytics(date)}
                onViewIntel={handleViewIntel}
                onViewVault={handleViewVault}
                onViewBuckets={handleViewBuckets}
                onOpenSettings={() => setIsSettingsOpen(true)}
                detailsPanelOpen={detailsPanelOpen}
                onCloseDetails={() => setDetailsPanelOpen(false)}
              />
            </div>
          </>
        ) : view === 'analytics' ? (
          <AnalyticsView initialDate={analyticsDate} onBack={() => setView('hud')} />
        ) : view === 'vault' ? (
          <VaultPage onBack={() => setView('hud')} />
        ) : view === 'buckets' ? (
          <BucketsPage onBack={() => setView('hud')} />
        ) : (
          <IntelligenceHub onBack={() => setView('hud')} />
        )}
        <Footer />


      </div>
      <SeasonTransitionModal />
      {isSettingsOpen && (
        <SettingsModal onClose={() => setIsSettingsOpen(false)} />
      )}
      {availableUpdate && (
        <UpdatePrompt
          update={availableUpdate}
          onSkip={() => setAvailableUpdate(null)}
        />
      )}
      {activeAlarm && (
        <AlarmOverlay alarm={activeAlarm} onDismiss={dismissAlarm} />
      )}
    </>
  );
}

function AppContent() {
  return <HudApp />;
}

function App() {
  const { authUser, needsSetup, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0a', color: '#00ff88', fontFamily: 'monospace' }}>
        INITIALIZING_SYSTEM...
      </div>
    );
  }

  if (!authUser && !needsSetup) {
    return <LoginScreen />;
  }

  if (needsSetup) {
    return <SetupScreen />;
  }

  return (
    <UserProvider>
      <FocusProvider>
        <GameProvider>
          <AlarmProvider>
            <AppContent />
          </AlarmProvider>
        </GameProvider>
      </FocusProvider>
    </UserProvider>
  );
}

export default App;
