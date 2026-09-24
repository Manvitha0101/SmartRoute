import { useAuth } from '../context/AuthContext';
import AdminDashboard from './AdminDashboard';
import DispatcherDashboard from './DispatcherDashboard';

interface DashboardPageProps {
  onNavigate?: (page: 'dashboard' | 'orders' | 'routes' | 'drivers') => void;
}

/**
 * DashboardPage — Role-aware dashboard router.
 * ADMIN      → AdminDashboard (executive KPIs, warehouse leaderboard, analytics)
 * DISPATCHER → DispatcherDashboard (live routes, pending queue, driver availability)
 */
export default function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { user } = useAuth();

  if (user?.role === 'ADMIN') {
    return <AdminDashboard onNavigate={onNavigate} />;
  }

  // Default to dispatcher view (DISPATCHER role or unknown)
  return <DispatcherDashboard onNavigate={onNavigate} />;
}
