import { NavLink } from 'react-router-dom';
import { TABS } from '../tabs';

export function Header() {
  return (
    <header className="hd">
      <div className="brand">
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="13" fill="none" stroke="#fff" strokeWidth="2" />
          <path d="M16 3A13 13 0 0 1 16 29A7 13 0 0 0 16 3Z" fill="#EAFE07" />
        </svg>
        MOON STATUS
      </div>
      <nav className="tabs" aria-label="Sections">
        {TABS.map((t) => (
          <NavLink key={t.path} to={t.path} end={t.path === '/'}>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
