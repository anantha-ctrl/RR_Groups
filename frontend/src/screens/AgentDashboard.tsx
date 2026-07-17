import { useEffect, useState } from 'react';
import {
  Users,
  Clock,
  CheckCircle2,
  Wallet,
  MapPin,
  Navigation,
  ArrowRight,
  Loader2,
  IndianRupee,
  Sparkles,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../auth';
import { StatCard } from '../components/charts';
import { PageHeader, StatusBadge, Avatar } from '../components/ui';
import { formatCurrency, formatDate } from '../calc';
import type { Loan, Collection } from '../types';

interface DashData {
  loans: Loan[];
  todaysCollections: Collection[];
}

export default function AgentDashboard({ onNavigate }: { onNavigate: (id: string) => void }) {
  const { profile } = useAuth();
  const [data, setData] = useState<DashData>({ loans: [], todaysCollections: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    let active = true;
    (async () => {
      setLoading(true);
      const today = new Date().toISOString().slice(0, 10);
      const [loansRes, colRes] = await Promise.all([
        supabase
          .from('loans')
          .select('*')
          .eq('assigned_agent', profile.id)
          .in('status', ['active', 'overdue'])
          .order('created_at', { ascending: false }),
        supabase
          .from('collections')
          .select('*')
          .eq('agent_id', profile.id)
          .eq('collection_date', today),
      ]);
      if (!active) return;
      setData({ loans: loansRes.data ?? [], todaysCollections: colRes.data ?? [] });
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [profile?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-7 h-7 animate-spin text-brand-500" />
      </div>
    );
  }

  const loans = data.loans;
  const todayCollections = data.todaysCollections;
  const pendingCount = loans.length - todayCollections.length;
  const completedCount = todayCollections.length;
  const collectedAmount = todayCollections.reduce((s, c) => s + (c.collection_amount ?? 0), 0);
  const topCustomers = loans.slice(0, 5);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const today = formatDate(new Date());

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title={`${greeting}, ${profile?.full_name?.split(' ')[0] ?? 'Agent'}`}
        subtitle={today}
        actions={
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" /> On Field
          </div>
        }
      />

      <div className="flex items-center gap-3 sm:hidden">
        <Avatar name={profile?.full_name ?? 'A'} size={44} />
        <div>
          <p className="text-sm font-bold text-ink-900">{profile?.full_name}</p>
          <p className="text-xs text-ink-500">Field Collection Agent</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Today's Customers"
          value={String(loans.length)}
          icon={Users}
          tone="blue"
          sublabel="assigned visits"
        />
        <StatCard
          label="Pending"
          value={String(Math.max(0, pendingCount))}
          icon={Clock}
          tone="amber"
          sublabel="awaiting collection"
        />
        <StatCard
          label="Completed"
          value={String(completedCount)}
          icon={CheckCircle2}
          tone="green"
          sublabel="collected today"
        />
        <StatCard
          label="Collected"
          value={formatCurrency(collectedAmount)}
          icon={Wallet}
          tone="violet"
          sublabel="today's total"
        />
      </div>

      <div className="card p-5 animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink-900">Today's Route</h3>
              <p className="text-xs text-ink-400">{topCustomers.length} stops scheduled</p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('agent-route')}
            className="btn-ghost text-xs font-semibold text-brand-600 flex items-center gap-1 px-2 py-1.5"
          >
            View map <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-2">
          {topCustomers.length === 0 && (
            <p className="text-sm text-ink-400 text-center py-6">No customers assigned today.</p>
          )}
          {topCustomers.map((loan, idx) => {
            const collected = todayCollections
              .filter((c) => c.loan_id === loan.id)
              .reduce((s, c) => s + (c.collection_amount ?? 0), 0);
            const done = collected >= (loan.emi ?? 0) && loan.emi > 0;
            return (
              <div
                key={loan.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-ink-100 hover:border-brand-200 hover:shadow-sm transition-all"
              >
                <div className="w-8 h-8 rounded-lg bg-ink-100 text-ink-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-900 truncate">
                    {loan.customer_name ?? 'Unknown'}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-ink-500">
                    <span className="truncate">{loan.loan_number}</span>
                    <span className="text-ink-300">•</span>
                    <span className="font-semibold text-ink-700">
                      {formatCurrency(loan.emi || loan.outstanding_balance)}
                    </span>
                  </div>
                </div>
                <StatusBadge status={done ? 'paid' : loan.status} />
                <button
                  onClick={() => onNavigate('collections')}
                  className="btn-primary text-xs font-semibold px-3 py-2 rounded-lg flex-shrink-0"
                >
                  Collect
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onNavigate('agent-route')}
          className="card p-4 flex flex-col items-start gap-3 hover:shadow-card-hover transition-all active:scale-[0.98]"
        >
          <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <MapPin className="w-5 h-5" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-ink-900">View Route</p>
            <p className="text-xs text-ink-500">Open map & stops</p>
          </div>
        </button>
        <button
          onClick={() => onNavigate('collections')}
          className="card p-4 flex flex-col items-start gap-3 hover:shadow-card-hover transition-all active:scale-[0.98]"
        >
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <IndianRupee className="w-5 h-5" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-ink-900">Start Collection</p>
            <p className="text-xs text-ink-500">Log a payment</p>
          </div>
        </button>
      </div>
    </div>
  );
}
