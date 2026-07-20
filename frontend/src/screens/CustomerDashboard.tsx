import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Landmark, Wallet, CalendarClock, CheckCircle2, Loader2, ArrowRight,
  IndianRupee, AlertCircle, RefreshCw,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../auth';
import { StatCard, ChartCard, Pie3DChart } from '../components/charts';
import { StatusBadge, EmptyState } from '../components/ui';
import { formatCurrency, formatDate } from '../calc';
import type { Loan, Collection, RepaymentSchedule } from '../types';

export default function CustomerDashboard({ onNavigate }: { onNavigate: (id: string) => void }) {
  const { profile } = useAuth();
  const cid = profile?.customer_id ?? null;

  const [loans, setLoans] = useState<Loan[]>([]);
  const [schedule, setSchedule] = useState<RepaymentSchedule[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const activeRef = useRef(true);

  const load = useCallback(async (isRefresh = false) => {
    if (!cid) { setLoading(false); return; }
    if (isRefresh) setRefreshing(true);
    const { data: loanRows } = await supabase
      .from('loans')
      .select('*')
      .eq('customer_id', cid)
      .order('created_at', { ascending: false });
    const myLoans = (loanRows ?? []) as Loan[];

    const loanIds = myLoans.map((l) => l.id);
    const [schedRes, colRes] = await Promise.all([
      loanIds.length
        ? supabase.from('repayment_schedule').select('*').in('loan_id', loanIds).order('due_date', { ascending: true })
        : Promise.resolve({ data: [] as RepaymentSchedule[] }),
      supabase.from('collections').select('*').eq('customer_id', cid).order('collection_date', { ascending: false }),
    ]);

    if (!activeRef.current) return;
    setLoans(myLoans);
    setSchedule((schedRes.data ?? []) as RepaymentSchedule[]);
    setCollections((colRes.data ?? []) as Collection[]);
    setLoading(false);
    setRefreshing(false);
  }, [cid]);

  useEffect(() => {
    activeRef.current = true;
    load();
    const timer = setInterval(() => load(true), 30000); // keep the dashboard live
    // Refresh the moment the customer comes back to the tab/window, so the
    // charts reflect any payment an agent just recorded without waiting 30s.
    const onFocus = () => { if (document.visibilityState !== 'hidden') load(true); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      activeRef.current = false;
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-7 h-7 animate-spin text-brand-500" />
      </div>
    );
  }

  if (!cid) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="No customer record linked"
        description="Your login is not linked to a customer profile yet. Please contact the administrator."
      />
    );
  }

  // Live outstanding per loan = remaining balance across its schedule rows
  // (falls back to the stored loan balance if no schedule exists yet).
  const outstandingByLoan = new Map<string, number>();
  for (const s of schedule) {
    outstandingByLoan.set(s.loan_id, (outstandingByLoan.get(s.loan_id) ?? 0) + Number(s.balance || 0));
  }
  const loanOutstanding = (l: Loan) =>
    outstandingByLoan.has(l.id)
      ? Math.round(outstandingByLoan.get(l.id)! * 100) / 100
      : Number(l.outstanding_balance);

  const activeLoans = loans.filter((l) => l.status === 'active' || l.status === 'overdue');
  const totalOutstanding = loans.reduce((s, l) => s + loanOutstanding(l), 0);
  const totalPaid = collections.reduce((s, c) => s + Number(c.collection_amount), 0);
  const upcoming = schedule.filter((s) => s.status === 'pending' || s.status === 'partial' || s.status === 'overdue');
  const nextDue = upcoming[0];

  const statusCounts = {
    paid: schedule.filter((s) => s.status === 'paid').length,
    partial: schedule.filter((s) => s.status === 'partial').length,
    pending: schedule.filter((s) => s.status === 'pending').length,
    overdue: schedule.filter((s) => s.status === 'overdue').length,
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Customer';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-brand-700 to-ink-800 text-white p-6 sm:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          title="Refresh"
          className="absolute top-4 right-4 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors backdrop-blur-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
        <div className="relative">
          <p className="text-brand-200 text-xs font-semibold uppercase tracking-wider mb-1">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold">{greeting}, {firstName}</h2>
          {nextDue ? (
            <p className="text-brand-100 text-sm mt-2 max-w-lg">
              Your next installment of <span className="font-bold text-white">{formatCurrency(nextDue.emi_amount)}</span> is
              due on <span className="font-bold text-white">{formatDate(nextDue.due_date)}</span>.
            </p>
          ) : (
            <p className="text-brand-100 text-sm mt-2">You have no pending installments. You're all caught up! 🎉</p>
          )}
          <button
            onClick={() => onNavigate('my-loans')}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 bg-white text-brand-700 rounded-xl font-semibold text-sm hover:bg-brand-50 transition-colors shadow-lg"
          >
            View My Loans <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Loans" value={String(activeLoans.length)} icon={Landmark} tone="blue" sublabel="Currently running" />
        <StatCard label="Total Outstanding" value={formatCurrency(totalOutstanding)} icon={Wallet} tone="rose" sublabel="Balance to repay" />
        <StatCard
          label="Next EMI"
          value={nextDue ? formatCurrency(nextDue.emi_amount) : '—'}
          icon={CalendarClock}
          tone="amber"
          sublabel={nextDue ? `Due ${formatDate(nextDue.due_date)}` : 'Nothing due'}
        />
        <StatCard label="Total Paid" value={formatCurrency(totalPaid)} icon={CheckCircle2} tone="green" sublabel="Across all loans" />
      </div>

      {/* 3D breakdown pies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Repayment Progress" subtitle="Paid vs balance to repay">
          {totalPaid + totalOutstanding > 0 ? (
            <Pie3DChart
              data={[
                { label: 'Paid', value: Math.round(totalPaid), color: '#10b981' },
                { label: 'Balance', value: Math.round(totalOutstanding), color: '#a87615' },
              ]}
              centerLabel={`${Math.round((totalPaid / (totalPaid + totalOutstanding)) * 100)}%`}
              formatValue={(v) => formatCurrency(v)}
            />
          ) : (
            <p className="text-sm text-ink-400 text-center py-10">No repayment data yet.</p>
          )}
        </ChartCard>

        <ChartCard title="Installment Status" subtitle="Across your schedule">
          {schedule.length > 0 ? (
            <Pie3DChart
              data={[
                { label: 'Paid', value: statusCounts.paid, color: '#10b981' },
                { label: 'Partial', value: statusCounts.partial, color: '#0ea5e9' },
                { label: 'Pending', value: statusCounts.pending, color: '#f59e0b' },
                { label: 'Overdue', value: statusCounts.overdue, color: '#ef4444' },
              ]}
              centerLabel={String(schedule.length)}
            />
          ) : (
            <p className="text-sm text-ink-400 text-center py-10">No installments yet.</p>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* My Loans */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-ink-800">My Loans</h3>
            <button onClick={() => onNavigate('my-loans')} className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-2">
            {loans.length === 0 && <p className="text-sm text-ink-400 text-center py-6">No loans on record.</p>}
            {loans.slice(0, 4).map((l) => (
              <div key={l.id} className="flex items-center gap-3 p-3 rounded-xl border border-ink-100">
                <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                  <Landmark className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-800 truncate">{l.loan_number}</p>
                  <p className="text-xs text-ink-400">{formatCurrency(l.loan_amount)} • EMI {formatCurrency(l.emi)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-ink-900">{formatCurrency(loanOutstanding(l))}</p>
                  <StatusBadge status={l.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming installments */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-ink-800">Upcoming Installments</h3>
            <button onClick={() => onNavigate('my-schedule')} className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1">
              Full schedule <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-2">
            {upcoming.length === 0 && <p className="text-sm text-ink-400 text-center py-6">No upcoming installments.</p>}
            {upcoming.slice(0, 5).map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-ink-100">
                <div className="w-9 h-9 rounded-lg bg-ink-100 text-ink-600 flex items-center justify-center text-xs font-bold shrink-0">
                  #{s.installment_no}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-800">{formatCurrency(s.emi_amount)}</p>
                  <p className="text-xs text-ink-400">Due {formatDate(s.due_date)}</p>
                </div>
                <StatusBadge status={s.status} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent payments */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-ink-800">Recent Payments</h3>
          <button onClick={() => onNavigate('my-payments')} className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="space-y-1">
          {collections.length === 0 && <p className="text-sm text-ink-400 text-center py-6">No payments recorded yet.</p>}
          {collections.slice(0, 6).map((c) => (
            <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-ink-50/80 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <IndianRupee className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink-800 truncate">{c.receipt_number}</p>
                <p className="text-xs text-ink-400">{c.loan_number ?? '—'} • {c.payment_method?.toUpperCase()}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-emerald-600">{formatCurrency(c.collection_amount)}</p>
                <p className="text-[11px] text-ink-400">{formatDate(c.collection_date)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
