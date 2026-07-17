import { useCallback, useEffect, useState } from 'react';
import {
  Landmark,
  Users,
  AlertTriangle,
  Clock,
  TrendingUp,
  CalendarDays,
  UserPlus,
  FileBarChart,
  Users2,
  UserCog,
  ArrowRight,
  Loader2,
  CircleDollarSign,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  CreditCard,
  RefreshCw,
  Trophy,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../auth';
import { StatCard, ChartCard, TrendChart, DonutChart } from '../components/charts';
import { formatCurrency, formatDate } from '../calc';
import type { Loan, Customer, Collection, Profile } from '../types';

interface DashData {
  activeLoans: number;
  totalCustomers: number;
  todayCollections: number;
  overdueAccounts: number;
  pendingApprovals: number;
  totalLoanAmount: number;
  totalInterestRevenue: number;
  monthlyCollection: number;
  monthlyTarget: number;
  collectionProgress: number;
  recentCollections: (Collection & { loans?: Loan })[];
  recentLoans: Loan[];
  agents: Profile[];
  trendData: { label: string; value: number }[];
  branchData: { label: string; value: number; color: string }[];
  loanStatusData: { label: string; value: number; color: string }[];
}

export function AdminDashboard({ onNavigate }: { onNavigate: (id: string) => void }) {
  const { profile } = useAuth();
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    {
      try {
        const [loansRes, customersRes, collectionsRes, agentsRes] = await Promise.all([
          supabase.from('loans').select('*'),
          supabase.from('customers').select('*'),
          supabase.from('collections').select('*, loans(*)').order('created_at', { ascending: false }),
          supabase.from('profiles').select('*').eq('role', 'agent'),
        ]);

        if (loansRes.error || customersRes.error || collectionsRes.error || agentsRes.error) {
          setError('Some data could not be loaded. Displaying available data.');
        }

        const loans = (loansRes.data ?? []) as Loan[];
        const customers = (customersRes.data ?? []) as Customer[];
        const collections = (collectionsRes.data ?? []) as (Collection & { loans?: Loan })[];
        const agents = (agentsRes.data ?? []) as Profile[];

        const today = new Date().toISOString().slice(0, 10);
        const thisMonth = new Date().toISOString().slice(0, 7);

        const activeLoans = loans.filter((l) => l.status === 'active').length;
        const overdueAccounts = loans.filter((l) => l.status === 'overdue').length;
        const pendingApprovals = loans.filter((l) => l.status === 'pending').length;
        const todayCollections = collections
          .filter((c) => c.collection_date === today || c.collection_date?.slice(0, 10) === today)
          .reduce((s, c) => s + Number(c.collection_amount), 0);
        const totalLoanAmount = loans.reduce((s, l) => s + Number(l.loan_amount), 0);
        const totalInterestRevenue = loans.reduce((s, l) => s + Number(l.total_interest), 0);
        const monthlyCollection = collections
          .filter((c) => (c.collection_date ?? '').slice(0, 7) === thisMonth)
          .reduce((s, c) => s + Number(c.collection_amount), 0);
        const monthlyTarget = totalLoanAmount * 0.08;
        const collectionProgress = monthlyTarget > 0 ? Math.min((monthlyCollection / monthlyTarget) * 100, 100) : 0;

        const recentCollections = collections.slice(0, 6);
        const recentLoans = loans
          .slice()
          .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
          .slice(0, 5);

        // Last 6 months trend
        const trendData: { label: string; value: number }[] = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          const key = d.toISOString().slice(0, 7);
          const label = d.toLocaleString('en-IN', { month: 'short' });
          const value = collections
            .filter((c) => (c.collection_date ?? '').slice(0, 7) === key)
            .reduce((s, c) => s + Number(c.collection_amount), 0);
          trendData.push({ label, value });
        }

        // Agent performance data
        const branchData = agents.map((a, i) => {
          const agentCollections = collections.filter((c) => c.agent_id === a.id);
          const value = agentCollections.reduce((s, c) => s + Number(c.collection_amount), 0);
          const colors = ['#a87615', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316'];
          return { label: a.full_name.split(' ')[0], value, color: colors[i % colors.length] };
        });

        const loanStatusData = [
          { label: 'Active', value: activeLoans, color: '#10b981' },
          { label: 'Overdue', value: overdueAccounts, color: '#ef4444' },
          { label: 'Pending', value: pendingApprovals, color: '#f59e0b' },
          { label: 'Closed', value: loans.filter((l) => l.status === 'closed').length, color: '#94a3b8' },
        ];

        setData({
          activeLoans,
          totalCustomers: customers.length,
          todayCollections,
          overdueAccounts,
          pendingApprovals,
          totalLoanAmount,
          totalInterestRevenue,
          monthlyCollection,
          monthlyTarget,
          collectionProgress,
          recentCollections,
          recentLoans,
          agents,
          trendData,
          branchData,
          loanStatusData,
        });
        setLastUpdated(new Date());
      } catch (e) {
        console.error('Dashboard data load failed:', e);
        setError('Failed to load dashboard data. Please refresh the page.');
        // Set default empty data so the dashboard doesn't stay stuck
        setData({
          activeLoans: 0,
          totalCustomers: 0,
          todayCollections: 0,
          overdueAccounts: 0,
          pendingApprovals: 0,
          totalLoanAmount: 0,
          totalInterestRevenue: 0,
          monthlyCollection: 0,
          monthlyTarget: 0,
          collectionProgress: 0,
          recentCollections: [],
          recentLoans: [],
          agents: [],
          trendData: [],
          branchData: [],
          loanStatusData: [
            { label: 'Active', value: 0, color: '#10b981' },
            { label: 'Overdue', value: 0, color: '#ef4444' },
            { label: 'Pending', value: 0, color: '#f59e0b' },
            { label: 'Closed', value: 0, color: '#94a3b8' },
          ],
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    loadData();
    // Keep the dashboard live — refresh figures every 60s.
    const timer = setInterval(() => loadData(true), 60000);
    return () => clearInterval(timer);
  }, [loadData]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Admin';

  const kpiCards = [
    {
      label: 'Active Loans',
      value: String(data.activeLoans),
      icon: Landmark,
      tone: 'blue' as const,
      sublabel: 'Total loans active',
    },
    {
      label: 'Total Customers',
      value: String(data.totalCustomers),
      icon: Users,
      tone: 'cyan' as const,
      sublabel: 'Registered customers',
    },
    {
      label: "Today's Collections",
      value: formatCurrency(data.todayCollections),
      icon: CircleDollarSign,
      tone: 'green' as const,
      sublabel: 'Amount collected today',
    },
    {
      label: 'Overdue Accounts',
      value: String(data.overdueAccounts),
      icon: AlertTriangle,
      tone: 'rose' as const,
      sublabel: 'Requires attention',
    },
  ];

  const secondaryKpis = [
    {
      label: 'Pending Approvals',
      value: String(data.pendingApprovals),
      icon: Clock,
      tone: 'amber' as const,
    },
    {
      label: 'Total Loan Amount',
      value: formatCurrency(data.totalLoanAmount),
      icon: CreditCard,
      tone: 'violet' as const,
    },
    {
      label: 'Interest Revenue',
      value: formatCurrency(data.totalInterestRevenue),
      icon: TrendingUp,
      tone: 'green' as const,
    },
    {
      label: 'Monthly Collection',
      value: formatCurrency(data.monthlyCollection),
      icon: CalendarDays,
      tone: 'blue' as const,
    },
  ];

  const quickActions = [
    { label: 'Add Customer', icon: UserPlus, view: 'customers', color: 'bg-brand-50 text-brand-600 border-brand-100' },
    { label: 'Create Loan', icon: Landmark, view: 'loans', color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    { label: 'Chit Group', icon: Users2, view: 'chit-groups', color: 'bg-amber-50 text-amber-600 border-amber-100' },
    { label: 'Manage Agents', icon: UserCog, view: 'user-management', color: 'bg-violet-50 text-violet-600 border-violet-100' },
    { label: 'Reports', icon: FileBarChart, view: 'reports', color: 'bg-cyan-50 text-cyan-600 border-cyan-100' },
  ];

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-brand-700 to-ink-800 text-white p-6 sm:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />

        {/* Live refresh */}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
          {lastUpdated && (
            <span className="hidden sm:inline text-[11px] text-brand-100/80">
              Updated {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur transition-colors disabled:opacity-60"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        <div className="relative">
          <p className="text-brand-200 text-xs font-semibold uppercase tracking-wider mb-1">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold">
            {greeting}, {firstName}
          </h2>
          <p className="text-brand-100 text-sm mt-2 max-w-lg">
            You have <span className="font-bold text-white">{data.pendingApprovals} pending approvals</span> and{' '}
            <span className="font-bold text-white">{data.overdueAccounts} overdue accounts</span> requiring your attention.
          </p>
          <div className="flex items-center gap-3 mt-5">
            <button
              onClick={() => onNavigate('loans')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-brand-700 rounded-xl font-semibold text-sm hover:bg-brand-50 transition-colors shadow-lg"
            >
              View Approvals <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onNavigate('overdue')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 text-white rounded-xl font-semibold text-sm hover:bg-white/20 transition-colors backdrop-blur"
            >
              Review Overdue
            </button>
          </div>
        </div>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {secondaryKpis.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <ChartCard title="Collection Trend" subtitle="Last 6 months" className="lg:col-span-2">
          <TrendChart data={data.trendData} color="#a87615" />
        </ChartCard>
        <ChartCard title="Loan Status" subtitle="Active vs Overdue vs Pending">
          <DonutChart data={data.loanStatusData} size={170} />
        </ChartCard>
      </div>

      {/* Agent Performance */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Trophy className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink-800">Agent Performance</h3>
              <p className="text-xs text-ink-400">Total collections by agent</p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('user-management')}
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
          >
            Manage agents <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        {(() => {
          const ranked = [...data.branchData].sort((a, b) => b.value - a.value);
          const max = Math.max(1, ...ranked.map((a) => a.value));
          if (ranked.length === 0 || max === 1) {
            return (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-xl bg-ink-100 flex items-center justify-center mx-auto mb-3">
                  <Users2 className="w-5 h-5 text-ink-400" />
                </div>
                <p className="text-sm text-ink-400">No agent collections recorded yet</p>
              </div>
            );
          }
          return (
            <div className="space-y-3.5">
              {ranked.map((a, idx) => (
                <div key={a.label} className="flex items-center gap-3">
                  <span className="w-6 text-xs font-bold text-ink-400 text-center shrink-0">#{idx + 1}</span>
                  <span className="w-20 sm:w-28 text-sm font-semibold text-ink-700 truncate shrink-0">{a.label}</span>
                  <div className="flex-1 h-2.5 bg-ink-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${(a.value / max) * 100}%`, background: a.color }}
                    />
                  </div>
                  <span className="w-20 sm:w-24 text-right text-sm font-bold text-ink-800 shrink-0 tabular-nums">
                    {formatCurrency(a.value)}
                  </span>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Monthly Progress */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-ink-800">Monthly Collection Progress</h3>
            <p className="text-xs text-ink-400 mt-0.5">
              {formatCurrency(data.monthlyCollection)} of {formatCurrency(data.monthlyTarget)} target
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold">
            <Activity className="w-3.5 h-3.5" />
            {data.collectionProgress.toFixed(1)}%
          </div>
        </div>
        <div className="w-full h-3 bg-ink-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-1000"
            style={{ width: `${data.collectionProgress}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-3 text-xs text-ink-400">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-6">
        <h3 className="text-sm font-bold text-ink-800 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={() => onNavigate(action.view)}
                className="flex flex-col items-center gap-3 p-4 rounded-xl border border-ink-200 hover:border-brand-300 hover:shadow-md transition-all group bg-white"
              >
                <div className={`w-12 h-12 rounded-xl ${action.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <Icon className="w-5 h-5" strokeWidth={2.3} />
                </div>
                <span className="text-xs font-semibold text-ink-700">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Collections */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Receipt className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink-800">Recent Collections</h3>
                <p className="text-xs text-ink-400">Last payments received</p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('collections')}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1">
            {data.recentCollections.length === 0 && (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-xl bg-ink-100 flex items-center justify-center mx-auto mb-3">
                  <Receipt className="w-5 h-5 text-ink-400" />
                </div>
                <p className="text-sm text-ink-400">No collections yet</p>
              </div>
            )}
            {data.recentCollections.map((c, idx) => (
              <div
                key={c.id}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-ink-50/80 transition-colors group"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${idx % 2 === 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-brand-50 text-brand-600'}`}>
                  <ArrowUpRight className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-800 truncate">{c.customer_name ?? 'Unknown'}</p>
                  <p className="text-xs text-ink-400 mt-0.5">
                    {c.loan_number ?? '—'} • {c.payment_method.toUpperCase()}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-emerald-600">{formatCurrency(Number(c.collection_amount))}</p>
                  <p className="text-[11px] text-ink-400">{formatDate(c.collection_date)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Loans */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                <Landmark className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink-800">Recent Loans</h3>
                <p className="text-xs text-ink-400">Newly created loans</p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('loans')}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1">
            {data.recentLoans.map((l, idx) => (
              <div
                key={l.id}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-ink-50/80 transition-colors group"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${idx % 2 === 0 ? 'bg-brand-50 text-brand-600' : 'bg-cyan-50 text-cyan-600'}`}>
                  <ArrowDownRight className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-800 truncate">{l.customer_name ?? 'Unknown'}</p>
                  <p className="text-xs text-ink-400 mt-0.5">
                    {l.loan_number ?? '—'} • {l.loan_duration} months
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-ink-800">{formatCurrency(Number(l.loan_amount))}</p>
                  <p className={`text-[11px] capitalize font-medium ${
                    l.status === 'active' ? 'text-emerald-600' :
                    l.status === 'overdue' ? 'text-rose-600' :
                    l.status === 'pending' ? 'text-amber-600' :
                    'text-ink-400'
                  }`}>{l.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
