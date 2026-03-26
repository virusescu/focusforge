import { useState } from 'react';
import { Header } from './components/Header';
import { SidebarLeft } from './components/SidebarLeft';
import { MainDisplay } from './components/MainDisplay';
import { SidebarRight } from './components/SidebarRight';
import { Footer } from './components/Footer';
import { AnalyticsView } from './components/AnalyticsView';
import { GlitchOverlay } from './components/GlitchOverlay';
import { useFocus } from './contexts/FocusContext';
import { NavigationGuard } from './components/NavigationGuard';

function App() {
  const [view, setView] = useState<'hud' | 'analytics'>('hud');
  const [analyticsDate, setAnalyticsDate] = useState<Date>(new Date());
  const [pendingNavigation, setPendingNavigation] = useState<{ dateStr?: string } | null>(null);
  const { timerStatus, resetTimer } = useFocus();

  const handleViewAnalytics = (dateStr?: string) => {
    if (timerStatus !== 'idle') {
      setPendingNavigation({ dateStr });
      return;
    }

    if (dateStr) {
      setAnalyticsDate(new Date(dateStr));
    } else {
      setAnalyticsDate(new Date());
    }
    setView('analytics');
  };

  const handleConfirmNavigation = () => {
    const dateStr = pendingNavigation?.dateStr;
    resetTimer();
    
    if (dateStr) {
      setAnalyticsDate(new Date(dateStr));
    } else {
      setAnalyticsDate(new Date());
    }
    setView('analytics');
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
          <SidebarLeft onViewAnalytics={() => handleViewAnalytics()} />
          <MainDisplay onViewAnalytics={() => handleViewAnalytics()} />
          <SidebarRight onViewAnalytics={(date) => handleViewAnalytics(date)} />
        </>
      ) : (
        <AnalyticsView initialDate={analyticsDate} onBack={() => setView('hud')} />
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
