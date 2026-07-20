import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Users,
  Phone,
  Loader2,
  Upload,
  Camera,
  Check,
  IndianRupee,
  Printer,
  PenLine,
  MapPin,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../auth';
import { useCompany } from '../company';
import {
  PageHeader,
  StatusBadge,
  EmptyState,
  Modal,
  Field,
  Select,
  TextArea,
} from '../components/ui';
import { formatCurrency, formatDate } from '../calc';
import { syncScheduleFromCollections } from '../schedule';
import type { Loan, Collection } from '../types';

interface CardState {
  visited: boolean;
  visiting?: boolean;
  proofPreview: string | null;
}

export default function AgentCollectionsScreen({ onNavigate }: { onNavigate: (id: string) => void }) {
  void onNavigate;
  const { profile } = useAuth();
  const company = useCompany();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [todayCollections, setTodayCollections] = useState<Collection[]>([]);
  const [cardState, setCardState] = useState<Record<string, CardState>>({});
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'err' } | null>(null);
  const [loading, setLoading] = useState(true);
  const [collectLoan, setCollectLoan] = useState<Loan | null>(null);
  const [receipt, setReceipt] = useState<Collection | null>(null);
  const [saving, setSaving] = useState(false);

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<Collection['payment_method']>('cash');
  const [colDate, setColDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [sigUrl, setSigUrl] = useState<string | null>(null);
  const proofInput = useRef<HTMLInputElement>(null);
  const sigInput = useRef<HTMLInputElement>(null);

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
      setLoans(loansRes.data ?? []);
      setTodayCollections(colRes.data ?? []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [profile?.id]);

  const collectedMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of todayCollections) {
      m[c.loan_id ?? ''] = (m[c.loan_id ?? ''] ?? 0) + (c.collection_amount ?? 0);
    }
    return m;
  }, [todayCollections]);

  function flash(msg: string, tone: 'ok' | 'err' = 'ok') {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3000);
  }

  // "Visit" → capture the agent's live GPS and save it as this customer's
  // map location (persisted to the DB so it shows on the Route Map).
  function captureVisit(loan: Loan) {
    if (!loan.customer_id) { flash('No customer linked to this loan', 'err'); return; }
    if (!('geolocation' in navigator)) { flash('GPS not available on this device', 'err'); return; }
    setCardState((p) => ({ ...p, [loan.id]: { ...(p[loan.id] ?? { visited: false, proofPreview: null }), visiting: true } }));
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(7));
        const lng = Number(pos.coords.longitude.toFixed(7));
        const { error } = await supabase
          .from('customers')
          .update({ latitude: lat, longitude: lng })
          .eq('id', loan.customer_id as string);
        setCardState((p) => ({
          ...p,
          [loan.id]: { ...(p[loan.id] ?? { proofPreview: null }), visiting: false, visited: !error },
        }));
        flash(error ? 'Captured, but could not save location' : 'Visit location captured & saved ✓', error ? 'err' : 'ok');
      },
      () => {
        setCardState((p) => ({ ...p, [loan.id]: { ...(p[loan.id] ?? { visited: false, proofPreview: null }), visiting: false } }));
        flash('Could not get your location — allow location access', 'err');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function openCollect(loan: Loan) {
    setCollectLoan(loan);
    setAmount(String(loan.emi ?? 0));
    setMethod('cash');
    setColDate(new Date().toISOString().slice(0, 10));
    setNotes('');
    setProofUrl(null);
    setSigUrl(null);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>, kind: 'proof' | 'sig') {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    if (kind === 'proof') setProofUrl(url);
    else setSigUrl(url);
  }

  async function generateReceipt() {
    if (!collectLoan || !profile?.id) return;
    setSaving(true);
    const rn = `RCT-${Date.now().toString().slice(-8)}`;
    const payload: Omit<Collection, 'id' | 'created_at'> = {
      receipt_number: rn,
      loan_id: collectLoan.id,
      customer_id: collectLoan.customer_id,
      customer_name: collectLoan.customer_name,
      loan_number: collectLoan.loan_number,
      collection_amount: Number(amount) || 0,
      payment_method: method,
      collection_date: colDate,
      agent_id: profile.id,
      agent_name: profile.full_name,
      notes: notes || null,
      proof_url: proofUrl,
      signature_url: sigUrl,
    };
    const { data, error } = await supabase.from('collections').insert(payload).select().single();
    setSaving(false);
    if (error) {
      alert('Failed to save collection: ' + error.message);
      return;
    }
    setTodayCollections((p) => [...p, data as Collection]);
    setCollectLoan(null);
    setReceipt(data as Collection);

    // Apply this payment to the loan's repayment schedule so Paid/Balance/Status
    // update in real time. Best-effort — the collection itself is already saved.
    syncScheduleFromCollections(payload.loan_id).catch(() => {});

    // Push-notify admins and text the standing alert number. Best-effort —
    // the collection is already saved above regardless of outcome here.
    supabase.functions
      .invoke('notify-push', {
        body: {
          title: 'Payment Collected',
          message: `${profile.full_name} collected ${formatCurrency(payload.collection_amount)} from ${payload.customer_name ?? 'a customer'} (Receipt: ${rn})`,
          target_role: 'admin',
          sms: { to: '8608180877' },
        },
      })
      .catch(() => {});
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-7 h-7 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Collections"
        subtitle={`${loans.length} customers assigned • ${todayCollections.length} collected today`}
      />

      {toast && (
        <div className={`flex items-center gap-2 text-sm rounded-xl px-4 py-3 animate-scale-in border ${
          toast.tone === 'ok'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-rose-50 border-rose-200 text-rose-700'
        }`}>
          {toast.tone === 'ok' ? <Check className="w-4 h-4 shrink-0" /> : <MapPin className="w-4 h-4 shrink-0" />}
          <span>{toast.msg}</span>
        </div>
      )}

      {loans.length === 0 && (
        <EmptyState
          icon={Users}
          title="No customers assigned today"
          description="When customers are assigned to your route, they will appear here for collection."
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {loans.map((loan) => {
          const st = cardState[loan.id] ?? { visited: false, proofPreview: null };
          const collected = collectedMap[loan.id] ?? 0;
          const done = collected >= (loan.emi ?? 0) && loan.emi > 0;
          return (
            <div
              key={loan.id}
              className="card p-4 flex flex-col gap-3 animate-slide-up hover:shadow-card-hover transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink-900 truncate">
                      {loan.customer_name ?? 'Unknown'}
                    </p>
                    <p className="text-xs text-ink-500 truncate">{loan.loan_number}</p>
                  </div>
                </div>
                <StatusBadge status={done ? 'paid' : loan.status} />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-ink-50 p-2">
                  <p className="text-ink-400">Due Amount</p>
                  <p className="font-bold text-ink-900 text-sm">
                    {formatCurrency(loan.emi || loan.outstanding_balance)}
                  </p>
                </div>
                <div className="rounded-lg bg-ink-50 p-2">
                  <p className="text-ink-400">Due Date</p>
                  <p className="font-bold text-ink-900 text-sm">{formatDate(loan.start_date)}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-ink-500">
                <Phone className="w-3.5 h-3.5" /> Contact on file
              </div>

              {collected > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-2 py-1.5">
                  <Check className="w-3.5 h-3.5" />
                  <span className="font-semibold">{formatCurrency(collected)} collected today</span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 mt-1">
                <button
                  onClick={() => openCollect(loan)}
                  className="btn-primary text-xs font-semibold py-2.5 rounded-lg flex items-center justify-center gap-1"
                >
                  <IndianRupee className="w-3.5 h-3.5" /> Collect
                </button>
                <button
                  onClick={() => captureVisit(loan)}
                  disabled={st.visiting}
                  title="Capture this customer's location"
                  className={`text-xs font-semibold py-2.5 rounded-lg flex items-center justify-center gap-1 transition-colors disabled:opacity-70 ${
                    st.visited
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-ink-100 text-ink-700 hover:bg-ink-200'
                  }`}
                >
                  {st.visiting ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : st.visited ? <Check className="w-3.5 h-3.5" />
                    : <MapPin className="w-3.5 h-3.5" />}
                  {st.visiting ? 'Locating…' : st.visited ? 'Visited' : 'Visit'}
                </button>
                <label className="bg-ink-100 text-ink-700 hover:bg-ink-200 text-xs font-semibold py-2.5 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5" /> Proof
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f)
                        setCardState((p) => ({
                          ...p,
                          [loan.id]: { ...st, proofPreview: URL.createObjectURL(f) },
                        }));
                    }}
                  />
                </label>
              </div>

              {st.proofPreview && (
                <img
                  src={st.proofPreview}
                  alt="proof"
                  className="w-full h-28 object-cover rounded-lg"
                />
              )}
            </div>
          );
        })}
      </div>

      <Modal open={!!collectLoan} onClose={() => setCollectLoan(null)} title="Collect Payment" size="lg">
        {collectLoan && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-brand-50">
              <div>
                <p className="text-xs text-brand-700 font-semibold">Customer</p>
                <p className="text-sm font-bold text-ink-900">{collectLoan.customer_name}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-brand-700 font-semibold">Loan</p>
                <p className="text-sm font-bold text-ink-900">{collectLoan.loan_number}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Amount Received" required>
                <input
                  type="number"
                  className="input"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </Field>
              <Field label="Payment Method">
                <Select value={method} onChange={(e) => setMethod(e.target.value as Collection['payment_method'])}>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                </Select>
              </Field>
              <Field label="Collection Date">
                <input type="date" className="input" value={colDate} onChange={(e) => setColDate(e.target.value)} />
              </Field>
            </div>

            <Field label="Notes">
              <TextArea
                rows={2}
                placeholder="Optional notes about this collection..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed border-ink-200 rounded-xl cursor-pointer hover:border-brand-400 hover:bg-brand-50/50 transition-all text-center">
                {proofUrl ? (
                  <img src={proofUrl} alt="payment proof" className="w-full h-20 object-cover rounded-lg" />
                ) : (
                  <>
                    <Camera className="w-6 h-6 text-ink-400" />
                    <p className="text-xs text-ink-600 font-medium">Payment Screenshot</p>
                  </>
                )}
                <input
                  ref={proofInput}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handleFile(e, 'proof')}
                />
              </label>
              <label className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed border-ink-200 rounded-xl cursor-pointer hover:border-brand-400 hover:bg-brand-50/50 transition-all text-center">
                {sigUrl ? (
                  <img src={sigUrl} alt="signature" className="w-full h-20 object-contain rounded-lg" />
                ) : (
                  <>
                    <PenLine className="w-6 h-6 text-ink-400" />
                    <p className="text-xs text-ink-600 font-medium">Customer Signature</p>
                  </>
                )}
                <input
                  ref={sigInput}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handleFile(e, 'sig')}
                />
              </label>
            </div>

            <div className="flex gap-2 pt-2 sticky bottom-0 bg-white pb-1">
              <button onClick={() => setCollectLoan(null)} className="btn-secondary flex-1 py-3">
                Cancel
              </button>
              <button
                onClick={generateReceipt}
                disabled={saving}
                className="btn-success flex-1 py-3 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Printer className="w-4 h-4" />
                )}
                Generate Receipt
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!receipt} onClose={() => setReceipt(null)} title="Payment Receipt" size="sm">
        {receipt && (
          <div className="space-y-4">
            <div className="printable border border-dashed border-ink-200 rounded-xl p-5 text-center bg-ink-50/50">
              {/* Letterhead: logo + brand + company details */}
              <div className="flex flex-col items-center gap-1.5 pb-3 mb-3 border-b border-ink-200">
                <img src={company.logoUrl} alt={company.name} className="w-14 h-14 rounded-full object-cover" />
                <p className="text-base font-extrabold text-ink-900 leading-tight">{company.name}</p>
                {company.address && <p className="text-[11px] text-ink-500 leading-snug max-w-[280px]">{company.address}</p>}
                {(company.contact || company.gst) && (
                  <p className="text-[11px] text-ink-500">
                    {company.contact && <span>Ph: {company.contact}</span>}
                    {company.contact && company.gst && <span className="text-ink-300"> · </span>}
                    {company.gst && <span>GST: {company.gst}</span>}
                  </p>
                )}
              </div>

              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-ink-900">Payment Recorded</h3>
              <p className="text-xs text-ink-500 mt-0.5">Receipt #{receipt.receipt_number}</p>
              <div className="my-4 h-px bg-ink-100" />
              <div className="space-y-2 text-left text-sm">
                <Row label="Customer" value={receipt.customer_name ?? '-'} />
                <Row label="Loan No." value={receipt.loan_number ?? '-'} />
                <Row label="Amount" value={formatCurrency(receipt.collection_amount)} highlight />
                <Row label="Method" value={receipt.payment_method.toUpperCase()} />
                <Row label="Date" value={formatDate(receipt.collection_date)} />
                <Row label="Agent" value={receipt.agent_name ?? '-'} />
              </div>
            </div>
            <div className="flex gap-2 no-print">
              <button onClick={() => setReceipt(null)} className="btn-secondary flex-1 py-3">
                Close
              </button>
              <button onClick={() => window.print()} className="btn-primary flex-1 py-3 flex items-center justify-center gap-2">
                <Printer className="w-4 h-4" /> Print
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-500 text-xs">{label}</span>
      <span className={`font-bold ${highlight ? 'text-emerald-600 text-base' : 'text-ink-900 text-xs'}`}>
        {value}
      </span>
    </div>
  );
}
