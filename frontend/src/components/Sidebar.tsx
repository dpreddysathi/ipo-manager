import { NavLink } from 'react-router-dom';

const LINKS = [
  { to: '/', label: 'Dashboard', icon: '📊', end: true },
  { to: '/ipos', label: 'IPOs', icon: '📈' },
  { to: '/people', label: 'People', icon: '👥' },
  { to: '/money-flow', label: 'Money Flow', icon: '💸' },
];

export function Sidebar() {
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
      <div className="sidebar-foot">Track who sent what, for which IPO.</div>
    </aside>
  );
}
