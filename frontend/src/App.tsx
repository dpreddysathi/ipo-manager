import { HashRouter, Route, Routes } from 'react-router-dom';
import { DrawerProvider } from './drawer';
import { Sidebar } from './components/Sidebar';
import { PersonDrawer } from './components/PersonDrawer';
import { Dashboard } from './pages/Dashboard';
import { IpoList } from './pages/IpoList';
import { IpoDetail } from './pages/IpoDetail';
import { People } from './pages/People';
import { MoneyFlow } from './pages/MoneyFlow';
import './styles.css';

// HashRouter: the app is a static build (GitHub Pages has no SPA fallback),
// so routes live after the # and always resolve to index.html.
export default function App() {
  return (
    <HashRouter>
      <DrawerProvider>
        <div className="app-shell">
          <Sidebar />
          <main className="main">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/ipos" element={<IpoList />} />
              <Route path="/ipos/:id" element={<IpoDetail />} />
              <Route path="/people" element={<People />} />
              <Route path="/money-flow" element={<MoneyFlow />} />
              <Route path="*" element={<Dashboard />} />
            </Routes>
          </main>
        </div>
        <PersonDrawer />
      </DrawerProvider>
    </HashRouter>
  );
}
