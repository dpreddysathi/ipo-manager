import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const LINKS = [
  { to: '/', label: 'Dashboard', icon: '📊', end: true },
  { to: '/ipos', label: 'IPOs', icon: '📈' },
  { to: '/people', label: 'People', icon: '👥' },
  { to: '/money-flow', label: 'Money Flow', icon: '💸' },
];

export function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="logo">📈</span>
        IPO Manager
      </div>
      <nav className="nav">
        {LINKS.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            <span>{l.icon}</span> {l.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-foot">
        {user && (
          <div className="sidebar-user">
            <span className="avatar-dot" aria-hidden="true">
              {(user.name || user.email).charAt(0).toUpperCase()}
            </span>
            <span className="sidebar-user-name" title={user.email}>
              {user.name}
            </span>
            <button
              type="button"
              className="link-btn"
              onClick={logout}
              title="Log out"
            >
              Logout
            </button>
          </div>
        )}
        <div className="sidebar-tag">Track who sent what, for which IPO.</div>
      </div>
    </aside>
  );
}
