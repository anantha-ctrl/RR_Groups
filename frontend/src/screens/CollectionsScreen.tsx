import { useEffect, useMemo, useState, useRef } from 'react';
import { Wallet, Plus, Search, Printer, Edit, Trash2, Upload, CheckCircle2, IndianRupee, FileText, Loader2, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../auth';
import { useCompany } from '../company';
import { useAgents } from '../hooks';
import { formatCurrency, formatDate, formatDateTime } from '../calc';
import { syncScheduleFromCollections } from '../schedule';
import type { Collection, Customer, Loan, Profile } from '../types';
import { PageHeader, Modal, Field, Select, TextArea, EmptyState, ConfirmDialog, Avatar } from '../components/ui';

type PaymentMethod = 'cash' | 'upi' | 'card' | 'bank' | 'cheque';
type DateFilter = 'today' | 'week' | 'month' | 'all';

const PAYMENT_META: Record<PaymentMethod, { label: string; className: string }> = {
  cash: { label: 'Cash', className: 'bg-blue-100 text-blue-700' },
  upi: { label: 'UPI', className: 'bg-violet-100 text-violet-700' },
  card: { label: 'Card', className: 'bg-cyan-100 text-cyan-700' },
  bank: { label: 'Bank', className: 'bg-emerald-100 text-emerald-700' },
  cheque: { label: 'Cheque', className: 'bg-ink-100 text-ink-600' },
};

const DATE_RANGES: { id: DateFilter; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'all', label: 'All' },
];

const COMPANY = 'RR Groups';
const todayStr = () => new Date().toISOString().slice(0, 10);

function genReceiptNumber(existing: Collection[]): string {
  const max = existing.reduce((m, c) => {
    const n = parseInt((c.receipt_number ?? '').replace(/\D/g, ''), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 1000);
  return `RCP-${max + 1}`;
}

function inRange(dateStr: string, range: DateFilter): boolean {
  if (range === 'all') return true;
  const d = new Date(dateStr);
  const now = new Date();
  if (range === 'today') return d.toDateString() === now.toDateString();
  if (range === 'week') {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    return d >= start;
  }
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function PaymentBadge({ method }: { method: PaymentMethod }) {
  const m = PAYMENT_META[method] ?? PAYMENT_META.cheque;
  return <span className={`badge ${m.className}`}>{m.label}</span>;
}

function UploadCard({ label, icon: Icon, fileUrl, onPick, onClear, inputId }: { label: string; icon: typeof Upload; fileUrl: string | null; onPick: (f: File) => void; onClear: () => void; inputId: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <Field label={label}>
      <input id={inputId} ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); }} />
      {fileUrl ? (
        <div className="relative rounded-xl border border-ink-200 overflow-hidden group">
          <img src={fileUrl} alt={label} className="w-full h-32 object-cover" />
          <button type="button" onClick={onClear} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-ink-950/60 text-white flex items-center justify-center hover:bg-ink-950/80">
            <X className="w-4 h-4" />
          </button>
          <div className="px-3 py-2 text-xs font-semibold text-emerald-600 flex items-center gap-1.5 bg-emerald-50">
            <CheckCircle2 className="w-3.5 h-3.5" /> Uploaded
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} className="w-full h-32 rounded-xl border-2 border-dashed border-ink-200 hover:border-brand-300 hover:bg-brand-50/40 flex flex-col items-center justify-center gap-1.5 text-ink-400 hover:text-brand-600 transition-colors">
          <Icon className="w-7 h-7" />
          <span className="text-xs font-semibold">Click to upload</span>
          <span className="text-[11px] text-ink-400">PNG, JPG up to 5MB</span>
        </button>
      )}
    </Field>
  );
}

