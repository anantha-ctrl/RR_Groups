import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  LayoutDashboard,
  Users,
  Landmark,
  CalendarClock,
  Wallet,
  AlertCircle,
  Group,
  Map,
  FileBarChart,
  Bell,
  Settings,
  UserCog,
  Shield,
  PiggyBank,
  LogOut,
  Menu,
  Search,
  ChevronDown,
  X,
  UserCircle,
} from 'lucide-react';
import { useAuth } from '../auth';
import { useCompany } from '../company';
import { Avatar } from './ui';
import type { UserRole } from '../types';

export interface NavItem {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: UserRole[];
  group: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'agent', 'customer'], group: 'Overview' },
  { id: 'customers', label: 'Customers', icon: Users, roles: ['admin', 'agent'], group: 'Manage' },
  { id: 'agents', label: 'Agents', icon: Shield, roles: ['admin'], group: 'Manage' },
  { id: 'loans', label: 'Loans', icon: Landmark, roles: ['admin', 'agent'], group: 'Manage' },
  { id: 'schedule', label: 'Repayment Schedule', icon: CalendarClock, roles: ['admin', 'agent'], group: 'Manage' },
  { id: 'collections', label: 'Collections', icon: Wallet, roles: ['admin', 'agent'], group: 'Manage' },
  { id: 'overdue', label: 'Overdue', icon: AlertCircle, roles: ['admin', 'agent'], group: 'Manage' },
  { id: 'chit-groups', label: 'Chit Groups', icon: Group, roles: ['admin'], group: 'Manage' },
  { id: 'funds', label: 'Funds', icon: PiggyBank, roles: ['admin', 'agent'], group: 'Manage' },
  { id: 'agent-route', label: 'Route Map', icon: Map, roles: ['agent'], group: 'Agent' },
  // Customer self-service
  { id: 'my-loans', label: 'My Loans', icon: Landmark, roles: ['customer'], group: 'My Account' },
  { id: 'my-schedule', label: 'Repayment Schedule', icon: CalendarClock, roles: ['customer'], group: 'My Account' },
  { id: 'my-payments', label: 'Payment History', icon: Wallet, roles: ['customer'], group: 'My Account' },
  { id: 'my-funds', label: 'My Funds', icon: PiggyBank, roles: ['customer'], group: 'My Account' },
  { id: 'reports', label: 'Reports', icon: FileBarChart, roles: ['admin'], group: 'Insights' },
  { id: 'notifications', label: 'Notifications', icon: Bell, roles: ['admin', 'agent', 'customer'], group: 'Insights' },
  { id: 'user-management', label: 'User Management', icon: UserCog, roles: ['admin'], group: 'System' },
  { id: 'settings', label: 'Settings', icon: Settings, roles: ['admin'], group: 'System' },
];

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Admin',
  agent: 'Collection Agent',
  customer: 'Customer',
};

export function getNavForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((n) => n.roles.includes(role));
}

function SidebarSection({ label }: { label: string }) {
  return (
    <p className="px-3 pt-5 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-ink-500 flex items-center gap-1.5">
      <span className="w-1 h-1 rounded-full bg-brand-400" />
      {label}
    </p>
  );
}

interface LayoutProps {
  current: string;
  onNavigate: (id: string) => void;
  children: ReactNode;
  title: string;
  notificationCount: number;
}

