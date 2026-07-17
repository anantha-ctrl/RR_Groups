import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { Loan, Customer } from '../types';
import { formatCurrency, formatDate, daysBetween } from '../calc';
import { PageHeader, StatusBadge, Badge, EmptyState, Avatar, Modal, Field, TextArea, Select } from '../components/ui';
import { useAgents } from '../hooks';
import { AlertCircle, Phone, MessageSquare, UserCheck, Search, Loader2, PhoneCall, Bell } from 'lucide-react';

type Bucket = 'all' | 'lt15' | '15-30' | 'gt30';

interface FollowUp {
  loanId: string;
  note: string;
  date: string;
}

interface Toast {
  id: number;
  kind: 'info' | 'success';
  text: string;
}

export default function OverdueScreen({ onNavigate }: { onNavigate: (id: string) => void }) {
  const agents = useAgents();
  void agents;
  const [loans, setLoans] = useState<Loan[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [bucket, setBucket] = useState<Bucket>('all');
  const [followUps, setFollowUps] = useState<Record<string, FollowUp>>({});
  const [modalLoan, setModalLoan] = useState<Loan | null>(null);
  const [modalNote, setModalNote] = useState('');
  const [modalDate, setModalDate] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [loanRes, custRes] = await Promise.all([
        supabase.from('loans').select('*').eq('status', 'overdue').order('created_at', { ascending: false }),
        supabase.from('customers').select('*'),
      ]);
      if (!active) return;
      setLoans((loanRes.data ?? []) as Loan[]);
      setCustomers((custRes.data ?? []) as Customer[]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const custById = useMemo(() => {
    const m: Record<string, Customer> = {};
    for (const c of customers) m[c.id] = c;
    return m;
  }, [customers]);

  function pushToast(text: string, kind: Toast['kind'] = 'info') {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  }

  async function logNotification(title: string, message: string) {
    try {
      await supabase.from('notifications').insert({ type: 'reminder', title, message, read: false });
    } catch {
      // best-effort
    }
  }

  function customerOf(loan: Loan): Customer | undefined {
    return custById[loan.customer_id];
  }

  function mobileOf(loan: Loan): string {
    return customerOf(loan)?.mobile ?? '';
  }

  async function handleCall(loan: Loan) {
    const mobile = mobileOf(loan);
    const name = loan.customer_name ?? 'customer';
    pushToast(`Calling ${mobile || 'customer'}...`, 'info');
    await logNotification(`Follow-up call to ${name}`, `Call placed to ${mobile || 'on file'} for overdue loan ${loan.loan_number}.`);
  }

  async function handleSms(loan: Loan) {
    const mobile = mobileOf(loan);
    const name = loan.customer_name ?? 'customer';
    pushToast(`SMS sent to ${mobile || 'customer'}`, 'success');
    await logNotification(`Follow-up SMS to ${name}`, `SMS sent to ${mobile || 'on file'} for overdue loan ${loan.loan_number}.`);
  }

  function openFollowup(loan: Loan) {
    setModalLoan(loan);
    setModalNote(followUps[loan.id]?.note ?? '');
    setModalDate(followUps[loan.id]?.date ?? new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  }

  function saveFollowup() {
    if (!modalLoan) return;
    setFollowUps((f) => ({ ...f, [modalLoan.id]: { loanId: modalLoan.id, note: modalNote, date: modalDate } }));
    pushToast('Follow-up scheduled', 'success');
    setModalLoan(null);
    setModalNote('');
    setModalDate('');
  }

  function daysOverdue(loan: Loan): number {
    return daysBetween(loan.start_date, new Date());
  }

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return loans
      .map((l) => ({ loan: l, days: daysOverdue(l) }))
      .filter(({ loan, days }) => {
        if (q) {
          const okName = (loan.customer_name ?? '').toLowerCase().includes(q);
          const okNum = loan.loan_number.toLowerCase().includes(q);
          if (!okName && !okNum) return false;
        }
        if (bucket === 'lt15' && !(days < 15)) return false;
        if (bucket === '15-30' && !(days >= 15 && days <= 30)) return false;
        if (bucket === 'gt30' && !(days > 30)) return false;
        return true;
      });
  }, [loans, query, bucket]);

  const stats = useMemo(() => {
    const total = loans.length;
    const amount = loans.reduce((s, l) => s + (l.outstanding_balance ?? 0), 0);
    const list = loans.map((l) => daysOverdue(l));
    const avg = list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : 0;
    const critical = list.filter((d) => d > 30).length;
    return { total, amount, avg, critical };
  }, [loans]);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 items-center w-full px-4 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium text-white flex items-center gap-2 animate-slide-up ${
              t.kind === 'success' ? 'bg-emerald-600' : 'bg-ink-900'
            }`}
          >
            <Bell className="w-4 h-4" />
            {t.text}
          </div>
        ))}
      </div>

      <PageHeader
        title="Overdue Management"
        subtitle="Track and follow up on overdue loan accounts"
        actions={<Badge color="red">{stats.total} overdue</Badge>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Total Overdue" value={String(stats.total)} hint="accounts" icon={AlertCircle} tone="rose" />
        <StatCard label="Overdue Amount" value={formatCurrency(stats.amount)} hint="outstanding" icon={PhoneCall} tone="red" />
        <StatCard label="Avg Days Overdue" value={`${stats.avg} d`} hint="across accounts" icon={Bell} tone="amber" />
        <StatCard label="Critical (>30d)" value={String(stats.critical)} hint="needs attention" icon={AlertCircle} tone="rose" />
      </div>

      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
            <input
              className="input pl-9"
              placeholder="Search customer or loan number..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="md:w-56">
            <Select value={bucket} onChange={(e) => setBucket(e.target.value as Bucket)}>
              <option value="all">All overdue</option>
              <option value="lt15">Less than 15 days</option>
              <option value="15-30">15 - 30 days</option>
              <option value="gt30">More than 30 days</option>
            </Select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card p-16 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
          <p className="text-sm text-ink-500 mt-3">Loading overdue accounts...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={UserCheck}
            title="No overdue accounts"
            description={query || bucket !== 'all' ? 'Try adjusting your search or filter.' : 'All loans are on track. Great work!'}
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="table-head text-left">Customer</th>
                  <th className="table-head text-left">Loan No.</th>
                  <th className="table-head text-right">Due Amount</th>
                  <th className="table-head text-center">Days Overdue</th>
                  <th className="table-head text-left">Agent</th>
                  <th className="table-head text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map(({ loan, days }) => {
                  const cust = customerOf(loan);
                  return (
                    <tr key={loan.id} className="hover:bg-ink-50/60 transition-colors">
                      <td className="table-cell">
                        <button onClick={() => onNavigate(loan.id)} className="flex items-center gap-3 text-left">
                          <Avatar name={loan.customer_name ?? 'C'} size={36} src={cust?.photo_url} />
                          <div>
                            <p className="font-semibold text-ink-900">{loan.customer_name ?? 'Unknown'}</p>
                            <p className="text-xs text-ink-400">{cust?.mobile ?? 'No mobile'}</p>
                          </div>
                        </button>
                      </td>
                      <td className="table-cell">
                        <span className="font-mono text-ink-700">{loan.loan_number}</span>
                        {followUps[loan.id] && <Badge color="purple" className="ml-2">Follow-up</Badge>}
                      </td>
                      <td className="table-cell text-right font-semibold text-rose-700">{formatCurrency(loan.outstanding_balance)}</td>
                      <td className="table-cell text-center">
                        <Badge color={days > 30 ? 'red' : days >= 15 ? 'yellow' : 'gray'}>{days}d</Badge>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <Avatar name={loan.agent_name ?? 'Agent'} size={28} />
                          <span className="text-sm text-ink-700">{loan.agent_name ?? 'Unassigned'}</span>
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            className="btn-secondary !px-2.5 !py-2"
                            title="Call customer"
                            onClick={() => handleCall(loan)}
                          >
                            <Phone className="w-4 h-4 text-emerald-600" />
                          </button>
                          <button
                            className="btn-secondary !px-2.5 !py-2"
                            title="Send SMS"
                            onClick={() => handleSms(loan)}
                          >
                            <MessageSquare className="w-4 h-4 text-brand-600" />
                          </button>
                          <button
                            className="btn-secondary !px-2.5 !py-2"
                            title="Assign follow-up"
                            onClick={() => openFollowup(loan)}
                          >
                            <UserCheck className="w-4 h-4 text-violet-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalLoan && (
        <Modal open onClose={() => setModalLoan(null)} title="Assign Follow-up" size="sm">
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-ink-50 border border-ink-100">
              <Avatar name={modalLoan.customer_name ?? 'C'} size={40} />
              <div>
                <p className="font-semibold text-ink-900 text-sm">{modalLoan.customer_name}</p>
                <p className="text-xs text-ink-500 font-mono">{modalLoan.loan_number}</p>
              </div>
              <div className="ml-auto">
                <StatusBadge status="overdue" />
              </div>
            </div>
            <Field label="Follow-up note" required>
              <TextArea
                placeholder="e.g. Called customer, promised to pay by Friday"
                value={modalNote}
                onChange={(e) => setModalNote(e.target.value)}
              />
            </Field>
            <Field label="Follow-up date" required>
              <input type="date" className="input" value={modalDate} onChange={(e) => setModalDate(e.target.value)} />
            </Field>
            <div className="flex items-center justify-between text-xs text-ink-500">
              <span>Started: {formatDate(modalLoan.start_date)}</span>
              <span>Outstanding: {formatCurrency(modalLoan.outstanding_balance)}</span>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button className="btn-secondary" onClick={() => setModalLoan(null)}>Cancel</button>
              <button className="btn-primary" onClick={saveFollowup} disabled={!modalNote || !modalDate}>
                <UserCheck className="w-4 h-4" /> Schedule
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof AlertCircle;
  tone: 'rose' | 'red' | 'amber';
}) {
  const tones = {
    rose: 'bg-rose-50 text-rose-600 ring-rose-100',
    red: 'bg-red-50 text-red-600 ring-red-100',
    amber: 'bg-amber-50 text-amber-600 ring-amber-100',
  } as const;
  return (
    <div className="card p-4 flex items-start gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ring-1 ${tones[tone]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
        <p className="text-lg sm:text-xl font-bold text-ink-900 truncate">{value}</p>
        <p className="text-xs text-ink-400">{hint}</p>
      </div>
    </div>
  );
}
