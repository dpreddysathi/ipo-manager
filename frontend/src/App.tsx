import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { DrawerProvider } from './drawer';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { Sidebar } from './components/Sidebar';
import { PersonDrawer } from './components/PersonDrawer';
import { Dashboard } from './pages/Dashboard';
import { IpoList } from './pages/IpoList';
import { IpoDetail } from './pages/IpoDetail';
import { People } from './pages/People';
import { MoneyFlow } from './pages/MoneyFlow';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import './styles.css';

/** Bounces visitors without a session to /login; waits for a saved
 *  session to be checked first so a refresh doesn't flash the login page. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) {
    return (
      <div className="auth-loading">
        <span className="logo">📈</span> Loading IPO Manager…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppShell() {
  return (
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
  );
}

// HashRouter: the app is a static build (GitHub Pages has no SPA fallback),
// so routes live after the # and always resolve to index.html.
export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/*"
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          />
        </Routes>
      </AuthProvider>
    </HashRouter>
  );
}
