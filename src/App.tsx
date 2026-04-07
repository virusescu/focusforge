import { useState, useEffect } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import type { Update } from '@tauri-apps/plugin-updater';
import { UpdatePrompt } from './components/UpdatePrompt';
import { Header } from './components/Header';
import { SidebarLeft } from './components/SidebarLeft';
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
import { UserProvider } from './contexts/UserContext';
import { FocusProvider } from './contexts/FocusContext';
import { GameProvider } from './contexts/GameContext';
import { NavigationGuard } from './components/NavigationGuard';
import { RewardToast } from './components/RewardToast';
import { SeasonTransitionModal } from './components/SeasonTransitionModal';
import { VaultPage } from './components/VaultPage';

function HudApp() {
  const [view, setView] = useState<'hud' | 'analytics' | 'intel' | 'vault'>('hud');
  const [analyticsDate, setAnalyticsDate] = useState<Date>(new Date());
  const [pendingNavigation, setPendingNavigation] = useState<{ target: 'analytics' | 'intel' | 'vault'; dateStr?: string } | null>(null);
  const { timerStatus, resetTimer } = useFocus();
  const [availableUpdate, setAvailableUpdate] = useState<Update | null>(null);

  useEffect(() => {
    console.log('Checking for updates...');
    check().then(update => {
      if (update) {
        console.log('Update found:', update.version);
        setAvailableUpdate(update);
      } else {
        console.log('No updates available');
      }
    }).catch(err => {
      console.error('Update check failed:', err);
    });
  }, []);

  const handleViewAnalytics = (dateStr?: string) => {
    if (timerStatus !== 'idle') {
      setPendingNavigation({ target: 'analytics', dateStr });
      return;
    }

    if (dateStr) {
      setAnalyticsDate(new Date(dateStr));
    } else {
      setAnalyticsDate(new Date());
    }
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
      if (pendingNavigation.dateStr) {
        setAnalyticsDate(new Date(pendingNavigation.dateStr));
      } else {
        setAnalyticsDate(new Date());
      }
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

  return (
  <>
    <div className="hud-container">
      <GlitchOverlay />
      <Header />
      {view === 'hud' ? (
        <>
          <SidebarLeft />
          <MainDisplay onViewAnalytics={() => handleViewAnalytics()} onViewIntel={handleViewIntel} onViewVault={handleViewVault} />
          <SidebarRight onViewAnalytics={(date) => handleViewAnalytics(date)} onViewIntel={handleViewIntel} onViewVault={handleViewVault} />
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
    {availableUpdate && (
      <UpdatePrompt
        update={availableUpdate}
        onSkip={() => setAvailableUpdate(null)}
      />
    )}
  </>
  );
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
          <AppContent />
        </GameProvider>
      </FocusProvider>
    </UserProvider>
  );
}

// Extract the content that uses context hooks to a separate component
// so that context providers are available when the hooks are called.
function AppContent() {
  return <HudApp />;
}

export default App;
