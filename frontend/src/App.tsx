import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import OrdersPage from './pages/OrdersPage';
import RoutesPage from './pages/RoutesPage';
import DriverPage from './pages/DriverPage';

type Page = 'dashboard' | 'orders' | 'routes' | 'drivers';

function AppShell() {
  const { isLoggedIn, user, logout } = useAuth();
  const isDriver = user?.role === 'DRIVER';
  const [page, setPage] = useState<Page>(isDriver ? 'drivers' : 'dashboard');

  if (!isLoggedIn) return <LoginPage />;

  const staffNav = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: '📊' },
    { id: 'orders' as const,    label: 'Orders',    icon: '📦' },
    { id: 'routes' as const,    label: 'Routes',    icon: '🗺️' },
    { id: 'drivers' as const,   label: 'Drivers',   icon: '🚚' },
  ];

  const driverNav = [
    { id: 'drivers' as const, label: 'My Routes', icon: '🚚' },
  ];

  const nav = isDriver ? driverNav : staffNav;
  const activePage = isDriver ? 'drivers' : page;

  const roleColor =
    user?.role === 'ADMIN'
      ? 'linear-gradient(135deg,#6366f1,#8b5cf6)'
      : user?.role === 'DRIVER'
        ? 'linear-gradient(135deg,#059669,#047857)'
        : 'linear-gradient(135deg,#0ea5e9,#0284c7)';

  const initials = user?.email.slice(0, 2).toUpperCase() ?? '??';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>SmartRoute</h1>
          <span>Route Optimization</span>
        </div>

        <nav className="sidebar-nav">
          {nav.map(n => (
            <button
              key={n.id}
              className={`nav-item ${activePage === n.id ? 'active' : ''}`}
              onClick={() => setPage(n.id)}
            >
              <span className="nav-icon">{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar">{initials}</div>
            <div className="user-info">
              <div style={{ marginBottom: 2 }}>
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: roleColor,
                  color: '#fff',
                }}>
                  {user?.role ?? 'USER'}
                </span>
              </div>
              <div className="user-email">{user?.email}</div>
            </div>
            <button className="logout-btn" onClick={logout} title="Sign out">↩</button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        {isDriver ? (
          <DriverPage />
        ) : (
          <>
            {page === 'dashboard' && <DashboardPage onNavigate={setPage} />}
            {page === 'orders'    && <OrdersPage />}
            {page === 'routes'    && <RoutesPage />}
            {page === 'drivers'   && <DriverPage />}
          </>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
