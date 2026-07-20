import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Banknote, Wallet, Smartphone, HandCoins, Plus, X, Loader2, Check,
  AlertCircle, RefreshCw, Calendar, CheckCircle2, Clock, Users, Coins,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../auth';
import { formatCurrency, formatDate } from '../calc';
import { PageHeader, EmptyState, Badge } from '../components/ui';
import type { Handover, Collection, Profile, FundPayment } from '../types';

function todayISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// One agent's running settlement position.
interface AgentTally {
  agentId: string;
  agentName: string;
  collected: number;
  cashCollected: number;
  onlineCollected: number;
  handedOver: number;
  pending: number;
  todayCollected: number;   // collected today (loans + funds)
  todayCash: number;
  todayOnline: number;
}

// Collected = loan collections + fund deposits the agent collected (both must be settled).
function tallyFor(
  cols: Collection[],
  fps: FundPayment[],
  hos: Handover[],
  agentId: string,
  agentName: string,
): AgentTally {
  const colTotal = cols.reduce((s, c) => s + Number(c.collection_amount || 0), 0);
  const fundTotal = fps.reduce((s, f) => s + Number(f.amount || 0), 0);
  const collected = colTotal + fundTotal;
  const cashCollected =
    cols.filter((c) => c.payment_method === 'cash').reduce((s, c) => s + Number(c.collection_amount || 0), 0) +
    fps.filter((f) => f.payment_method === 'cash').reduce((s, f) => s + Number(f.amount || 0), 0);
  const handedOver = hos.reduce((s, h) => s + Number(h.total_amount || 0), 0);

  // Today's slice (loans by collection_date, funds by payment_date).
  const today = todayISO();
  const todayCols = cols.filter((c) => (c.collection_date ?? '').slice(0, 10) === today);
  const todayFps = fps.filter((f) => (f.payment_date ?? '').slice(0, 10) === today);
  const todayCollected =
    todayCols.reduce((s, c) => s + Number(c.collection_amount || 0), 0) +
    todayFps.reduce((s, f) => s + Number(f.amount || 0), 0);
  const todayCash =
    todayCols.filter((c) => c.payment_method === 'cash').reduce((s, c) => s + Number(c.collection_amount || 0), 0) +
    todayFps.filter((f) => f.payment_method === 'cash').reduce((s, f) => s + Number(f.amount || 0), 0);

  return {
    agentId,
    agentName,
    collected,
    cashCollected,
    onlineCollected: collected - cashCollected,
    handedOver,
    pending: Math.max(0, collected - handedOver),
    todayCollected,
    todayCash,
    todayOnline: todayCollected - todayCash,
  };
}

