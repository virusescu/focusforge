import { Header } from './components/Header';
import { SidebarLeft } from './components/SidebarLeft';
import { MainDisplay } from './components/MainDisplay';
import { SidebarRight } from './components/SidebarRight';
import { Footer } from './components/Footer';

function App() {
  return (
    <div className="hud-container">
      <Header />
      <SidebarLeft />
      <MainDisplay />
      <SidebarRight />
      <Footer />
    </div>
  );
}

export default App;