export function AppLayout({ current, onNavigate, children, title, notificationCount }: LayoutProps) {
  const { profile, signOut } = useAuth();
  const company = useCompany();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const role = profile?.role ?? 'agent';
  const items = getNavForRole(role);

  // Close the profile dropdown on outside-click or Escape.
  useEffect(() => {
    if (!userMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setUserMenuOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [userMenuOpen]);

  const groups: { [key: string]: NavItem[] } = {};
  items.forEach((it) => {
    groups[it.group] = groups[it.group] || [];
    groups[it.group].push(it);
  });

  const SidebarContent = (
    <>
      <div className="px-6 py-6 flex items-center gap-3">
        <div className="relative w-11 h-11 shrink-0">
          <div className="absolute inset-0 rounded-full bg-brand-300 blur-md opacity-60" />
          <img
            src={company.logoUrl}
            alt={company.name}
            className="relative w-11 h-11 rounded-full object-cover ring-2 ring-brand-300 shadow-md"
          />
        </div>
        <div className="min-w-0">
          <p className="font-extrabold text-ink-900 text-base leading-none tracking-tight truncate">{company.name}</p>
          <p className="text-[10px] text-ink-400 mt-1.5 uppercase tracking-[0.15em]">Loan &amp; Collection</p>
        </div>
      </div>

      <nav className="flex-1 px-3 pb-4 overflow-y-auto no-scrollbar">
        {Object.entries(groups).map(([groupName, navItems]) => (
          <div key={groupName}>
            <SidebarSection label={groupName} />
            {navItems.map((item) => {
              const active = current === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    setMobileOpen(false);
                  }}
                  className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 mb-1 ${
                    active
                      ? 'bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-md shadow-brand-200'
                      : 'text-ink-500 hover:bg-brand-50 hover:text-ink-900'
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-brand-200" />
                  )}
                  <Icon
                    className={`w-[18px] h-[18px] shrink-0 transition-transform duration-200 ${
                      active ? '' : 'group-hover:scale-110 group-hover:text-brand-600'
                    }`}
                    strokeWidth={2.2}
                  />
                  <span className="flex-1 text-left truncate">{item.label}</span>
                  {item.id === 'notifications' && notificationCount > 0 && (
                    <span className="bg-rose-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                      {notificationCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-ink-100">
        <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-ink-50">
          <Avatar name={profile?.full_name ?? 'User'} src={profile?.avatar_url} size={38} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink-900 truncate">{profile?.full_name}</p>
            <p className="text-xs text-ink-400">{ROLE_LABEL[role]}</p>
          </div>
          <button
            onClick={() => {
              signOut();
            }}
            className="w-9 h-9 rounded-xl hover:bg-rose-50 text-ink-400 hover:text-rose-500 flex items-center justify-center transition-colors shrink-0"
            title="Sign out"
          >
            <LogOut className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>
    </>
  );

  // Bottom nav: the four most-used destinations for this role + a "More" button
  // that opens the full sidebar drawer (so every page stays reachable on mobile).
  const bottomItems = items.slice(0, 4);

  const MobileBottomNav = (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur border-t border-ink-200 px-1.5 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] flex items-stretch justify-around shadow-[0_-4px_20px_rgba(15,23,42,0.06)]">
      {bottomItems.map((item) => {
        const active = current === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className="relative flex-1 flex flex-col items-center gap-1 py-1 rounded-xl transition-colors"
          >
            <span
              className={`flex items-center justify-center w-11 h-7 rounded-full transition-all duration-200 ${
                active ? 'bg-brand-50 text-brand-600' : 'text-ink-400'
              }`}
            >
              <Icon className="w-[19px] h-[19px]" strokeWidth={2.2} />
            </span>
            <span
              className={`text-[10px] font-semibold leading-none truncate max-w-[64px] ${
                active ? 'text-brand-600' : 'text-ink-400'
              }`}
            >
              {item.label.split(' ')[0]}
            </span>
          </button>
        );
      })}

      {/* More — opens the full menu drawer */}
      <button
        onClick={() => setMobileOpen(true)}
        className="relative flex-1 flex flex-col items-center gap-1 py-1 rounded-xl transition-colors"
      >
        <span className="relative flex items-center justify-center w-11 h-7 rounded-full text-ink-400">
          <Menu className="w-[19px] h-[19px]" strokeWidth={2.2} />
          {notificationCount > 0 && (
            <span className="absolute top-0 right-2 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
          )}
        </span>
        <span className="text-[10px] font-semibold leading-none text-ink-400">More</span>
      </button>
    </nav>
  );

  return (
    <div className="min-h-screen bg-ink-50 flex">
      {/* Desktop Sidebar — left side, white floating panel */}
      <aside className="hidden lg:flex w-72 flex-col fixed inset-y-0 left-0 z-30 bg-white border-r border-ink-100 shadow-[24px_0_60px_-28px_rgba(15,23,42,0.18)]">
        {SidebarContent}
      </aside>

      {/* Mobile Drawer — slides in from the left */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 inset-y-0 w-72 bg-white flex flex-col animate-slide-in-right">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 w-9 h-9 rounded-xl hover:bg-ink-100 flex items-center justify-center z-10"
            >
              <X className="w-5 h-5 text-ink-500" />
            </button>
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 lg:ml-72 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-20 bg-white/85 backdrop-blur-lg border-b border-ink-200">
          <div className="relative flex items-center justify-between px-4 lg:px-6 h-16">
            {/* Left — menu + brand logo (mobile), page title (desktop) */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMobileOpen(true)}
                className="lg:hidden w-10 h-10 rounded-xl hover:bg-ink-100 flex items-center justify-center"
              >
                <Menu className="w-5 h-5 text-ink-600" />
              </button>
              <button
                onClick={() => onNavigate('dashboard')}
                className="lg:hidden flex items-center justify-center"
                aria-label={company.name}
              >
                <img
                  src={company.logoUrl}
                  alt={company.name}
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-brand-200 shadow-sm"
                />
              </button>
              <h2 className="hidden lg:block text-base font-bold text-ink-900 truncate">{title}</h2>
            </div>

            {/* Right — search, notifications, profile */}
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="hidden md:flex items-center bg-ink-100 rounded-xl px-3 py-2 w-56">
                <Search className="w-4 h-4 text-ink-400 mr-2" />
                <input
                  placeholder="Search..."
                  className="bg-transparent text-sm outline-none flex-1 placeholder-ink-400"
                />
              </div>
              <button
                onClick={() => setMobileSearchOpen((v) => !v)}
                className={`md:hidden w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                  mobileSearchOpen ? 'bg-brand-50 text-brand-600' : 'hover:bg-ink-100 text-ink-500'
                }`}
                aria-label="Search"
              >
                <Search className="w-5 h-5" />
              </button>
              <button
                onClick={() => onNavigate('notifications')}
                className="relative w-10 h-10 rounded-xl hover:bg-ink-100 flex items-center justify-center text-ink-500 transition-colors"
              >
                <Bell className="w-5 h-5" />
                {notificationCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 bg-rose-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
                    {notificationCount}
                  </span>
                )}
              </button>
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-ink-100 transition-colors"
                >
                  <Avatar name={profile?.full_name ?? 'User'} src={profile?.avatar_url} size={36} />
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-semibold text-ink-800 leading-tight">{profile?.full_name}</p>
                    <p className="text-[10px] text-ink-400">{ROLE_LABEL[role]}</p>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-ink-400 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-white border border-ink-200 shadow-xl shadow-ink-900/10 py-2 z-50 animate-scale-in origin-top-right">
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-ink-100">
                      <Avatar name={profile?.full_name ?? 'User'} src={profile?.avatar_url} size={42} />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-ink-900 truncate">{profile?.full_name}</p>
                        <p className="text-xs text-ink-400 truncate">{profile?.email ?? profile?.mobile ?? ''}</p>
                        <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide bg-brand-50 text-brand-700 rounded-full px-2 py-0.5">
                          {ROLE_LABEL[role]}
                        </span>
                      </div>
                    </div>

                    <div className="py-1.5">
                      <button
                        onClick={() => {
                          onNavigate('profile');
                          setUserMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-ink-600 hover:bg-ink-50 hover:text-ink-900 transition-colors"
                      >
                        <UserCircle className="w-[18px] h-[18px]" />
                        <span className="flex-1 text-left">My Profile</span>
                      </button>
                      <button
                        onClick={() => {
                          onNavigate('notifications');
                          setUserMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-ink-600 hover:bg-ink-50 hover:text-ink-900 transition-colors"
                      >
                        <Bell className="w-[18px] h-[18px]" />
                        <span className="flex-1 text-left">Notifications</span>
                        {notificationCount > 0 && (
                          <span className="bg-rose-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                            {notificationCount}
                          </span>
                        )}
                      </button>
                      {role === 'admin' && (
                        <button
                          onClick={() => {
                            onNavigate('settings');
                            setUserMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-ink-600 hover:bg-ink-50 hover:text-ink-900 transition-colors"
                        >
                          <Settings className="w-[18px] h-[18px]" />
                          <span className="flex-1 text-left">Settings</span>
                        </button>
                      )}
                    </div>

                    <div className="border-t border-ink-100 pt-1.5">
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          signOut();
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <LogOut className="w-[18px] h-[18px]" />
                        <span className="flex-1 text-left">Sign out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile collapsible search */}
          {mobileSearchOpen && (
            <div className="md:hidden px-4 pb-3 animate-scale-in origin-top">
              <div className="flex items-center bg-ink-100 rounded-xl px-3 py-2.5">
                <Search className="w-4 h-4 text-ink-400 mr-2 shrink-0" />
                <input
                  autoFocus
                  placeholder="Search..."
                  className="bg-transparent text-sm outline-none flex-1 placeholder-ink-400"
                />
              </div>
            </div>
          )}
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-8 animate-fade-in">{children}</main>

        {/* Mobile Bottom Nav */}
        {MobileBottomNav}
      </div>
    </div>
  );
}
