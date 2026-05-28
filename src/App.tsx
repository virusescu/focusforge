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
import { NavigationGuard } from './components/NavigationGuard';
import { RewardToast } from './components/RewardToast';
import { SeasonTransitionModal } from './components/SeasonTransitionModal';
import { VaultPage } from './components/VaultPage';
import { FireBackground } from './components/FireBackground';
import AlarmOverlay from './components/AlarmOverlay';

function HudApp() {
  const [view, setView] = useState<'hud' | 'analytics' | 'intel' | 'vault'>('hud');
  const [analyticsDate, setAnalyticsDate] = useState<Date>(new Date());
  const [pendingNavigation, setPendingNavigation] = useState<{ target: 'analytics' | 'intel' | 'vault'; dateStr?: string } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(false);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(350);
  const resizingRef = useRef(false);
  const { timerStatus, resetTimer, activeObjectiveId } = useFocus();
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
    if (timerStatus !== 'idle') {
      setPendingNavigation({ target: 'analytics', dateStr });
      return;
    }
    if (dateStr) setAnalyticsDate(new Date(dateStr));
    else setAnalyticsDate(new Date());
    setView('analytics');
  };

  const handleViewIntel = () => {
    if (timerStatus !== 'idle') {
      setPendingNavigation({ target: 'intel' });
      return;
    }
    setView('intel');
  };

  const handleViewVault = () => {
    if (timerStatus !== 'idle') {
      setPendingNavigation({ target: 'vault' });
      return;
    }
    setView('vault');
  };

  const handleConfirmNavigation = () => {
    if (!pendingNavigation) return;
    resetTimer();
    if (pendingNavigation.target === 'analytics') {
      if (pendingNavigation.dateStr) setAnalyticsDate(new Date(pendingNavigation.dateStr));
      else setAnalyticsDate(new Date());
      setView('analytics');
    } else if (pendingNavigation.target === 'vault') {
      setView('vault');
    } else {
      setView('intel');
    }
    setPendingNavigation(null);
  };

  const handleCancelNavigation = () => {
    setPendingNavigation(null);
  };

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

  return (
    <>
      <FireBackground />
      <div className="hud-container" style={{ gridTemplateColumns: `350px 1fr ${rightSidebarWidth}px` }}>
        <GlitchOverlay />
        <Header onOpenSettings={() => setIsSettingsOpen(true)} onViewVault={handleViewVault} />
        {view === 'hud' ? (
          <>
            <SidebarLeft onOpenSettings={() => setIsSettingsOpen(true)} onOpenDetails={() => setDetailsPanelOpen(true)} />
            <MainDisplay
              onViewAnalytics={() => handleViewAnalytics()}
              onViewIntel={handleViewIntel}
              onViewVault={handleViewVault}
              onOpenDetails={() => setDetailsPanelOpen(true)}
              detailsPanelOpen={detailsPanelOpen}
            />
            <div className="right-sidebar-wrapper">
              <div className="resize-handle" data-details-barrier onMouseDown={handleResizeStart} />
              <SidebarRight
                onViewAnalytics={(date) => handleViewAnalytics(date)}
                onViewIntel={handleViewIntel}
                onViewVault={handleViewVault}
                detailsPanelOpen={detailsPanelOpen}
                onCloseDetails={() => setDetailsPanelOpen(false)}
              />
            </div>
          </>
        ) : view === 'analytics' ? (
          <AnalyticsView initialDate={analyticsDate} onBack={() => setView('hud')} />
        ) : view === 'vault' ? (
          <VaultPage onBack={() => setView('hud')} />
        ) : (
          <IntelligenceHub onBack={() => setView('hud')} />
        )}
        <Footer />

        {pendingNavigation && (
          <NavigationGuard
            onConfirm={handleConfirmNavigation}
            onCancel={handleCancelNavigation}
          />
        )}
      </div>
      <RewardToast />
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
