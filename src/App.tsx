import { useState } from 'react';
import { Header } from './components/Header';
import { SidebarLeft } from './components/SidebarLeft';
import { MainDisplay } from './components/MainDisplay';
import { SidebarRight } from './components/SidebarRight';
import { Footer } from './components/Footer';
import { AnalyticsView } from './components/AnalyticsView';
import { GlitchOverlay } from './components/GlitchOverlay';

function App() {
  const [view, setView] = useState<'hud' | 'analytics'>('hud');
  const [analyticsDate, setAnalyticsDate] = useState<Date>(new Date());

  const handleViewAnalytics = (dateStr?: string) => {
    if (dateStr) {
      setAnalyticsDate(new Date(dateStr));
    } else {
      setAnalyticsDate(new Date());
    }
    setView('analytics');
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
    </div>
  );
}

export default App;
