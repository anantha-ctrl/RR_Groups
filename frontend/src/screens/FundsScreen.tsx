import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PiggyBank, Plus, X, Loader2, Calendar, Coins, Gift, Wallet,
  TrendingUp, Check, AlertCircle, Search, Pencil, Trash2, HandCoins, RefreshCw,
  BookOpen, Inbox, CheckCircle2,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../auth';
import { formatCurrency, formatDate } from '../calc';
import { PageHeader, EmptyState, Badge } from '../components/ui';
import type { Fund, FundPayment, Customer } from '../types';

const PAYMENT_METHODS = ['cash', 'upi', 'card', 'bank', 'cheque'] as const;

// What the customer actually deposits (weekly × weeks). The bonus is NOT deposited —
// it is credited on top only at maturity/settlement. So all collection targets,
// progress and "remaining" are measured against the deposit, not the payout.
function depositTarget(f: Fund): number {
  return Number(f.deposit_amount) || Number(f.weekly_amount) * Number(f.weeks);
}

function todayISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function newFundNumber() {
  return `FND-${Math.floor(100000 + Math.random() * 900000)}`;
}

// Parse a 'YYYY-MM-DD' as a *local* midnight date (avoids UTC off-by-one).
function parseISODate(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function toISODateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function weekdayShort(d: Date): string {
  return d.toLocaleDateString('en-IN', { weekday: 'short' });
}

export default function FundsScreen() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const isAgent = profile?.role === 'agent';
  const isCustomer = profile?.role === 'customer';

  const [funds, setFunds] = useState<Fund[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editFund, setEditFund] = useState<Fund | null>(null);
  const [collectTarget, setCollectTarget] = useState<Fund | null>(null);
  const [settleTarget, setSettleTarget] = useState<Fund | null>(null);
  const [passbookTarget, setPassbookTarget] = useState<Fund | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Fund | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const activeRef = useRef(true);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    let rows: Fund[] = [];
    if (isCustomer) {
      if (profile?.customer_id) {
        const { data } = await supabase
          .from('funds').select('*')
          .eq('customer_id', profile.customer_id)
          .order('created_at', { ascending: false });
        rows = (data ?? []) as Fund[];
      }
    } else if (isAgent) {
      // Agents see funds belonging to their assigned customers.
      const { data: myCusts } = await supabase
        .from('customers').select('id').eq('assigned_agent', profile?.id ?? '');
      const ids = (myCusts ?? []).map((c: { id: string }) => c.id);
      if (ids.length) {
        const { data } = await supabase
          .from('funds').select('*')
          .in('customer_id', ids)
          .order('created_at', { ascending: false });
        rows = (data ?? []) as Fund[];
      }
    } else {
      const { data } = await supabase
        .from('funds').select('*').order('created_at', { ascending: false });
      rows = (data ?? []) as Fund[];
    }
    if (!activeRef.current) return;
    setFunds(rows);
    setLoading(false);
    setRefreshing(false);
  }, [isCustomer, isAgent, profile?.id, profile?.customer_id]);

  useEffect(() => {
    activeRef.current = true;
    load();
    if (isAdmin) {
      supabase.from('customers').select('*').order('full_name', { ascending: true }).then(({ data }) => {
        setCustomers((data ?? []) as Customer[]);
      });
    }
    // Keep collections live across roles (agent collects → admin sees).
    const timer = setInterval(() => load(true), 30000);
    return () => { activeRef.current = false; clearInterval(timer); };
  }, [isAdmin, load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const stats = useMemo(() => {
    const active = funds.filter((f) => f.status === 'active').length;
    const totalPayout = funds.reduce((s, f) => s + Number(f.total_amount), 0);
    const totalCollected = funds.reduce((s, f) => s + Number(f.collected_amount), 0);
    return { count: funds.length, active, totalPayout, totalCollected };
  }, [funds]);

  async function doDelete() {
    if (!deleteTarget) return;
    await supabase.from('funds').delete().eq('id', deleteTarget.id);
    setDeleteTarget(null);
    setToast('Fund deleted.');
    load();
  }

  const title = isCustomer ? 'My Funds' : 'Funds';

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title={title}
        subtitle="Weekly-deposit savings schemes with a maturity bonus"
        actions={
          <div className="flex items-center gap-2">
            <button
              className="btn-secondary"
              onClick={() => load(true)}
              disabled={refreshing}
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            {isAdmin && (
              <button className="btn-primary" onClick={() => { setEditFund(null); setFormOpen(true); }}>
                <Plus className="w-4 h-4" />
                Add Fund
              </button>
            )}
          </div>
        }
      />

      {toast && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3 animate-scale-in">
          <Check className="w-4 h-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <SummaryTile label="Total Funds" value={String(stats.count)} icon={PiggyBank} tone="brand" />
        <SummaryTile label="Active" value={String(stats.active)} icon={TrendingUp} tone="emerald" />
        <SummaryTile label="Maturity Payout" value={formatCurrency(stats.totalPayout)} icon={Gift} tone="violet" />
        <SummaryTile label="Collected" value={formatCurrency(stats.totalCollected)} icon={Wallet} tone="amber" />
      </div>

      {loading ? (
        <div className="card p-16 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
          <p className="text-sm text-ink-500 mt-3">Loading funds…</p>
        </div>
      ) : funds.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={PiggyBank}
            title="No funds yet"
            description={
              isAdmin ? 'Add a fund for a customer to get started.'
                : isAgent ? 'No funds for your assigned customers yet.'
                : 'Your funds will appear here once the admin sets one up for you.'
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {funds.map((f) => (
            <FundCard
              key={f.id}
              fund={f}
              showCustomer={!isCustomer}
              canManage={isAdmin}
              canCollect={isAgent}
              canSettle={isAdmin || isAgent}
              onEdit={() => { setEditFund(f); setFormOpen(true); }}
              onDelete={() => setDeleteTarget(f)}
              onCollect={() => setCollectTarget(f)}
              onSettle={() => setSettleTarget(f)}
              onPassbook={() => setPassbookTarget(f)}
            />
          ))}
        </div>
      )}

      {formOpen && (
        <FundForm
          customers={customers}
          editFund={editFund}
          onClose={() => setFormOpen(false)}
          onSaved={(name, edited) => {
            setFormOpen(false);
            setToast(edited ? `Fund updated for ${name}.` : `Fund created for ${name}.`);
            load();
          }}
        />
      )}

      {collectTarget && (
        <CollectModal
          fund={collectTarget}
          agentId={profile?.id ?? null}
          agentName={profile?.full_name ?? null}
          onClose={() => setCollectTarget(null)}
          onSaved={(amount) => {
            setCollectTarget(null);
            setToast(`Collected ${formatCurrency(amount)}.`);
            load();
          }}
        />
      )}

      {settleTarget && (
        <SettleModal
          fund={settleTarget}
          agentId={profile?.id ?? null}
          agentName={profile?.full_name ?? null}
          onClose={() => setSettleTarget(null)}
          onSaved={() => {
            setSettleTarget(null);
            setToast('Fund settled in full.');
            load();
          }}
        />
      )}

      {passbookTarget && (
        <PassbookModal
          fund={passbookTarget}
          onClose={() => setPassbookTarget(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete fund?"
          message={`This permanently removes ${deleteTarget.fund_number} (${deleteTarget.customer_name ?? 'customer'}). This cannot be undone.`}
          confirmLabel="Delete"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={doDelete}
        />
      )}
    </div>
  );
}

function FundCard({
  fund, showCustomer, canManage, canCollect, canSettle, onEdit, onDelete, onCollect, onSettle, onPassbook,
}: {
  fund: Fund;
  showCustomer: boolean;
  canManage: boolean;
  canCollect: boolean;
  canSettle: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onCollect: () => void;
  onSettle: () => void;
  onPassbook: () => void;
}) {
  const target = depositTarget(fund);
  const progress = target > 0 ? Math.min((fund.collected_amount / target) * 100, 100) : 0;
  const tone = fund.status === 'matured' ? 'green' : fund.status === 'closed' ? 'gray' : 'blue';
  const remaining = Math.max(0, target - Number(fund.collected_amount));
  return (
    <div className="card p-5 flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
            <PiggyBank className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            {showCustomer && (
              <p className="text-sm font-bold text-ink-900 truncate">{fund.customer_name ?? 'Unknown'}</p>
            )}
            <p className={`${showCustomer ? 'text-xs text-ink-400' : 'text-sm font-bold text-ink-900'} truncate`}>
              {fund.fund_number}
            </p>
          </div>
        </div>
        <Badge color={tone as 'green' | 'gray' | 'blue'}>{fund.status}</Badge>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center mb-3">
        <div className="rounded-xl bg-ink-50 p-2.5">
          <p className="text-[10px] text-ink-400 uppercase tracking-wide">Weekly</p>
          <p className="text-sm font-bold text-ink-800 mt-0.5">{formatCurrency(fund.weekly_amount)}</p>
        </div>
        <div className="rounded-xl bg-ink-50 p-2.5">
          <p className="text-[10px] text-ink-400 uppercase tracking-wide">Weeks</p>
          <p className="text-sm font-bold text-ink-800 mt-0.5">{fund.weeks}</p>
        </div>
        <div className="rounded-xl bg-amber-50 p-2.5">
          <p className="text-[10px] text-amber-500 uppercase tracking-wide">Bonus</p>
          <p className="text-sm font-bold text-amber-700 mt-0.5">{formatCurrency(fund.bonus)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5 mb-3">
        <span className="text-xs font-medium text-emerald-700">Maturity payout</span>
        <span className="text-base font-extrabold text-emerald-800">{formatCurrency(fund.total_amount)}</span>
      </div>

      <div className="flex items-center justify-between text-[11px] text-ink-400 mb-1.5">
        <span>Deposited {formatCurrency(fund.collected_amount)} / {formatCurrency(target)}</span>
        <span>{progress.toFixed(0)}%</span>
      </div>
      <div className="w-full h-2 bg-ink-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-700" style={{ width: `${progress}%` }} />
      </div>

      <div className="flex items-center gap-3 mt-3 text-[11px] text-ink-400">
        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(fund.start_date)}</span>
        <span className="flex items-center gap-1"><Gift className="w-3 h-3" /> {formatDate(fund.maturity_date)}</span>
      </div>

      {/* Actions — Passbook is available to everyone; role actions follow */}
      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-ink-100">
        <button
          onClick={onPassbook}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-ink-200 text-ink-600 hover:border-brand-300 hover:text-brand-700 text-sm font-semibold transition-colors"
        >
          <BookOpen className="w-4 h-4" /> Passbook
        </button>
        {canCollect && fund.status === 'active' && (
          <button
            onClick={onCollect}
            className="btn-primary flex-1 justify-center !py-2 text-sm"
          >
            <HandCoins className="w-4 h-4" /> Collect
          </button>
        )}
        {canManage && (
          <>
            <button
              onClick={onEdit}
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-ink-200 text-ink-600 hover:border-brand-300 hover:text-brand-700 transition-colors"
              title="Edit"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-ink-200 text-ink-400 hover:border-rose-300 hover:text-rose-600 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
      {/* Early full settlement — collect the remaining balance in one go and mature the fund */}
      {canSettle && fund.status === 'active' && remaining > 0 && (
        <button
          onClick={onSettle}
          className="mt-2 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-sm font-semibold transition-colors"
        >
          <CheckCircle2 className="w-4 h-4" /> Settle in full · {formatCurrency(remaining)} left
        </button>
      )}
      {canCollect && !canSettle && fund.status === 'active' && remaining > 0 && (
        <p className="text-[11px] text-ink-400 mt-2 text-center">{formatCurrency(remaining)} remaining to maturity</p>
      )}
    </div>
  );
}

function FundForm({
  customers, editFund, onClose, onSaved,
}: {
  customers: Customer[];
  editFund: Fund | null;
  onClose: () => void;
  onSaved: (customerName: string, edited: boolean) => void;
}) {
  const isEdit = !!editFund;
  const [customerId, setCustomerId] = useState(editFund?.customer_id ?? '');
  const [custSearch, setCustSearch] = useState('');
  const [weeklyAmt, setWeeklyAmt] = useState(String(editFund?.weekly_amount ?? '100'));
  const [weeks, setWeeks] = useState(String(editFund?.weeks ?? '50'));
  const [bonus, setBonus] = useState(String(editFund?.bonus ?? '1000'));
  const [startDate, setStartDate] = useState(editFund?.start_date?.slice(0, 10) ?? todayISO());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountN = parseFloat(weeklyAmt) || 0;
  const weeksN = parseInt(weeks) || 0;
  const bonusN = parseFloat(bonus) || 0;
  const deposit = amountN * weeksN;
  const total = deposit + bonusN;

  const filteredCustomers = useMemo(() => {
    const q = custSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => c.full_name.toLowerCase().includes(q));
  }, [customers, custSearch]);

  const maturity = useMemo(() => {
    if (!startDate || weeksN <= 0) return null;
    const d = new Date(startDate);
    d.setDate(d.getDate() + weeksN * 7); // weeks → days
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }, [startDate, weeksN]);

  async function save() {
    setError(null);
    const c = customers.find((x) => x.id === customerId);
    if (!c) { setError('Please select a customer.'); return; }
    if (amountN <= 0 || weeksN <= 0) { setError('Enter a valid weekly amount and number of weeks.'); return; }
    setSaving(true);
    const fields = {
      customer_id: c.id,
      customer_name: c.full_name,
      weekly_amount: amountN,
      weeks: weeksN,
      bonus: bonusN,
      deposit_amount: deposit,
      total_amount: total,
      start_date: startDate,
      maturity_date: maturity,
    };
    let err;
    if (isEdit && editFund) {
      ({ error: err } = await supabase.from('funds').update(fields).eq('id', editFund.id));
    } else {
      ({ error: err } = await supabase.from('funds').insert({
        ...fields, fund_number: newFundNumber(), collected_amount: 0, status: 'active',
      }));
    }
    setSaving(false);
    if (err) { setError(err.message || 'Could not save the fund. Please try again.'); return; }
    onSaved(c.full_name, isEdit);
  }

  return (
    <ModalShell
      title={isEdit ? 'Edit Fund' : 'Add Fund'}
      subtitle="Weekly-deposit savings scheme"
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{isEdit ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}{isEdit ? 'Save Changes' : 'Create Fund'}</>}
          </button>
        </>
      }
    >
      {error && <FormError text={error} />}

      <div>
        <label className="label">Customer</label>
        {customers.length > 8 && (
          <div className="flex items-center gap-2 mb-2 bg-ink-100 rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-ink-400" />
            <input value={custSearch} onChange={(e) => setCustSearch(e.target.value)} placeholder="Search customers…" className="flex-1 bg-transparent text-sm outline-none placeholder-ink-400" />
          </div>
        )}
        <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">Select a customer…</option>
          {filteredCustomers.map((c) => (
            <option key={c.id} value={c.id}>{c.full_name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <IconField label="Weekly Amount" icon={Coins}>
          <input className="input pl-10" inputMode="numeric" value={weeklyAmt} onChange={(e) => setWeeklyAmt(e.target.value)} placeholder="100" />
        </IconField>
        <IconField label="Number of Weeks" icon={Calendar}>
          <input className="input pl-10" inputMode="numeric" value={weeks} onChange={(e) => setWeeks(e.target.value)} placeholder="50" />
        </IconField>
        <IconField label="Maturity Bonus" icon={Gift}>
          <input className="input pl-10" inputMode="numeric" value={bonus} onChange={(e) => setBonus(e.target.value)} placeholder="1000" />
        </IconField>
        <div>
          <label className="label">Start Date</label>
          <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
      </div>

      <div className="rounded-2xl border border-ink-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-ink-50 text-sm">
          <span className="text-ink-500">Deposited ({formatCurrency(amountN)} × {weeksN} weeks)</span>
          <span className="font-semibold text-ink-800">{formatCurrency(deposit)}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-2.5 text-sm border-t border-ink-100">
          <span className="text-ink-500">Maturity bonus</span>
          <span className="font-semibold text-amber-700">+ {formatCurrency(bonusN)}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3 bg-emerald-50 border-t border-emerald-100">
          <span className="text-sm font-semibold text-emerald-700">Total maturity payout</span>
          <span className="text-lg font-extrabold text-emerald-800">{formatCurrency(total)}</span>
        </div>
      </div>
      {maturity && <p className="text-xs text-ink-400 text-center">Matures on {formatDate(maturity)}</p>}
    </ModalShell>
  );
}

function CollectModal({
  fund, agentId, agentName, onClose, onSaved,
}: {
  fund: Fund;
  agentId: string | null;
  agentName: string | null;
  onClose: () => void;
  onSaved: (amount: number) => void;
}) {
  const target = depositTarget(fund);
  const remaining = Math.max(0, target - Number(fund.collected_amount));
  const [amount, setAmount] = useState(String(Math.min(Number(fund.weekly_amount), remaining) || fund.weekly_amount));
  const [method, setMethod] = useState<FundPayment['payment_method']>('cash');
  const [payDate, setPayDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amt = parseFloat(amount) || 0;

  async function save() {
    setError(null);
    if (amt <= 0) { setError('Enter a valid amount.'); return; }
    if (amt > remaining) { setError(`Only ${formatCurrency(remaining)} left to fully fund this deposit.`); return; }
    setSaving(true);
    const newCollected = Number(fund.collected_amount) + amt;
    const matured = newCollected >= target; // deposit complete → matured; bonus credited at payout
    // 1) Update the fund's running total + status.
    const { error: err } = await supabase.from('funds').update({
      collected_amount: newCollected,
      status: matured ? 'matured' : fund.status,
    }).eq('id', fund.id);
    if (err) { setSaving(false); setError(err.message || 'Could not record the collection.'); return; }
    // 2) Write the passbook entry (one row per collection).
    const weekNo = fund.weekly_amount > 0
      ? Math.min(Math.floor(Number(fund.collected_amount) / Number(fund.weekly_amount)) + 1, Number(fund.weeks))
      : 0;
    const { error: pErr } = await supabase.from('fund_payments').insert({
      fund_id: fund.id,
      fund_number: fund.fund_number,
      customer_id: fund.customer_id,
      customer_name: fund.customer_name,
      week_no: weekNo,
      amount: amt,
      balance_after: newCollected,
      payment_method: method,
      payment_date: payDate,
      agent_id: agentId,
      agent_name: agentName,
    });
    setSaving(false);
    if (pErr) { setError(pErr.message || 'Collection saved, but the passbook entry failed.'); return; }
    onSaved(amt);
  }

  return (
    <ModalShell
      title="Record Collection"
      subtitle={`${fund.fund_number} · ${fund.customer_name ?? ''}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><HandCoins className="w-4 h-4" /> Record</>}
          </button>
        </>
      }
    >
      {error && <FormError text={error} />}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-ink-50 p-3">
          <p className="text-[11px] text-ink-400 uppercase tracking-wide">Collected</p>
          <p className="text-base font-bold text-ink-800 mt-0.5">{formatCurrency(fund.collected_amount)}</p>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3">
          <p className="text-[11px] text-emerald-500 uppercase tracking-wide">Remaining</p>
          <p className="text-base font-bold text-emerald-700 mt-0.5">{formatCurrency(remaining)}</p>
        </div>
      </div>
      <IconField label="Collection Amount" icon={Coins}>
        <input className="input pl-10" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(fund.weekly_amount)} />
      </IconField>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Payment Method</label>
          <select className="input capitalize" value={method} onChange={(e) => setMethod(e.target.value as FundPayment['payment_method'])}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m} className="capitalize">{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Payment Date</label>
          <input type="date" className="input" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
        </div>
      </div>
      <p className="text-xs text-ink-400">Adds to the fund's collected total and records a passbook entry. Auto-marks the fund matured when the payout is fully collected.</p>
    </ModalShell>
  );
}

function SettleModal({
  fund, agentId, agentName, onClose, onSaved,
}: {
  fund: Fund;
  agentId: string | null;
  agentName: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const target = depositTarget(fund);
  const collected = Number(fund.collected_amount);
  const remaining = Math.max(0, target - collected);
  const bonus = Number(fund.bonus);
  const payout = Number(fund.total_amount);
  const [method, setMethod] = useState<FundPayment['payment_method']>('cash');
  const [payDate, setPayDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setSaving(true);
    // 1) Mature the fund — collected reaches the full deposit target.
    const { error: err } = await supabase.from('funds')
      .update({ collected_amount: target, status: 'matured' })
      .eq('id', fund.id);
    if (err) { setSaving(false); setError(err.message || 'Could not settle the fund.'); return; }
    // 2) Record the settlement lump in the passbook (if any balance was left).
    if (remaining > 0) {
      const { error: pErr } = await supabase.from('fund_payments').insert({
        fund_id: fund.id,
        fund_number: fund.fund_number,
        customer_id: fund.customer_id,
        customer_name: fund.customer_name,
        week_no: Number(fund.weeks),
        amount: remaining,
        balance_after: target,
        payment_method: method,
        payment_date: payDate,
        agent_id: agentId,
        agent_name: agentName,
        notes: 'Full settlement (early closure)',
      });
      if (pErr) { setSaving(false); setError(pErr.message || 'Settled, but passbook entry failed.'); return; }
    }
    setSaving(false);
    onSaved();
  }

  return (
    <ModalShell
      title="Settle Fund in Full"
      subtitle={`${fund.fund_number} · ${fund.customer_name ?? ''}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Settle Now</>}
          </button>
        </>
      }
    >
      {error && <FormError text={error} />}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-ink-50 p-3">
          <p className="text-[11px] text-ink-400 uppercase tracking-wide">Deposited</p>
          <p className="text-base font-bold text-ink-800 mt-0.5">{formatCurrency(collected)}</p>
        </div>
        <div className="rounded-xl bg-amber-50 p-3">
          <p className="text-[11px] text-amber-500 uppercase tracking-wide">Remaining to settle</p>
          <p className="text-base font-bold text-amber-700 mt-0.5">{formatCurrency(remaining)}</p>
        </div>
      </div>

      {remaining > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Payment Method</label>
            <select className="input capitalize" value={method} onChange={(e) => setMethod(e.target.value as FundPayment['payment_method'])}>
              {PAYMENT_METHODS.map((m) => (<option key={m} value={m} className="capitalize">{m}</option>))}
            </select>
          </div>
          <div>
            <label className="label">Settlement Date</label>
            <input type="date" className="input" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-ink-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 text-sm">
          <span className="text-ink-500">Total deposit</span>
          <span className="font-semibold text-ink-800">{formatCurrency(target)}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-2.5 text-sm border-t border-ink-100">
          <span className="text-ink-500 flex items-center gap-1"><Gift className="w-3.5 h-3.5 text-amber-500" /> Maturity bonus</span>
          <span className="font-semibold text-amber-700">+ {formatCurrency(bonus)}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3 bg-emerald-50 border-t border-emerald-100">
          <span className="text-sm font-semibold text-emerald-700">Payout to customer</span>
          <span className="text-lg font-extrabold text-emerald-800">{formatCurrency(payout)}</span>
        </div>
      </div>
      <p className="text-xs text-ink-400">
        Collects the remaining balance now, credits the full bonus, and marks the fund matured — even though all {fund.weeks} weeks aren't finished.
      </p>
    </ModalShell>
  );
}

function PassbookModal({ fund, onClose }: { fund: Fund; onClose: () => void }) {
  const [rows, setRows] = useState<FundPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('fund_payments').select('*')
        .eq('fund_id', fund.id)
        .order('week_no', { ascending: true })
        .order('created_at', { ascending: true });
      if (!active) return;
      setRows((data ?? []) as FundPayment[]);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [fund.id]);

  const collected = Number(fund.collected_amount);
  const target = depositTarget(fund);
  const bonus = Number(fund.bonus);
  const payout = Number(fund.total_amount);
  const remaining = Math.max(0, target - collected);
  const paidWeeks = rows.length;
  const depositDone = collected >= target - 0.01;
  const bonusCredited = fund.status === 'matured' || depositDone;

  // Remaining weekly deposits and the date each one is due (start + (week-1)×7 days).
  const startBase = fund.start_date ? parseISODate(fund.start_date) : null;
  const today0 = new Date();
  today0.setHours(0, 0, 0, 0);
  const upcoming: { week: number; date: Date; overdue: boolean }[] = [];
  if (startBase && !bonusCredited) {
    for (let w = paidWeeks + 1; w <= Number(fund.weeks); w++) {
      const d = new Date(startBase);
      d.setDate(d.getDate() + (w - 1) * 7);
      upcoming.push({ week: w, date: d, overdue: d < today0 });
    }
  }
  const nextDue = upcoming[0] ?? null;
  const hasAnything = rows.length > 0 || upcoming.length > 0 || (bonusCredited && bonus > 0);

  return (
    <ModalShell
      title="Passbook"
      subtitle={`${fund.fund_number}${fund.customer_name ? ' · ' + fund.customer_name : ''}`}
      onClose={onClose}
      footer={<button className="btn-primary" onClick={onClose}>Close</button>}
    >
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-emerald-50 p-3">
          <p className="text-[10px] text-emerald-500 uppercase tracking-wide">Deposited</p>
          <p className="text-sm font-bold text-emerald-700 mt-0.5">{formatCurrency(collected)}</p>
        </div>
        <div className="rounded-xl bg-ink-50 p-3">
          <p className="text-[10px] text-ink-400 uppercase tracking-wide">To Deposit</p>
          <p className="text-sm font-bold text-ink-800 mt-0.5">{formatCurrency(remaining)}</p>
        </div>
        <div className="rounded-xl bg-brand-50 p-3">
          <p className="text-[10px] text-brand-500 uppercase tracking-wide">Entries</p>
          <p className="text-sm font-bold text-brand-700 mt-0.5">{paidWeeks} / {fund.weeks}</p>
        </div>
      </div>

      {/* Payout breakdown: deposit + bonus credited only at settlement */}
      <div className="rounded-2xl border border-ink-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 text-sm">
          <span className="text-ink-500">Total deposit ({formatCurrency(fund.weekly_amount)} × {fund.weeks} weeks)</span>
          <span className="font-semibold text-ink-800">{formatCurrency(target)}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-2.5 text-sm border-t border-ink-100">
          <span className="text-ink-500 flex items-center gap-1"><Gift className="w-3.5 h-3.5 text-amber-500" /> Maturity bonus {bonusCredited ? '' : '(at settlement)'}</span>
          <span className="font-semibold text-amber-700">+ {formatCurrency(bonus)}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3 bg-emerald-50 border-t border-emerald-100">
          <span className="text-sm font-semibold text-emerald-700">Maturity payout</span>
          <span className="text-lg font-extrabold text-emerald-800">{formatCurrency(payout)}</span>
        </div>
      </div>

      {/* Next deposit due */}
      {nextDue && (
        <div className={`flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm ${nextDue.overdue ? 'bg-rose-50 border-rose-100' : 'bg-blue-50 border-blue-100'}`}>
          <span className={`font-medium flex items-center gap-1.5 ${nextDue.overdue ? 'text-rose-700' : 'text-blue-700'}`}>
            <Calendar className="w-4 h-4" /> {nextDue.overdue ? 'Deposit overdue' : 'Next deposit due'} · Week {nextDue.week}
          </span>
          <span className={`font-bold ${nextDue.overdue ? 'text-rose-800' : 'text-blue-800'}`}>
            {formatDate(toISODateLocal(nextDue.date))} ({weekdayShort(nextDue.date)}) · {formatCurrency(fund.weekly_amount)}
          </span>
        </div>
      )}

      {loading ? (
        <div className="py-10 flex flex-col items-center justify-center">
          <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
          <p className="text-sm text-ink-500 mt-2">Loading passbook…</p>
        </div>
      ) : !hasAnything ? (
        <EmptyState
          icon={Inbox}
          title="No payments yet"
          description="Collections recorded against this fund will appear here as passbook entries."
        />
      ) : (
        <div className="rounded-2xl border border-ink-100 overflow-hidden">
          <div className="grid grid-cols-[auto_1fr_auto] gap-x-3 px-4 py-2 bg-ink-50 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
            <span>Wk</span>
            <span>Date · Method</span>
            <span className="text-right">Amount · Balance</span>
          </div>
          <div className="divide-y divide-ink-100 max-h-[46vh] overflow-y-auto">
            {rows.map((p) => (
              <div key={p.id} className="grid grid-cols-[auto_1fr_auto] gap-x-3 items-center px-4 py-2.5">
                <span className="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 text-xs font-bold flex items-center justify-center">
                  {p.week_no || '—'}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink-800">{p.payment_date ? formatDate(p.payment_date) : formatDate(p.created_at)}</p>
                  <p className="text-[11px] text-ink-400 capitalize">
                    {p.payment_method}{p.agent_name ? ` · ${p.agent_name}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-700">+ {formatCurrency(p.amount)}</p>
                  <p className="text-[11px] text-ink-400">Bal {formatCurrency(p.balance_after)}</p>
                </div>
              </div>
            ))}

            {/* Maturity bonus — credited on top of deposits at settlement */}
            {bonusCredited && bonus > 0 && (
              <div className="grid grid-cols-[auto_1fr_auto] gap-x-3 items-center px-4 py-2.5 bg-amber-50">
                <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                  <Gift className="w-3.5 h-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-amber-800">Maturity bonus</p>
                  <p className="text-[11px] text-amber-500">{fund.maturity_date ? formatDate(fund.maturity_date) : 'At settlement'} · credited</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-amber-700">+ {formatCurrency(bonus)}</p>
                  <p className="text-[11px] text-ink-400">Bal {formatCurrency(payout)}</p>
                </div>
              </div>
            )}

            {/* Remaining weekly deposits — due date for each pending week */}
            {upcoming.map((u) => {
              const isNext = u.week === paidWeeks + 1;
              const statusText = u.overdue ? 'Overdue' : isNext ? 'Next due' : 'Upcoming';
              const statusClass = u.overdue ? 'text-rose-500' : isNext ? 'text-blue-500' : 'text-ink-400';
              return (
                <div key={`u-${u.week}`} className="grid grid-cols-[auto_1fr_auto] gap-x-3 items-center px-4 py-2.5 bg-ink-50/40">
                  <span className="w-7 h-7 rounded-lg border border-dashed border-ink-300 text-ink-400 text-xs font-bold flex items-center justify-center">
                    {u.week}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-600">{formatDate(toISODateLocal(u.date))} ({weekdayShort(u.date)})</p>
                    <p className={`text-[11px] font-medium ${statusClass}`}>{statusText}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-ink-400">{formatCurrency(fund.weekly_amount)}</p>
                    <p className="text-[11px] text-ink-300">Pending</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </ModalShell>
  );
}

function ConfirmDialog({
  title, message, confirmLabel, onCancel, onConfirm,
}: {
  title: string; message: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 animate-scale-in">
        <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
          <Trash2 className="w-5 h-5" />
        </div>
        <p className="font-bold text-ink-900">{title}</p>
        <p className="text-sm text-ink-500 mt-1">{message}</p>
        <div className="flex items-center justify-end gap-2 mt-5">
          <button className="btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
          <button
            className="btn bg-rose-600 text-white hover:bg-rose-700"
            onClick={() => { setBusy(true); onConfirm(); }}
            disabled={busy}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- small shared bits ----
function ModalShell({
  title, subtitle, onClose, footer, children,
}: {
  title: string; subtitle?: string; onClose: () => void; footer: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[92vh] flex flex-col animate-scale-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
              <PiggyBank className="w-[18px] h-[18px]" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-ink-900 leading-tight truncate">{title}</p>
              {subtitle && <p className="text-xs text-ink-400 truncate">{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl hover:bg-ink-100 text-ink-400 flex items-center justify-center shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4 overflow-y-auto">{children}</div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-ink-100">{footer}</div>
      </div>
    </div>
  );
}

function IconField({ label, icon: Icon, children }: { label: string; icon: typeof Coins; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ink-400 pointer-events-none" />
        {children}
      </div>
    </div>
  );
}

function FormError({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-3.5 py-2.5">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

function SummaryTile({
  label, value, icon: Icon, tone,
}: {
  label: string; value: string; icon: typeof PiggyBank; tone: 'brand' | 'emerald' | 'violet' | 'amber';
}) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600 ring-brand-100',
    emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    violet: 'bg-violet-50 text-violet-600 ring-violet-100',
    amber: 'bg-amber-50 text-amber-600 ring-amber-100',
  } as const;
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ring-1 shrink-0 ${tones[tone]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500 truncate">{label}</p>
        <p className="text-base sm:text-lg font-bold text-ink-900 truncate">{value}</p>
      </div>
    </div>
  );
}
