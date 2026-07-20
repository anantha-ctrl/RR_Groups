import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarClock, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../auth';
import { PageHeader, StatusBadge, EmptyState } from '../components/ui';
import { formatCurrency, formatDate } from '../calc';
import type { Loan, RepaymentSchedule } from '../types';

export default function CustomerScheduleScreen() {
  const { profile } = useAuth();
  const cid = profile?.customer_id ?? null;
  const [rows, setRows] = useState<(RepaymentSchedule & { loan_number?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const activeRef = useRef(true);

  const load = useCallback(async (isRefresh = false) => {
    if (!cid) { setLoading(false); return; }
    if (isRefresh) setRefreshing(true);
    const { data: loanRows } = await supabase.from('loans').select('*').eq('customer_id', cid);
    const loans = (loanRows ?? []) as Loan[];
    const loanMap = new Map(loans.map((l) => [l.id, l.loan_number]));
    const loanIds = loans.map((l) => l.id);
    let sched: RepaymentSchedule[] = [];
    if (loanIds.length) {
      const { data } = await supabase
        .from('repayment_schedule')
        .select('*')
        .in('loan_id', loanIds)
        .order('due_date', { ascending: true });
      sched = (data ?? []) as RepaymentSchedule[];
    }
    if (!activeRef.current) return;
    setRows(sched.map((s) => ({ ...s, loan_number: loanMap.get(s.loan_id) })));
    setLoading(false);
    setRefreshing(false);
  }, [cid]);

  useEffect(() => {
    activeRef.current = true;
    load();
    const timer = setInterval(() => load(true), 30000); // keep paid/balance live
    return () => { activeRef.current = false; clearInterval(timer); };
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Repayment Schedule"
        subtitle="All your installments across every loan"
        actions={
          <button className="btn-secondary" onClick={() => load(true)} disabled={refreshing} title="Refresh">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        }
      />
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
        ) : rows.length === 0 ? (
          <EmptyState icon={CalendarClock} title="No installments" description="You have no repayment schedule yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/50">
                  {['Loan', '#', 'Due Date', 'EMI', 'Paid', 'Balance', 'Status'].map((h) => (
                    <th key={h} className="table-head text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-ink-50 hover:bg-ink-50/40">
                    <td className="table-cell font-medium text-ink-900">{r.loan_number ?? '—'}</td>
                    <td className="table-cell text-ink-600">{r.installment_no}</td>
                    <td className="table-cell text-ink-700">{formatDate(r.due_date)}</td>
                    <td className="table-cell font-medium text-ink-900">{formatCurrency(r.emi_amount)}</td>
                    <td className="table-cell text-emerald-700">{formatCurrency(r.paid_amount)}</td>
                    <td className="table-cell text-ink-700">{formatCurrency(r.balance)}</td>
                    <td className="table-cell"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
