import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './auth';
import { CompanyProvider } from './company';
import { AppLayout, getNavForRole } from './components/Layout';
import { useNotifications } from './hooks';
import { enablePushNotifications } from './push';
import type { UserRole } from './types';

import { LoginScreen } from './screens/LoginScreen';
import LandingScreen from './screens/LandingScreen';
import { AdminDashboard } from './screens/OwnerDashboard';
import CustomersScreen from './screens/CustomersScreen';
import LoansScreen from './screens/LoansScreen';
import RepaymentScheduleScreen from './screens/RepaymentScheduleScreen';
import CollectionsScreen from './screens/CollectionsScreen';
import OverdueScreen from './screens/OverdueScreen';
import ChitGroupsScreen from './screens/ChitGroupsScreen';
import ReportsScreen from './screens/ReportsScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import SettingsScreen from './screens/SettingsScreen';
import UserManagementScreen from './screens/UserManagementScreen';
import AgentDashboard from './screens/AgentDashboard';
import AgentCollectionsScreen from './screens/AgentCollectionsScreen';
import AgentRouteScreen from './screens/AgentRouteScreen';
import CustomerDashboard from './screens/CustomerDashboard';
import CustomerLoansScreen from './screens/CustomerLoansScreen';
import CustomerScheduleScreen from './screens/CustomerScheduleScreen';
import CustomerPaymentsScreen from './screens/CustomerPaymentsScreen';
import ProfileScreen from './screens/ProfileScreen';
import FundsScreen from './screens/FundsScreen';

const TITLE_MAP: Record<string, string> = {
  dashboard: 'Dashboard',
  customers: 'Customer Management',
  loans: 'Loan Management',
  schedule: 'Repayment Schedule',
  collections: 'Collections',
  overdue: 'Overdue Management',
  'chit-groups': 'Chit Group Management',
  funds: 'Funds',
  'my-funds': 'My Funds',
  reports: 'Reports & Analytics',
  notifications: 'Notifications',
  settings: 'Settings',
  'user-management': 'User Management',
  agents: 'Agent Management',
  'agent-route': 'Route Map',
  'my-loans': 'My Loans',
  'my-schedule': 'Repayment Schedule',
  'my-payments': 'Payment History',
  profile: 'My Profile',
};

// Pages reachable from the profile menu / header, not the sidebar nav.
const EXTRA_PAGES = ['profile'];

function Shell() {
  const { session, profile, loading } = useAuth();
  const [page, setPage] = useState('dashboard');
  const [showLogin, setShowLogin] = useState(false);

  const { unread, refresh: refreshNotifications } = useNotifications(profile?.id);
  const role: UserRole = profile?.role ?? 'agent';

  // Reset navigation when the user signs out.
  useEffect(() => {
    if (!session && !profile) {
      setPage('dashboard');
      setShowLogin(false);
    }
  }, [session, profile]);

  useEffect(() => {
    if (profile?.id) {
      enablePushNotifications(profile.id);
    }
  }, [profile?.id]);

  const allowed = [...getNavForRole(role).map((n) => n.id), ...EXTRA_PAGES];
  const effectivePage = allowed.includes(page) ? page : 'dashboard';
  const title = TITLE_MAP[effectivePage] ?? 'Dashboard';
  const navigate = (id: string) => setPage(id);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [page]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-ink-50 gap-4">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-4 border-brand-100 border-t-brand-600 animate-spin" />
          <img
            src="/assets/rr-groups-logo.png"
            alt="RR Groups"
            className="absolute inset-[7px] w-[66px] h-[66px] rounded-full object-cover animate-pulse"
          />
        </div>
        <p className="text-sm font-medium text-ink-400">Loading…</p>
      </div>
    );
  }

  if (!session && !profile) {
    return showLogin ? (
      <LoginScreen onBack={() => setShowLogin(false)} />
    ) : (
      <LandingScreen onEnter={() => setShowLogin(true)} />
    );
  }

  const renderPage = () => {
    switch (effectivePage) {
      case 'dashboard':
        return role === 'customer' ? (
          <CustomerDashboard onNavigate={navigate} />
        ) : role === 'agent' ? (
          <AgentDashboard onNavigate={navigate} />
        ) : (
          <AdminDashboard onNavigate={navigate} />
        );
      case 'my-loans':
        return <CustomerLoansScreen />;
      case 'my-schedule':
        return <CustomerScheduleScreen />;
      case 'my-payments':
        return <CustomerPaymentsScreen />;
      case 'customers':
        return <CustomersScreen onNavigate={navigate} />;
      case 'agents':
        return <UserManagementScreen onNavigate={navigate} defaultRoleFilter="agent" />;
      case 'loans':
        return <LoansScreen onNavigate={navigate} />;
      case 'schedule':
        return <RepaymentScheduleScreen onNavigate={navigate} />;
      case 'collections':
        return role === 'agent' ? (
          <AgentCollectionsScreen onNavigate={navigate} />
        ) : (
          <CollectionsScreen onNavigate={navigate} />
        );
      case 'overdue':
        return <OverdueScreen onNavigate={navigate} />;
      case 'chit-groups':
        return <ChitGroupsScreen onNavigate={navigate} />;
      case 'funds':
      case 'my-funds':
        return <FundsScreen />;
      case 'reports':
        return <ReportsScreen onNavigate={navigate} />;
      case 'notifications':
        return <NotificationsScreen onNavigate={navigate} onChanged={refreshNotifications} />;
      case 'settings':
        return <SettingsScreen onNavigate={navigate} />;
      case 'user-management':
        return <UserManagementScreen onNavigate={navigate} />;
      case 'agent-route':
        return <AgentRouteScreen onNavigate={navigate} />;
      case 'profile':
        return <ProfileScreen />;
      default:
        return role === 'customer' ? (
          <CustomerDashboard onNavigate={navigate} />
        ) : role === 'agent' ? (
          <AgentDashboard onNavigate={navigate} />
        ) : (
          <AdminDashboard onNavigate={navigate} />
        );
    }
  };

  return (
    <AppLayout current={effectivePage} onNavigate={navigate} title={title} notificationCount={unread}>
      {renderPage()}
    </AppLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CompanyProvider>
        <Shell />
      </CompanyProvider>
    </AuthProvider>
  );
}
