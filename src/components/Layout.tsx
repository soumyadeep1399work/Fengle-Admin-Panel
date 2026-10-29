import { NavLink, Outlet } from 'react-router-dom';
import logo from '../assets/fengle-logo.png';
import { useState } from 'react';
import { useAuth, useCan } from '../auth';
import { roleLabel, type Permission } from '../lib/permissions';
import { ChangePassword } from '../pages/Admins';
import { API_URL } from '../api/client';

const I = {
  dash: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  orders: 'M7 4h10l1 3H6l1-3zM5 8h14l-1.2 11.2A2 2 0 0115.8 21H8.2a2 2 0 01-2-1.8L5 8zm4 3v6m6-6v6',
  kitchen: 'M4 10h16v10H4zM4 10l2-6h12l2 6M9 20v-5h6v5',
  rider: 'M5 18a3 3 0 100-6 3 3 0 000 6zm14 0a3 3 0 100-6 3 3 0 000 6zM5 15l4-7h5l3 7M12 8l-2-3H7',
  settle: 'M3 7h18v10H3zM12 15a3 3 0 100-6 3 3 0 000 6zM6 10v4m12-4v4',
  cat: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  items: 'M4 6h16M4 12h16M4 18h10',
  users: 'M9 11a4 4 0 100-8 4 4 0 000 8zM2 21v-1a6 6 0 0112 0v1M16 3.5a4 4 0 010 7.5M22 21v-1a6 6 0 00-4-5.6',
  coupon: 'M3 9V6a1 1 0 011-1h16a1 1 0 011 1v3a3 3 0 000 6v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3a3 3 0 000-6zM9.5 9.5h.01M14.5 14.5h.01M15 9l-6 6',
  admins: 'M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3zM9.5 12l2 2 3.5-4',
  docs: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  finance: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  bell: 'M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 003.4 0',
  promo: 'M3 11v2a1 1 0 001 1h2l5 4V6L6 10H4a1 1 0 00-1 1zM15 8a5 5 0 010 8M18 5a9 9 0 010 14',
};

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

const NAV: { label: string; links: { to: string; label: string; icon: string; end?: boolean; perm?: Permission }[] }[] = [
  { label: 'Operations', links: [
    { to: '/', label: 'Dashboard', icon: I.dash, end: true },
    { to: '/orders', label: 'Orders', icon: I.orders },
  ] },
  { label: 'Partners', links: [
    { to: '/restaurants', label: 'Restaurants', icon: I.kitchen },
    { to: '/riders', label: 'Riders', icon: I.rider },
    { to: '/settlements', label: 'Settlements', icon: I.settle },
    { to: '/cod', label: 'COD cash', icon: I.settle },
    { to: '/rider-pay', label: 'Rider pay', icon: I.rider },
    { to: '/documents', label: 'Documents', icon: I.docs },
  ] },
  { label: 'Catalog', links: [
    { to: '/categories', label: 'Categories', icon: I.cat },
    { to: '/items', label: 'Items', icon: I.items },
  ] },
  { label: 'Customers', links: [
    { to: '/customers', label: 'Customers', icon: I.users },
    { to: '/campaigns', label: 'Campaign audience', icon: I.promo, perm: 'money' },
    { to: '/coupons', label: 'Coupons', icon: I.coupon },
    { to: '/notifications', label: 'Notifications', icon: I.bell, perm: 'money' },
  ] },
  { label: 'Finance', links: [
    { to: '/finance', label: 'Profit & loss', icon: I.finance, perm: 'money' },
  ] },
  { label: 'Settings', links: [
    { to: '/admins', label: 'Admins', icon: I.admins, perm: 'admins' },
  ] },
];

export default function Layout() {
  const { admin, logout } = useAuth();
  const can = useCan();
  const [pwOpen, setPwOpen] = useState(false);
  const groups = NAV.map((g) => ({ ...g, links: g.links.filter((l) => !l.perm || can(l.perm)) })).filter((g) => g.links.length > 0);
  const isLive = !/localhost|127\.0\.0\.1/.test(API_URL);
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <img src={logo} alt="" />
          <div><b>Fengle</b><small>Admin</small></div>
        </div>
        {groups.map((g) => (
          <div key={g.label} style={{ display: 'contents' }}>
            <div className="nav-label">{g.label}</div>
            {g.links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <Icon d={l.icon} />{l.label}
              </NavLink>
            ))}
          </div>
        ))}
        <div className="sidebar-foot">
          <div>
            <div style={{ fontWeight: 700 }}>{admin?.name || admin?.email}</div>
            <div style={{ opacity: 0.7 }}>{roleLabel(admin?.role)} · {isLive ? 'Live server' : 'Local server'}</div>
          </div>
          <button onClick={() => setPwOpen(true)}>Change password</button>
          <button onClick={logout}>Sign out</button>
        </div>
      </aside>
      <main className="main"><Outlet /></main>
      {pwOpen && <ChangePassword onClose={() => setPwOpen(false)} />}
    </div>
  );
}