function StatMini({ label, value, count, icon: Icon, tone }: { label: string; value: string; count?: boolean; icon: typeof Wallet; tone: string }) {
  return (
    <div className="card p-4 flex items-center gap-3 animate-fade-in">
      <div className={`w-11 h-11 rounded-xl ${tone} flex items-center justify-center shrink-0`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400 truncate">{label}</p>
        <p className="text-lg font-bold text-ink-900 truncate">{count ? value : formatCurrency(Number(value) || 0)}</p>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-ink-400">{k}</span>
      <span className="font-semibold text-ink-800 text-right break-all">{v}</span>
    </div>
  );
}

function ReceiptCard({ collection }: { collection: Collection }) {
  const company = useCompany();
  const meta = [company.contact && `Ph: ${company.contact}`, company.gst && `GST: ${company.gst}`]
    .filter(Boolean).join(' · ');
  return (
    <div id="receipt-print" className="bg-white p-6 rounded-xl border border-ink-200">
      <div className="text-center pb-4 border-b border-dashed border-ink-200">
        <img
          src={company.logoUrl}
          alt={company.name}
          className="w-14 h-14 rounded-full object-cover mx-auto mb-2 ring-2 ring-brand-200"
        />
        <h2 className="text-base font-bold text-ink-900">{company.name}</h2>
        {company.address && <p className="text-[11px] text-ink-400 mt-0.5">{company.address}</p>}
        {meta && <p className="text-[11px] text-ink-400 mt-0.5">{meta}</p>}
      </div>
      <div className="flex items-center justify-between py-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-ink-400">Receipt No.</p>
          <p className="text-sm font-bold text-ink-800">{collection.receipt_number}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-ink-400">Date</p>
          <p className="text-sm font-semibold text-ink-700">{formatDateTime(collection.collection_date)}</p>
        </div>
      </div>
      <div className="space-y-2 py-3 border-y border-dashed border-ink-200 text-sm">
        <Row k="Customer" v={collection.customer_name ?? '-'} />
        <Row k="Loan Number" v={collection.loan_number ?? '-'} />
        <Row k="Payment Method" v={PAYMENT_META[collection.payment_method]?.label ?? collection.payment_method} />
        <Row k="Collected By" v={collection.agent_name ?? '-'} />
        {collection.notes && <Row k="Notes" v={collection.notes} />}
      </div>
      <div className="flex items-center justify-between py-4">
        <div className="flex items-start gap-3">
          <div className="w-20 h-20 rounded-lg border-2 border-ink-300 bg-[repeating-conic-gradient(ink-200_0_25%,transparent_0_50%)] bg-[length:10px_10px] flex items-center justify-center">
            <span className="text-[8px] text-ink-400 font-semibold bg-white px-1">QR</span>
          </div>
          <p className="text-[10px] text-ink-400 leading-tight max-w-[120px] pt-1">Scan to verify this receipt on the RR Groups portal.</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-ink-400">Amount Received</p>
          <p className="text-2xl font-extrabold text-emerald-600">{formatCurrency(Number(collection.collection_amount))}</p>
        </div>
      </div>
      <p className="text-[10px] text-ink-400 text-center pt-3 border-t border-dashed border-ink-200">
        This is a computer-generated receipt and does not require a signature. Thank you for your payment!
      </p>
    </div>
  );
}

export function CollectionsScreen({ onNavigate }: { onNavigate: (id: string) => void }) {
  const { profile } = useAuth();
  const agents = useAgents();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Collection | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receipt, setReceipt] = useState<Collection | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Collection | null>(null);
  const [form, setForm] = useState({ customer_id: '', loan_number: '', collection_amount: '', payment_method: 'cash' as PaymentMethod, collection_date: todayStr(), agent_id: '', notes: '' });
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const isAgent = profile?.role === 'agent';

  async function fetchAll() {
    setLoading(true);
    const [colRes, custRes, loanRes] = await Promise.all([
      supabase.from('collections').select('*').order('collection_date', { ascending: false }),
      supabase.from('customers').select('*'),
      supabase.from('loans').select('*'),
    ]);
    setCollections((colRes.data ?? []) as Collection[]);
    setCustomers((custRes.data ?? []) as Customer[]);
    setLoans((loanRes.data ?? []) as Loan[]);
    setLoading(false);
  }

  useEffect(() => { fetchAll(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return collections.filter((c) => {
      const matchQ = !q || (c.customer_name ?? '').toLowerCase().includes(q) || (c.loan_number ?? '').toLowerCase().includes(q) || (c.receipt_number ?? '').toLowerCase().includes(q);
      return matchQ && inRange(c.collection_date, dateFilter);
    });
  }, [collections, search, dateFilter]);

  const stats = useMemo(() => {
    const sum = (list: Collection[]) => list.reduce((s, c) => s + Number(c.collection_amount), 0);
    return {
      today: sum(collections.filter((c) => inRange(c.collection_date, 'today'))),
      week: sum(collections.filter((c) => inRange(c.collection_date, 'week'))),
      month: sum(collections.filter((c) => inRange(c.collection_date, 'month'))),
      count: collections.length,
    };
  }, [collections]);

  function openAdd() {
    setEditing(null);
    setForm({ customer_id: '', loan_number: '', collection_amount: '', payment_method: 'cash', collection_date: todayStr(), agent_id: isAgent ? profile?.id ?? '' : '', notes: '' });
    setProofUrl(null);
    setSignatureUrl(null);
    setModalOpen(true);
  }

  function openEdit(c: Collection) {
    setEditing(c);
    setForm({
      customer_id: c.customer_id ?? '',
      loan_number: c.loan_number ?? '',
      collection_amount: String(c.collection_amount ?? ''),
      payment_method: c.payment_method,
      collection_date: (c.collection_date ?? '').slice(0, 10),
      agent_id: c.agent_id ?? '',
      notes: c.notes ?? '',
    });
    setProofUrl(c.proof_url ?? null);
    setSignatureUrl(c.signature_url ?? null);
    setModalOpen(true);
  }

  const customerLoans = useMemo(() => loans.filter((l) => !form.customer_id || l.customer_id === form.customer_id), [loans, form.customer_id]);

  async function save(generateReceipt: boolean) {
    if (!form.customer_id || !form.collection_amount) return;
    setSaving(true);
    const customer = customers.find((c) => c.id === form.customer_id);
    const loan = loans.find((l) => l.loan_number === form.loan_number);
    const agentId = isAgent ? profile?.id ?? null : form.agent_id || null;
    const agent = agents.find((a) => a.id === agentId);
    const payload = {
      receipt_number: editing?.receipt_number ?? genReceiptNumber(collections),
      customer_id: form.customer_id,
      customer_name: customer?.full_name ?? null,
      loan_number: form.loan_number || null,
      loan_id: loan?.id ?? null,
      collection_amount: Number(form.collection_amount),
      payment_method: form.payment_method,
      collection_date: form.collection_date,
      agent_id: agentId,
      agent_name: agent?.full_name ?? (isAgent ? profile?.full_name ?? null : null),
      notes: form.notes || null,
      proof_url: proofUrl,
      signature_url: signatureUrl,
    };

    let saved: Collection | null = null;
    if (editing) {
      const { data, error } = await supabase.from('collections').update(payload).eq('id', editing.id).select('*').single();
      if (error) { setSaving(false); alert(error.message); return; }
      saved = data as Collection;
    } else {
      const { data, error } = await supabase.from('collections').insert(payload).select('*').single();
      if (error) { setSaving(false); alert(error.message); return; }
      saved = data as Collection;
    }

    // Keep the repayment schedule (Paid/Balance/Status) in sync with payments.
    // Re-sync the old loan too, in case an edit moved the payment to a new loan.
    const loanIds = new Set<string>();
    if (payload.loan_id) loanIds.add(payload.loan_id);
    if (editing?.loan_id) loanIds.add(editing.loan_id);
    for (const id of loanIds) await syncScheduleFromCollections(id).catch(() => {});

    await fetchAll();
    setSaving(false);
    setModalOpen(false);
    if (generateReceipt && saved) { setReceipt(saved); setReceiptOpen(true); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const loanId = deleteTarget.loan_id;
    const { error } = await supabase.from('collections').delete().eq('id', deleteTarget.id);
    if (error) { alert(error.message); return; }
    if (loanId) await syncScheduleFromCollections(loanId).catch(() => {});
    await fetchAll();
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Collections" subtitle="Record and track daily collections across all loans" actions={
        <button className="btn-primary" onClick={openAdd}><Plus className="w-4 h-4" /> Add Collection</button>
      } />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatMini label="Today's Total" value={String(stats.today)} icon={Wallet} tone="bg-emerald-50 text-emerald-600" />
        <StatMini label="This Week" value={String(stats.week)} icon={IndianRupee} tone="bg-brand-50 text-brand-600" />
        <StatMini label="This Month" value={String(stats.month)} icon={FileText} tone="bg-violet-50 text-violet-600" />
        <StatMini label="Total Records" value={String(stats.count)} count icon={CheckCircle2} tone="bg-amber-50 text-amber-600" />
      </div>

      <div className="card p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input className="input pl-9" placeholder="Search customer, loan or receipt number..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-1 bg-ink-100 rounded-xl p-1 w-fit">
            {DATE_RANGES.map((r) => (
              <button key={r.id} onClick={() => setDateFilter(r.id)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${dateFilter === r.id ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}>{r.label}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-7 h-7 text-brand-500 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Wallet} title="No collections found" description="Record your first collection to see it appear here." action={
            <button className="btn-primary" onClick={openAdd}><Plus className="w-4 h-4" /> Add Collection</button>
          } />
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr>
                  <th className="table-head">Customer</th>
                  <th className="table-head">Loan Number</th>
                  <th className="table-head">Amount</th>
                  <th className="table-head">Method</th>
                  <th className="table-head">Date</th>
                  <th className="table-head">Agent</th>
                  <th className="table-head text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-ink-50/60 transition-colors animate-fade-in">
                    <td className="table-cell">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={c.customer_name ?? '?'} size={32} />
                        <div className="min-w-0">
                          <p className="font-semibold text-ink-800 truncate">{c.customer_name ?? 'Unknown'}</p>
                          <p className="text-[11px] text-ink-400 font-mono">{c.receipt_number}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell font-mono text-ink-600">{c.loan_number ?? '-'}</td>
                    <td className="table-cell font-bold text-ink-900">{formatCurrency(Number(c.collection_amount))}</td>
                    <td className="table-cell"><PaymentBadge method={c.payment_method} /></td>
                    <td className="table-cell text-ink-600">{formatDate(c.collection_date)}</td>
                    <td className="table-cell text-ink-600">{c.agent_name ?? '-'}</td>
                    <td className="table-cell">
                      <div className="flex items-center justify-end gap-1">
                        <button title="Edit" onClick={() => openEdit(c)} className="w-8 h-8 rounded-lg hover:bg-brand-50 text-ink-500 hover:text-brand-600 flex items-center justify-center transition-colors"><Edit className="w-4 h-4" /></button>
                        <button title="Print Receipt" onClick={() => { setReceipt(c); setReceiptOpen(true); }} className="w-8 h-8 rounded-lg hover:bg-ink-100 text-ink-500 hover:text-ink-700 flex items-center justify-center transition-colors"><Printer className="w-4 h-4" /></button>
                        <button title="Delete" onClick={() => setDeleteTarget(c)} className="w-8 h-8 rounded-lg hover:bg-rose-50 text-ink-500 hover:text-rose-600 flex items-center justify-center transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-center text-xs">
        <button onClick={() => onNavigate('loans')} className="text-brand-600 hover:text-brand-700 font-semibold">View all loans →</button>
      </p>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Collection' : 'Add Collection'} size="lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Customer" required>
            <Select value={form.customer_id} onChange={(e) => setForm((f) => ({ ...f, customer_id: e.target.value, loan_number: '' }))}>
              <option value="">Select customer</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </Select>
          </Field>
          <Field label="Loan Number" hint="Linked to the selected customer">
            <Select value={form.loan_number} onChange={(e) => setForm((f) => ({ ...f, loan_number: e.target.value }))} disabled={!form.customer_id}>
              <option value="">{form.customer_id ? 'Select loan (or leave blank)' : 'Select customer first'}</option>
              {customerLoans.map((l) => <option key={l.id} value={l.loan_number}>{l.loan_number} · {formatCurrency(Number(l.loan_amount))}</option>)}
            </Select>
          </Field>
          <Field label="Amount Received" required>
            <div className="relative">
              <IndianRupee className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input type="number" min="0" step="0.01" className="input pl-9" placeholder="0" value={form.collection_amount} onChange={(e) => setForm((f) => ({ ...f, collection_amount: e.target.value }))} />
            </div>
          </Field>
          <Field label="Payment Method" required>
            <Select value={form.payment_method} onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value as PaymentMethod }))}>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="bank">Bank Transfer</option>
              <option value="cheque">Cheque</option>
            </Select>
          </Field>
          <Field label="Collection Date" required>
            <input type="date" className="input" value={form.collection_date} onChange={(e) => setForm((f) => ({ ...f, collection_date: e.target.value }))} />
          </Field>
          {!isAgent && (
            <Field label="Agent">
              <Select value={form.agent_id} onChange={(e) => setForm((f) => ({ ...f, agent_id: e.target.value }))}>
                <option value="">Select agent</option>
                {agents.map((a: Profile) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
              </Select>
            </Field>
          )}
          <div className="sm:col-span-2">
            <Field label="Notes">
              <TextArea placeholder="Any remarks about this collection..." value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </Field>
          </div>
          <UploadCard label="Payment Screenshot" icon={Upload} inputId="proof-upload" fileUrl={proofUrl} onPick={(file) => setProofUrl(URL.createObjectURL(file))} onClear={() => setProofUrl(null)} />
          <UploadCard label="Customer Signature" icon={Upload} inputId="signature-upload" fileUrl={signatureUrl} onPick={(file) => setSignatureUrl(URL.createObjectURL(file))} onClear={() => setSignatureUrl(null)} />
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6 pt-4 border-t border-ink-100">
          <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
          <button className="btn-secondary" disabled={saving || !form.customer_id || !form.collection_amount} onClick={() => save(true)}>
            <FileText className="w-4 h-4" /> Generate Receipt
          </button>
          <button className="btn-success" disabled={saving || !form.customer_id || !form.collection_amount} onClick={() => save(false)}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Save
          </button>
        </div>
      </Modal>

      <Modal open={receiptOpen} onClose={() => setReceiptOpen(false)} title="Payment Receipt" size="md">
        {receipt && (
          <>
            <div className="print-area"><ReceiptCard collection={receipt} /></div>
            <div className="flex justify-end gap-2 mt-4 no-print">
              <button className="btn-secondary" onClick={() => setReceiptOpen(false)}>Close</button>
              <button className="btn-primary" onClick={() => window.print()}><Printer className="w-4 h-4" /> Print Receipt</button>
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} title="Delete Collection" message={`Delete receipt ${deleteTarget?.receipt_number}? This action cannot be undone.`} confirmLabel="Delete" danger />

      <style>{`@media print { body * { visibility: hidden; } #receipt-print, #receipt-print * { visibility: visible; } #receipt-print { position: absolute; left: 0; top: 0; width: 100%; border: none; } }`}</style>
    </div>
  );
}

export default CollectionsScreen;