export default function HandoversScreen() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const isAgent = profile?.role === 'agent';

  const [handovers, setHandovers] = useState<Handover[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [fundPayments, setFundPayments] = useState<FundPayment[]>([]);
  const [agents, setAgents] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const activeRef = useRef(true);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    if (isAgent && profile?.id) {
      const [colRes, fpRes, hoRes] = await Promise.all([
        supabase.from('collections').select('*').eq('agent_id', profile.id),
        supabase.from('fund_payments').select('*').eq('agent_id', profile.id),
        supabase.from('handovers').select('*').eq('agent_id', profile.id).order('created_at', { ascending: false }),
      ]);
      if (!activeRef.current) return;
      setCollections((colRes.data ?? []) as Collection[]);
      setFundPayments((fpRes.data ?? []) as FundPayment[]);
      setHandovers((hoRes.data ?? []) as Handover[]);
    } else if (isAdmin) {
      const [colRes, fpRes, hoRes, agRes] = await Promise.all([
        supabase.from('collections').select('*'),
        supabase.from('fund_payments').select('*'),
        supabase.from('handovers').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').eq('role', 'agent'),
      ]);
      if (!activeRef.current) return;
      setCollections((colRes.data ?? []) as Collection[]);
      setFundPayments((fpRes.data ?? []) as FundPayment[]);
      setHandovers((hoRes.data ?? []) as Handover[]);
      setAgents((agRes.data ?? []) as Profile[]);
    }
    setLoading(false);
    setRefreshing(false);
  }, [isAgent, isAdmin, profile?.id]);

  useEffect(() => {
    activeRef.current = true;
    load();
    const timer = setInterval(() => load(true), 30000);
    return () => { activeRef.current = false; clearInterval(timer); };
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // My own tally (agent).
  const mine = useMemo<AgentTally>(
    () => tallyFor(collections, fundPayments, handovers, profile?.id ?? '', profile?.full_name ?? ''),
    [collections, fundPayments, handovers, profile],
  );

  // Per-agent tallies (admin).
  const tallies = useMemo<AgentTally[]>(() => {
    if (!isAdmin) return [];
    return agents
      .map((a) => tallyFor(
        collections.filter((c) => c.agent_id === a.id),
        fundPayments.filter((f) => f.agent_id === a.id),
        handovers.filter((h) => h.agent_id === a.id),
        a.id,
        a.full_name,
      ))
      .sort((x, y) => y.pending - x.pending);
  }, [isAdmin, agents, collections, fundPayments, handovers]);

  const adminTotals = useMemo(() => {
    const collected = tallies.reduce((s, t) => s + t.collected, 0);
    const handedOver = tallies.reduce((s, t) => s + t.handedOver, 0);
    const pending = tallies.reduce((s, t) => s + t.pending, 0);
    const todayCollected = tallies.reduce((s, t) => s + t.todayCollected, 0);
    const withPending = tallies.filter((t) => t.pending > 0.5).length;
    return { collected, handedOver, pending, todayCollected, withPending };
  }, [tallies]);

  async function verify(h: Handover) {
    await supabase.from('handovers').update({ status: 'verified', received_by: profile?.id ?? null }).eq('id', h.id);
    setToast(`Handover of ${formatCurrency(h.total_amount)} verified.`);
    load();
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Cash Handover"
        subtitle="Agents settle collected cash & UPI to the office — pending carries forward"
        actions={
          <div className="flex items-center gap-2">
            <button className="btn-secondary" onClick={() => load(true)} disabled={refreshing} title="Refresh">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            {isAgent && (
              <button className="btn-primary" onClick={() => setFormOpen(true)}>
                <Plus className="w-4 h-4" /> Record Handover
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

      {loading ? (
        <div className="card p-16 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
          <p className="text-sm text-ink-500 mt-3">Loading handovers…</p>
        </div>
      ) : isAgent ? (
        <AgentView tally={mine} handovers={handovers} />
      ) : (
        <AdminView totals={adminTotals} tallies={tallies} handovers={handovers} onVerify={verify} />
      )}

      {formOpen && isAgent && (
        <HandoverForm
          pending={mine.pending}
          agentId={profile?.id ?? ''}
          agentName={profile?.full_name ?? ''}
          onClose={() => setFormOpen(false)}
          onSaved={(total) => {
            setFormOpen(false);
            setToast(`Handover of ${formatCurrency(total)} recorded.`);
            load();
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────── Agent view ───────────────────────────
function AgentView({ tally, handovers }: { tally: AgentTally; handovers: Handover[] }) {
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <SummaryTile label="Total Collected" value={formatCurrency(tally.collected)} icon={Coins} tone="blue"
          sub={`Today: ${formatCurrency(tally.todayCollected)}`} />
        <SummaryTile label="Handed Over" value={formatCurrency(tally.handedOver)} icon={CheckCircle2} tone="emerald" />
        <SummaryTile label="Pending to Hand Over" value={formatCurrency(tally.pending)} icon={Wallet} tone="amber" highlight />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Banknote className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Cash Collected</p>
            <p className="text-base sm:text-lg font-bold text-ink-900">{formatCurrency(tally.cashCollected)}</p>
            <p className="text-[11px] font-semibold text-emerald-600">Today: {formatCurrency(tally.todayCash)}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Online / UPI</p>
            <p className="text-base sm:text-lg font-bold text-ink-900">{formatCurrency(tally.onlineCollected)}</p>
            <p className="text-[11px] font-semibold text-violet-600">Today: {formatCurrency(tally.todayOnline)}</p>
          </div>
        </div>
      </div>

      {tally.pending > 0.5 && (
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-3">
          <Wallet className="w-4 h-4 mt-0.5 shrink-0" />
          <span>You have <b>{formatCurrency(tally.pending)}</b> still to hand over. This balance carries forward — tomorrow's collections add on top of it until you settle.</span>
        </div>
      )}

      <HandoverList handovers={handovers} showAgent={false} />
    </>
  );
}

// ─────────────────────────── Admin view ───────────────────────────
function AdminView({
  totals, tallies, handovers, onVerify,
}: {
  totals: { collected: number; handedOver: number; pending: number; todayCollected: number; withPending: number };
  tallies: AgentTally[];
  handovers: Handover[];
  onVerify: (h: Handover) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <SummaryTile label="Total Collected" value={formatCurrency(totals.collected)} icon={Coins} tone="blue"
          sub={`Today: ${formatCurrency(totals.todayCollected)}`} />
        <SummaryTile label="Handed Over" value={formatCurrency(totals.handedOver)} icon={CheckCircle2} tone="emerald" />
        <SummaryTile label="Pending" value={formatCurrency(totals.pending)} icon={Wallet} tone="amber" highlight />
        <SummaryTile label="Agents with Dues" value={String(totals.withPending)} icon={Users} tone="rose" />
      </div>

      {/* Per-agent pending */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-ink-100">
          <h3 className="text-sm font-bold text-ink-900">Agent Settlement Position</h3>
          <p className="text-xs text-ink-400">Pending = collected − handed over (runs continuously)</p>
        </div>
        {tallies.length === 0 ? (
          <EmptyState icon={Users} title="No agents" description="Agent settlement positions will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-ink-400 bg-ink-50/60">
                  <th className="px-5 py-2.5 font-semibold">Agent</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Collected</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Handed Over</th>
                  <th className="px-5 py-2.5 font-semibold text-right">Pending</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {tallies.map((t) => (
                  <tr key={t.agentId} className="hover:bg-ink-50/40">
                    <td className="px-5 py-3 font-medium text-ink-800">{t.agentName}</td>
                    <td className="px-3 py-3 text-right text-ink-600">{formatCurrency(t.collected)}</td>
                    <td className="px-3 py-3 text-right text-emerald-700">{formatCurrency(t.handedOver)}</td>
                    <td className="px-5 py-3 text-right font-bold">
                      <span className={t.pending > 0.5 ? 'text-amber-700' : 'text-ink-400'}>{formatCurrency(t.pending)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <HandoverList handovers={handovers} showAgent onVerify={onVerify} />
    </>
  );
}

// ─────────────────────────── Shared list ───────────────────────────
function HandoverList({
  handovers, showAgent, onVerify,
}: {
  handovers: Handover[];
  showAgent: boolean;
  onVerify?: (h: Handover) => void;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3.5 border-b border-ink-100">
        <h3 className="text-sm font-bold text-ink-900">Handover History</h3>
      </div>
      {handovers.length === 0 ? (
        <EmptyState icon={HandCoins} title="No handovers yet" description="Recorded handovers will appear here as a running log." />
      ) : (
        <div className="divide-y divide-ink-100 max-h-[60vh] overflow-y-auto">
          {handovers.map((h) => (
            <div key={h.id} className="flex items-center gap-3 px-5 py-3.5">
              <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                <HandCoins className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-ink-900 truncate">
                    {showAgent ? (h.agent_name ?? 'Agent') : formatCurrency(h.total_amount)}
                  </p>
                  <Badge color={h.status === 'verified' ? 'green' : 'yellow'}>{h.status}</Badge>
                </div>
                <p className="text-[11px] text-ink-400 flex items-center gap-1.5 mt-0.5">
                  <Calendar className="w-3 h-3" /> {h.handover_date ? formatDate(h.handover_date) : formatDate(h.created_at)}
                  <span className="text-ink-300">·</span>
                  <Banknote className="w-3 h-3" /> {formatCurrency(h.cash_amount)}
                  <span className="text-ink-300">·</span>
                  <Smartphone className="w-3 h-3" /> {formatCurrency(h.upi_amount)}
                </p>
                {h.notes && <p className="text-[11px] text-ink-400 mt-0.5 truncate">{h.notes}</p>}
              </div>
              <div className="text-right shrink-0">
                {showAgent && <p className="text-sm font-bold text-ink-900">{formatCurrency(h.total_amount)}</p>}
                {onVerify && h.status === 'pending' && (
                  <button
                    onClick={() => onVerify(h)}
                    className="mt-1 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Verify
                  </button>
                )}
                {h.status === 'verified' && (
                  <p className="text-[11px] text-emerald-600 flex items-center gap-1 justify-end mt-1"><CheckCircle2 className="w-3 h-3" /> Received</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── Record modal ───────────────────────────
function HandoverForm({
  pending, agentId, agentName, onClose, onSaved,
}: {
  pending: number;
  agentId: string;
  agentName: string;
  onClose: () => void;
  onSaved: (total: number) => void;
}) {
  const [cash, setCash] = useState('');
  const [upi, setUpi] = useState('');
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cashN = parseFloat(cash) || 0;
  const upiN = parseFloat(upi) || 0;
  const total = cashN + upiN;

  async function save() {
    setError(null);
    if (total <= 0) { setError('Enter a cash and/or UPI amount.'); return; }
    setSaving(true);
    const { error: err } = await supabase.from('handovers').insert({
      agent_id: agentId,
      agent_name: agentName,
      cash_amount: cashN,
      upi_amount: upiN,
      total_amount: total,
      handover_date: date,
      notes: notes.trim() || null,
      status: 'pending',
    });
    setSaving(false);
    if (err) { setError(err.message || 'Could not record the handover.'); return; }
    onSaved(total);
  }

  const remainingAfter = Math.max(0, pending - total);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[92vh] flex flex-col animate-scale-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
              <HandCoins className="w-[18px] h-[18px]" />
            </div>
            <div>
              <p className="font-bold text-ink-900 leading-tight">Record Handover</p>
              <p className="text-xs text-ink-400">Cash & UPI you are settling to the office</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl hover:bg-ink-100 text-ink-400 flex items-center justify-center shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          {error && (
            <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-3.5 py-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-between rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
            <span className="text-sm font-medium text-amber-700">Pending to hand over</span>
            <span className="text-lg font-extrabold text-amber-800">{formatCurrency(pending)}</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Cash Amount</label>
              <div className="relative">
                <Banknote className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ink-400 pointer-events-none" />
                <input className="input pl-10" inputMode="numeric" value={cash} onChange={(e) => setCash(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div>
              <label className="label">UPI / GPay Amount</label>
              <div className="relative">
                <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ink-400 pointer-events-none" />
                <input className="input pl-10" inputMode="numeric" value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="0" />
              </div>
            </div>
          </div>

          <div>
            <label className="label">Handover Date</label>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div>
            <label className="label">Notes (optional)</label>
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. denominations, remarks…" />
          </div>

          <div className="rounded-2xl border border-ink-100 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="text-ink-500">Handing over now</span>
              <span className="font-semibold text-ink-800">{formatCurrency(total)}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 bg-ink-50 border-t border-ink-100">
              <span className="text-sm font-semibold text-ink-600">Pending after this</span>
              <span className="text-base font-extrabold text-ink-900">{formatCurrency(remainingAfter)}</span>
            </div>
          </div>
          {total > pending + 0.5 && (
            <p className="text-xs text-amber-600 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" /> This is more than your current pending — double-check the amount.
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-ink-100">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Record Handover</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── Small tile ───────────────────────────
function SummaryTile({
  label, value, icon: Icon, tone, highlight, sub,
}: {
  label: string; value: string; icon: typeof Wallet; tone: 'blue' | 'emerald' | 'amber' | 'rose'; highlight?: boolean; sub?: string;
}) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600 ring-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    amber: 'bg-amber-50 text-amber-600 ring-amber-100',
    rose: 'bg-rose-50 text-rose-600 ring-rose-100',
  } as const;
  return (
    <div className={`card p-4 flex items-center gap-3 ${highlight ? 'ring-1 ring-amber-200' : ''}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ring-1 shrink-0 ${tones[tone]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500 truncate">{label}</p>
        <p className="text-base sm:text-lg font-bold text-ink-900 truncate">{value}</p>
        {sub && <p className="text-[11px] font-semibold text-emerald-600 truncate">{sub}</p>}
      </div>
    </div>
  );
}
