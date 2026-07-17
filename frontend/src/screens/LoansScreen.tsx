import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Eye, Pencil, Ban, Download, Landmark, Loader2, FileText, CheckCircle2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import type { Loan, RepaymentSchedule, Customer } from '../types';
import {
  calculateEMI, calculateTotalInterest, buildSchedule,
  buildWeeklySchedule, buildDailySchedule,
  formatCurrency, formatDate,
} from '../calc';
import {
  PageHeader, Modal, Field, Select, TextArea, StatusBadge, EmptyState, ConfirmDialog, Badge,
} from '../components/ui';
import { useAgents } from '../hooks';
import LoanApplicationForm from './LoanApplicationForm';

type LoanType = 'monthly' | 'weekly' | 'daily';
type DailyPlan = '60d' | '100d';

type Draft = {
  id?: string;
  loan_number: string;
  customer_id: string;
  loan_amount: string;
  interest_percentage: string;
  loan_duration: string;
  loan_type: LoanType;
  daily_plan: DailyPlan;
  start_date: string;
  assigned_agent: string;
  processing_fee: string;
  notes: string;
};

const STATUSES = ['all', 'active', 'overdue', 'closed', 'pending'] as const;

function randLoanNumber() {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `LN-${n}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function notifyAgentOfAssignment(agentId: string, loanNumber: string, customerName: string | null) {
  const title = 'New Loan Assigned';
  const message = `Loan ${loanNumber} for ${customerName ?? 'a customer'} has been assigned to you.`;
  supabase.from('notifications').insert({ user_id: agentId, type: 'info', title, message, read: false }).then();
  supabase.functions
    .invoke('notify-push', { body: { title, message, user_ids: [agentId] } })
    .catch(() => {});
}

function emptyDraft(): Draft {
  return {
    loan_number: randLoanNumber(),
    customer_id: '',
    loan_amount: '',
    interest_percentage: '10',
    loan_duration: '10',
    loan_type: 'monthly',
    daily_plan: '60d',
    start_date: todayISO(),
    assigned_agent: '',
    processing_fee: '',
    notes: '',
  };
}

export default function LoansScreen({ onNavigate }: { onNavigate: (id: string) => void }) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const agents = useAgents();
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUSES)[number]>('all');
  const [editing, setEditing] = useState<Draft | null>(null);
  const [viewing, setViewing] = useState<Loan | null>(null);
  const [schedule, setSchedule] = useState<RepaymentSchedule[]>([]);
  const [showSched, setShowSched] = useState(false);
  const [loadingSched, setLoadingSched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [closeTarget, setCloseTarget] = useState<Loan | null>(null);
  const [appFormLoan, setAppFormLoan] = useState<Loan | null>(null);

  const fetchLoans = async () => {
    setLoading(true);
    const { data } = await supabase.from('loans').select('*').order('created_at', { ascending: false });
    setLoans((data ?? []) as Loan[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchLoans();
    supabase.from('customers').select('id, full_name').then(({ data }) => {
      setCustomers((data ?? []) as Customer[]);
    });
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return loans.filter((l) => {
      const matchQ = !q || l.loan_number.toLowerCase().includes(q) || (l.customer_name ?? '').toLowerCase().includes(q);
      const matchS = statusFilter === 'all' || l.status === statusFilter;
      return matchQ && matchS;
    });
  }, [loans, query, statusFilter]);

  const calc = useMemo(() => {
    if (!editing) return null;
    const principal = parseFloat(editing.loan_amount) || 0;
    const rate = parseFloat(editing.interest_percentage) || 0;
    const sd = editing.start_date;

    if (editing.loan_type === 'weekly') {
      const weeks = 10;
      if (principal <= 0 || !sd) return { emi: 0, interest: 0, repayment: 0, disbursed: 0, sched: [], installmentLabel: 'Weekly Installment' };
      const { installment, totalInterest, schedule, disbursedAmount } = buildWeeklySchedule(principal, rate, weeks, sd);
      return { emi: installment, interest: totalInterest, repayment: principal, disbursed: disbursedAmount, sched: schedule, installmentLabel: 'Weekly Installment' };
    }

    if (editing.loan_type === 'daily') {
      const days = editing.daily_plan === '60d' ? 60 : 100;
      if (principal <= 0 || !sd) return { emi: 0, interest: 0, repayment: 0, disbursed: 0, sched: [], installmentLabel: 'Daily Installment' };
      const { installment, totalInterest, totalRepayment, schedule, disbursedAmount } = buildDailySchedule(principal, rate, days, sd);
      return { emi: installment, interest: totalInterest, repayment: totalRepayment, disbursed: disbursedAmount, sched: schedule, installmentLabel: 'Daily Installment' };
    }

    // monthly (default)
    const months = parseInt(editing.loan_duration) || 0;
    const emi = calculateEMI(principal, rate, months);
    const interest = calculateTotalInterest(principal, emi, months);
    const repayment = emi * months;
    const sched = principal > 0 && months > 0 && sd
      ? buildSchedule(principal, rate, months, sd).schedule
      : [];
    return { emi, interest, repayment, disbursed: principal, sched, installmentLabel: 'Monthly EMI' };
  }, [editing]);

  const openCreate = () => setEditing(emptyDraft());
  const openEdit = (l: Loan) =>
    setEditing({
      id: l.id,
      loan_number: l.loan_number,
      customer_id: l.customer_id,
      loan_amount: String(l.loan_amount ?? ''),
      interest_percentage: String(l.interest_percentage ?? ''),
      loan_duration: String(l.loan_duration ?? ''),
      loan_type: (l.loan_type ?? 'monthly') as LoanType,
      daily_plan: '60d' as DailyPlan,
      start_date: l.start_date?.slice(0, 10) ?? todayISO(),
      assigned_agent: l.assigned_agent ?? '',
      processing_fee: String(l.processing_fee ?? ''),
      notes: l.notes ?? '',
    });

  const buildPayload = (status: 'pending' | 'active') => {
    if (!editing) return null;
    const principal = parseFloat(editing.loan_amount) || 0;
    const rate = parseFloat(editing.interest_percentage) || 0;
    const fee = parseFloat(editing.processing_fee) || 0;
    const cust = customers.find((c) => c.id === editing.customer_id);
    const agent = agents.find((a) => a.id === editing.assigned_agent);

    let emi = 0, total_interest = 0, total_repayment = 0, loan_duration = 0;
    if (editing.loan_type === 'weekly') {
      const r = buildWeeklySchedule(principal, rate, 10, editing.start_date);
      emi = r.installment; total_interest = r.totalInterest;
      total_repayment = r.installment * 10; loan_duration = 10;
    } else if (editing.loan_type === 'daily') {
      const days = editing.daily_plan === '60d' ? 60 : 100;
      const r = buildDailySchedule(principal, rate, days, editing.start_date);
      emi = r.installment; total_interest = r.totalInterest;
      total_repayment = r.totalRepayment; loan_duration = days;
    } else {
      loan_duration = parseInt(editing.loan_duration) || 0;
      emi = calculateEMI(principal, rate, loan_duration);
      total_interest = calculateTotalInterest(principal, emi, loan_duration);
      total_repayment = emi * loan_duration;
    }

    return {
      loan_number: editing.loan_number,
      customer_id: editing.customer_id,
      customer_name: cust?.full_name ?? null,
      loan_amount: principal,
      interest_percentage: rate,
      loan_duration,
      loan_type: editing.loan_type,
      start_date: editing.start_date,
      assigned_agent: editing.assigned_agent || null,
      agent_name: agent?.full_name ?? null,
      processing_fee: fee,
      emi,
      total_interest,
      total_repayment,
      outstanding_balance: principal + fee,
      status,
      notes: editing.notes || null,
    };
  };

  const persist = async (status: 'pending' | 'active') => {
    if (!editing) return;
    const payload = buildPayload(status);
    if (!payload) return;
    setSaving(true);
    const previousAgent = editing.id ? loans.find((l) => l.id === editing.id)?.assigned_agent ?? null : null;
    if (editing.id) {
      const { loan_number, customer_id, customer_name, ...rest } = payload;
      await supabase.from('loans').update(rest).eq('id', editing.id);
    } else {
      const { data } = await supabase.from('loans').insert(payload).select().single();
      if (data && status === 'active') {
        const rows = calc?.sched.map((s) => ({
          loan_id: (data as Loan).id,
          installment_no: s.installment_no,
          due_date: s.due_date,
          emi_amount: s.emi_amount,
          paid_amount: 0,
          balance: s.emi_amount,
          status: 'pending',
        }));
        if (rows && rows.length) await supabase.from('repayment_schedule').insert(rows);
      }
    }
    if (payload.assigned_agent && payload.assigned_agent !== previousAgent) {
      notifyAgentOfAssignment(payload.assigned_agent, payload.loan_number, payload.customer_name);
    }
    setSaving(false);
    setEditing(null);
    fetchLoans();
  };

  const closeLoan = async () => {
    if (!closeTarget) return;
    await supabase.from('loans').update({ status: 'closed', outstanding_balance: 0 }).eq('id', closeTarget.id);
    setCloseTarget(null);
    fetchLoans();
  };

  const openView = async (l: Loan) => {
    setViewing(l);
    setShowSched(false);
    setSchedule([]);
  };

  const loadSchedule = async (l: Loan) => {
    setLoadingSched(true);
    const { data } = await supabase
      .from('repayment_schedule')
      .select('*')
      .eq('loan_id', l.id)
      .order('installment_no', { ascending: true });
    setSchedule((data ?? []) as RepaymentSchedule[]);
    setShowSched(true);
    setLoadingSched(false);
  };

  const downloadSchedule = async (l: Loan) => {
    const { data } = await supabase
      .from('repayment_schedule')
      .select('*')
      .eq('loan_id', l.id)
      .order('installment_no', { ascending: true });
    const rows = (data ?? []) as RepaymentSchedule[];
    const source = rows.length
      ? rows
      : buildSchedule(l.loan_amount, l.interest_percentage, l.loan_duration, l.start_date).schedule.map((s) => ({
          id: '', loan_id: l.id, created_at: '', ...s,
        }));
    const header = ['Installment No', 'Due Date', 'EMI Amount', 'Paid Amount', 'Balance', 'Status'];
    const body = source.map((r) => [
      r.installment_no, r.due_date, r.emi_amount, r.paid_amount, r.balance, r.status,
    ]);
    const csv = [header, ...body].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loan_${l.loan_number}_schedule.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const canClose = (l: Loan) => l.status === 'active' || l.status === 'overdue';

  return (
    <div>
      <PageHeader
        title="Loans"
        subtitle="Manage loan accounts, schedules, and repayments"
        actions={
          <button className="btn-primary" onClick={openCreate}>
            <Plus className="w-4 h-4" /> Create Loan
          </button>
        }
      />

      <div className="card p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              className="input pl-9"
              placeholder="Search loan number or customer..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-2 rounded-xl text-sm font-medium capitalize whitespace-nowrap transition-colors ${
                  statusFilter === s ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-ink-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Landmark}
            title="No loans found"
            description="Create a new loan to get started."
            action={
              <button className="btn-primary" onClick={openCreate}>
                <Plus className="w-4 h-4" /> Create Loan
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/50">
                  {['Loan No', 'Type', 'Customer', 'Amount', 'Installment', 'Outstanding', 'Agent', 'Status', 'Start', 'Actions'].map((h) => (
                    <th key={h} className="table-head text-left font-semibold text-ink-600 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id} className="border-b border-ink-50 hover:bg-ink-50/40 transition-colors">
                    <td className="table-cell px-4 py-3 font-medium text-ink-900">{l.loan_number}</td>
                    <td className="table-cell px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        l.loan_type === 'weekly' ? 'bg-violet-100 text-violet-700' :
                        l.loan_type === 'daily'  ? 'bg-amber-100 text-amber-700' :
                        'bg-sky-100 text-sky-700'
                      }`}>{l.loan_type === 'weekly' ? 'Weekly' : l.loan_type === 'daily' ? 'Daily' : 'Monthly'}</span>
                    </td>
                    <td className="table-cell px-4 py-3 text-ink-700">{l.customer_name ?? '-'}</td>
                    <td className="table-cell px-4 py-3 text-ink-700">{formatCurrency(l.loan_amount)}</td>
                    <td className="table-cell px-4 py-3 text-ink-700">{formatCurrency(l.emi)}</td>
                    <td className="table-cell px-4 py-3 text-ink-900 font-semibold">{formatCurrency(l.outstanding_balance)}</td>
                    <td className="table-cell px-4 py-3 text-ink-600">{l.agent_name ?? 'Unassigned'}</td>
                    <td className="table-cell px-4 py-3"><StatusBadge status={l.status} /></td>
                    <td className="table-cell px-4 py-3 text-ink-500">{formatDate(l.start_date)}</td>
                    <td className="table-cell px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button title="View" className="btn-ghost !p-2" onClick={() => openView(l)}><Eye className="w-4 h-4" /></button>
                        <button title="Edit" className="btn-ghost !p-2" onClick={() => openEdit(l)}><Pencil className="w-4 h-4" /></button>
                        {canClose(l) && (
                          <button title="Close Loan" className="btn-ghost !p-2 text-rose-600" onClick={() => setCloseTarget(l)}><Ban className="w-4 h-4" /></button>
                        )}
                        <button title="Download Schedule" className="btn-ghost !p-2" onClick={() => downloadSchedule(l)}><Download className="w-4 h-4" /></button>
                        <button title="Print Application" className="btn-ghost !p-2 text-brand-600" onClick={() => setAppFormLoan(l)}><FileText className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing.id ? 'Edit Loan' : 'Create Loan'} size="xl">

          {/* ── Loan Type Selector ── */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Collection Type</p>
            <div className="flex gap-2">
              {(['monthly', 'weekly', 'daily'] as LoanType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    const base = { ...editing, loan_type: t };
                    if (t === 'weekly') { setEditing({ ...base, interest_percentage: '10', loan_duration: '10' }); }
                    else if (t === 'daily') { setEditing({ ...base, daily_plan: '60d', interest_percentage: '20', loan_duration: '60' }); }
                    else { setEditing({ ...base, interest_percentage: '', loan_duration: '' }); }
                  }}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-all capitalize ${
                    editing.loan_type === t
                      ? t === 'weekly' ? 'border-violet-500 bg-violet-50 text-violet-700'
                        : t === 'daily' ? 'border-amber-500 bg-amber-50 text-amber-700'
                        : 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-ink-200 bg-white text-ink-500 hover:border-ink-300'
                  }`}
                >{t}</button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Loan Number"><input className="input bg-ink-50" value={editing.loan_number} readOnly /></Field>
            <Field label="Customer" required>
              <Select value={editing.customer_id} onChange={(e) => setEditing({ ...editing, customer_id: e.target.value })}>
                <option value="">Select customer...</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </Select>
            </Field>
            <Field label="Loan Amount" required>
              <input type="number" className="input" value={editing.loan_amount}
                onChange={(e) => setEditing({ ...editing, loan_amount: e.target.value })} />
            </Field>

            {/* ── Weekly: interest radio ── */}
            {editing.loan_type === 'weekly' && (
              <Field label="Interest Rate" required>
                <div className="flex gap-3 mt-1">
                  {(['10', '12'] as const).map((r) => (
                    <label key={r} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 cursor-pointer font-semibold text-sm transition-all ${
                      editing.interest_percentage === r ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-ink-200 text-ink-500 hover:border-ink-300'
                    }`}>
                      <input type="radio" className="hidden" checked={editing.interest_percentage === r}
                        onChange={() => setEditing({ ...editing, interest_percentage: r })} />
                      {r}%
                    </label>
                  ))}
                </div>
              </Field>
            )}
            {editing.loan_type === 'weekly' && (
              <Field label="Duration"><input className="input bg-ink-50" value="10 Weeks" readOnly /></Field>
            )}

            {/* ── Daily: plan radio ── */}
            {editing.loan_type === 'daily' && (
              <Field label="Collection Plan" required>
                <div className="flex gap-3 mt-1">
                  {([{ id: '60d', label: '60 Days · 20%', rate: '20', dur: '60' }, { id: '100d', label: '100 Days · 15%', rate: '15', dur: '100' }] as const).map((p) => (
                    <label key={p.id} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 cursor-pointer font-semibold text-sm transition-all ${
                      editing.daily_plan === p.id ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-ink-200 text-ink-500 hover:border-ink-300'
                    }`}>
                      <input type="radio" className="hidden" checked={editing.daily_plan === p.id}
                        onChange={() => setEditing({ ...editing, daily_plan: p.id as DailyPlan, interest_percentage: p.rate, loan_duration: p.dur })} />
                      {p.label}
                    </label>
                  ))}
                </div>
              </Field>
            )}
            {editing.loan_type === 'daily' && (
              <Field label="Rate & Duration">
                <input className="input bg-ink-50" value={`${editing.interest_percentage}% flat · ${editing.loan_duration} days`} readOnly />
              </Field>
            )}

            {/* ── Monthly: original fields ── */}
            {editing.loan_type === 'monthly' && (
              <Field label="Interest (% p.a.)" required>
                <input type="number" step="0.1" className="input" value={editing.interest_percentage}
                  onChange={(e) => setEditing({ ...editing, interest_percentage: e.target.value })} />
              </Field>
            )}
            {editing.loan_type === 'monthly' && (
              <Field label="Duration (months)" required>
                <input type="number" className="input" value={editing.loan_duration}
                  onChange={(e) => setEditing({ ...editing, loan_duration: e.target.value })} />
              </Field>
            )}

            <Field label="Start Date" required>
              <input type="date" className="input" value={editing.start_date}
                onChange={(e) => setEditing({ ...editing, start_date: e.target.value })} />
            </Field>
            <Field label="Assigned Agent">
              <Select value={editing.assigned_agent} onChange={(e) => setEditing({ ...editing, assigned_agent: e.target.value })}>
                <option value="">Unassigned</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
              </Select>
            </Field>
            <Field label="Processing Fee">
              <input type="number" className="input" value={editing.processing_fee}
                onChange={(e) => setEditing({ ...editing, processing_fee: e.target.value })} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Notes">
                <TextArea value={editing.notes} placeholder="Optional notes..."
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </Field>
            </div>
          </div>

          {calc && (
            <div className="mt-5 animate-fade-in">
              {/* Weekly & Daily: special 3-card layout showing upfront-interest model */}
              {editing?.loan_type === 'weekly' || editing?.loan_type === 'daily' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-violet-50 border border-violet-100 p-4">
                    <p className="text-xs text-violet-700 font-medium">{calc.installmentLabel}</p>
                    <p className="text-lg font-bold text-violet-900 mt-1">{formatCurrency(calc.emi)}</p>
                    <p className="text-[10px] text-violet-500 mt-0.5">
                      × {editing?.loan_type === 'weekly' ? '10 weeks' : `${editing?.loan_duration} days`} = {formatCurrency(calc.repayment)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4">
                    <p className="text-xs text-amber-700 font-medium">
                      {editing?.loan_type === 'daily' ? 'Interest (added)' : 'Upfront Interest (deducted)'}
                    </p>
                    <p className="text-lg font-bold text-amber-900 mt-1">{formatCurrency(calc.interest)}</p>
                    <p className="text-[10px] text-amber-500 mt-0.5">
                      {editing?.loan_type === 'daily' ? 'Added to repayment' : 'Collected at disbursement'}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
                    <p className="text-xs text-emerald-700 font-medium">Amount Disbursed to Borrower</p>
                    <p className="text-lg font-bold text-emerald-900 mt-1">{formatCurrency(calc.disbursed ?? 0)}</p>
                    <p className="text-[10px] text-emerald-500 mt-0.5">
                      {editing?.loan_type === 'daily' ? 'Full loan amount' : 'Principal − Interest'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-brand-50 border border-brand-100 p-4">
                    <p className="text-xs text-brand-700 font-medium">{calc.installmentLabel}</p>
                    <p className="text-lg font-bold text-brand-900 mt-1">{formatCurrency(calc.emi)}</p>
                  </div>
                  <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4">
                    <p className="text-xs text-amber-700 font-medium">Total Interest</p>
                    <p className="text-lg font-bold text-amber-900 mt-1">{formatCurrency(calc.interest)}</p>
                  </div>
                  <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
                    <p className="text-xs text-emerald-700 font-medium">Total Repayment</p>
                    <p className="text-lg font-bold text-emerald-900 mt-1">{formatCurrency(calc.repayment)}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {calc && calc.sched.length > 0 && (
            <div className="mt-5">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-ink-500" />
                <h3 className="text-sm font-semibold text-ink-800">Repayment Schedule Preview</h3>
              </div>
              <div className="overflow-x-auto max-h-56 rounded-xl border border-ink-100">
                <table className="w-full text-sm">
                  <thead className="bg-ink-50 sticky top-0">
                    <tr>{['#', 'Due Date', 'EMI Amount'].map((h) => (
                      <th key={h} className="table-head text-left font-semibold text-ink-600 px-3 py-2">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {calc.sched.map((r) => (
                      <tr key={r.installment_no} className="border-t border-ink-50">
                        <td className="px-3 py-2 text-ink-600">{r.installment_no}</td>
                        <td className="px-3 py-2 text-ink-700">{formatDate(r.due_date)}</td>
                        <td className="px-3 py-2 text-ink-900 font-medium">{formatCurrency(r.emi_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-6">
            <button className="btn-secondary" onClick={() => setEditing(null)} disabled={saving}>Cancel</button>
            <button className="btn-secondary" onClick={() => persist('pending')} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save
            </button>
            <button className="btn-success" onClick={() => persist('active')} disabled={saving}>
              <CheckCircle2 className="w-4 h-4" /> Approve
            </button>
          </div>
        </Modal>
      )}

      {viewing && (
        <Modal open onClose={() => setViewing(null)} title={`Loan ${viewing.loan_number}`} size="xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              ['Customer', viewing.customer_name ?? '-'],
              ['Loan Amount', formatCurrency(viewing.loan_amount)],
              ['EMI', formatCurrency(viewing.emi)],
              ['Outstanding', formatCurrency(viewing.outstanding_balance)],
              ['Interest', `${viewing.interest_percentage}%`],
              ['Duration', `${viewing.loan_duration} mo`],
              ['Start Date', formatDate(viewing.start_date)],
              ['Agent', viewing.agent_name ?? 'Unassigned'],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-ink-50 p-3">
                <p className="text-xs text-ink-500">{k}</p>
                <p className="text-sm font-semibold text-ink-900 mt-0.5 truncate">{v}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mb-3">
            <Badge color={viewing.status === 'active' ? 'green' : viewing.status === 'overdue' ? 'red' : viewing.status === 'pending' ? 'yellow' : 'gray'}>
              {viewing.status}
            </Badge>
            <button
              className="btn-secondary !py-1.5"
              onClick={() => loadSchedule(viewing)}
              disabled={loadingSched}
            >
              {loadingSched ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              {showSched ? 'Refresh Schedule' : 'View Schedule'}
            </button>
            <button className="btn-ghost !py-1.5" onClick={() => downloadSchedule(viewing)}>
              <Download className="w-4 h-4" /> Download
            </button>
            <button className="btn-ghost !py-1.5 ml-auto" onClick={() => onNavigate(viewing.id)}>
              <Eye className="w-4 h-4" /> Details
            </button>
          </div>

          {showSched && (
            <div className="overflow-x-auto max-h-80 rounded-xl border border-ink-100 animate-fade-in">
              <table className="w-full text-sm">
                <thead className="bg-ink-50 sticky top-0">
                  <tr>{['#', 'Due Date', 'EMI', 'Paid', 'Balance', 'Status'].map((h) => (
                    <th key={h} className="table-head text-left font-semibold text-ink-600 px-3 py-2">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {schedule.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-ink-400">No schedule records found.</td></tr>
                  ) : schedule.map((r) => (
                    <tr key={r.id} className="border-t border-ink-50">
                      <td className="px-3 py-2 text-ink-600">{r.installment_no}</td>
                      <td className="px-3 py-2 text-ink-700">{formatDate(r.due_date)}</td>
                      <td className="px-3 py-2 text-ink-900 font-medium">{formatCurrency(r.emi_amount)}</td>
                      <td className="px-3 py-2 text-emerald-700">{formatCurrency(r.paid_amount)}</td>
                      <td className="px-3 py-2 text-ink-700">{formatCurrency(r.balance)}</td>
                      <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {viewing.notes && (
            <div className="mt-4 rounded-xl bg-ink-50 p-3">
              <p className="text-xs text-ink-500 mb-1">Notes</p>
              <p className="text-sm text-ink-700">{viewing.notes}</p>
            </div>
          )}
        </Modal>
      )}

      <ConfirmDialog
        open={!!closeTarget}
        onClose={() => setCloseTarget(null)}
        onConfirm={closeLoan}
        title="Close Loan"
        message={`Close loan ${closeTarget?.loan_number}? Outstanding balance will be set to zero.`}
        confirmLabel="Close Loan"
        danger
      />

      <LoanApplicationForm
        loan={appFormLoan}
        open={!!appFormLoan}
        onClose={() => setAppFormLoan(null)}
      />
    </div>
  );
}
