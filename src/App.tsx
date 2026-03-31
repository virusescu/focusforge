import { useState } from 'react';
import { Header } from './components/Header';
import { SidebarLeft } from './components/SidebarLeft';
import { MainDisplay } from './components/MainDisplay';
import { SidebarRight } from './components/SidebarRight';
import { Footer } from './components/Footer';
import { AnalyticsView } from './components/AnalyticsView';
import { IntelligenceHub } from './components/IntelligenceHub';
import { GlitchOverlay } from './components/GlitchOverlay';
import { useFocus } from './contexts/FocusContext';
import { NavigationGuard } from './components/NavigationGuard';

function App() {
  const [view, setView] = useState<'hud' | 'analytics' | 'intel'>('hud');
  const [analyticsDate, setAnalyticsDate] = useState<Date>(new Date());
  const [pendingNavigation, setPendingNavigation] = useState<{ target: 'analytics' | 'intel'; dateStr?: string } | null>(null);
  const { timerStatus, resetTimer } = useFocus();

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
    } else {
      setView('intel');
    }
    setPendingNavigation(null);
  };

  const handleCancelNavigation = () => {
    setPendingNavigation(null);
  };

  return (
    <div className="hud-container">
      <GlitchOverlay />
      <Header />
      {view === 'hud' ? (
        <>
          <SidebarLeft onViewAnalytics={() => handleViewAnalytics()} onViewIntel={handleViewIntel} />
          <MainDisplay onViewAnalytics={() => handleViewAnalytics()} onViewIntel={handleViewIntel} />
          <SidebarRight onViewAnalytics={(date) => handleViewAnalytics(date)} />
        </>
      ) : view === 'analytics' ? (
        <AnalyticsView initialDate={analyticsDate} onBack={() => setView('hud')} />
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
  );
}

export default App;
