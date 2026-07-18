import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, UserPlus, FileSpreadsheet, Pencil, Trash2, Eye, Loader2, Users,
  Phone, MapPin, CreditCard, Briefcase, Upload, Landmark, Wallet, X,
  ChevronDown, FileText, Download, LocateFixed,
} from 'lucide-react';
import { supabase, apiCall } from '../supabaseClient';
import { geocodeAddress } from '../geocode';
import { useAgents } from '../hooks';
import type { Customer, Loan, Collection } from '../types';
import { formatCurrency, formatDate, maskAadhaar } from '../calc';
import { compressImageToDataUrl } from '../image';
import { exportData, type ExportColumn, type ExportFormat } from '../export';
import {
  PageHeader, Badge, StatusBadge, Modal, Field, Select, TextArea, Avatar,
  EmptyState, ConfirmDialog,
} from '../components/ui';

type Row = Customer & { agent_name: string };
type FormState = {
  full_name: string; mobile: string; address: string; aadhaar: string;
  pan: string; occupation: string; photo_url: string; assigned_agent: string;
  email: string; password: string; latitude: string; longitude: string;
};

const EMPTY_FORM: FormState = {
  full_name: '', mobile: '', address: '', aadhaar: '', pan: '',
  occupation: '', photo_url: '', assigned_agent: '', email: '', password: '',
  latitude: '', longitude: '',
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'closed', label: 'Closed' },
  { value: 'none', label: 'No Loan' },
];

const DOC_SLOTS = [
  { key: 'aadhaar_front', label: 'Aadhaar Front' },
  { key: 'aadhaar_back', label: 'Aadhaar Back' },
  { key: 'pan', label: 'PAN Card' },
  { key: 'photo', label: 'Photo' },
  { key: 'signature', label: 'Signature' },
];

function toForm(c: Customer): FormState {
  return {
    email: '',
    password: '',
    full_name: c.full_name ?? '',
    mobile: c.mobile ?? '',
    address: c.address ?? '',
    aadhaar: c.aadhaar ?? '',
    pan: c.pan ?? '',
    occupation: c.occupation ?? '',
    photo_url: c.photo_url ?? '',
    assigned_agent: c.assigned_agent ?? '',
    latitude: c.latitude != null ? String(c.latitude) : '',
    longitude: c.longitude != null ? String(c.longitude) : '',
  };
}

const EXPORT_COLUMNS: ExportColumn<Row>[] = [
  { header: 'Customer ID', value: (r) => r.customer_id },
  { header: 'Name', value: (r) => r.full_name },
  { header: 'Mobile', value: (r) => r.mobile ?? '' },
  { header: 'Address', value: (r) => r.address ?? '' },
  { header: 'Aadhaar', value: (r) => r.aadhaar ?? '' },
  { header: 'PAN', value: (r) => r.pan ?? '' },
  { header: 'Occupation', value: (r) => r.occupation ?? '' },
  { header: 'Loan Status', value: (r) => r.loan_status },
  { header: 'Agent', value: (r) => r.agent_name },
  { header: 'Created', value: (r) => formatDate(r.created_at) },
];

function ExportMenu({ rows }: { rows: Row[] }) {
  const [open, setOpen] = useState(false);
  const run = (format: ExportFormat) => {
    setOpen(false);
    void exportData(format, { filename: 'customers', title: 'Customers', columns: EXPORT_COLUMNS, rows }).catch(() => {});
  };
  const items: { format: ExportFormat; label: string; icon: typeof FileText }[] = [
    { format: 'pdf', label: 'PDF (.pdf)', icon: FileText },
    { format: 'excel', label: 'Excel (.xls)', icon: FileSpreadsheet },
    { format: 'csv', label: 'CSV (.csv)', icon: Download },
  ];
  return (
    <div className="relative">
      <button className="btn-secondary" onClick={() => setOpen((v) => !v)} disabled={rows.length === 0}>
        <FileSpreadsheet className="w-4 h-4" /> Export <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1.5 w-44 z-50 card !rounded-xl p-1.5 animate-scale-in">
            {items.map((it) => (
              <button
                key={it.format}
                onClick={() => run(it.format)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-ink-700 hover:bg-brand-50 hover:text-brand-700 transition-colors"
              >
                <it.icon className="w-4 h-4" /> {it.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function CustomersScreen({ onNavigate }: { onNavigate: (id: string) => void }) {
  const agents = useAgents();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [geoBusy, setGeoBusy] = useState<'idle' | 'geocoding' | 'gps'>('idle');
  const photoInput = useRef<HTMLInputElement>(null);

  const [viewing, setViewing] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'err' } | null>(null);

  const flash = (msg: string, tone: 'ok' | 'err' = 'ok') => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 2600);
  };

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCustomers((data ?? []) as Customer[]);
    } catch {
      flash('Failed to load customers', 'err');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCustomers(); /* eslint-disable-next-line */ }, []);

  // Derive rows (with resolved agent name) from customers + agents so the
  // agent column always reflects live data regardless of which loads first.
  const rows = useMemo<Row[]>(
    () => customers.map((c) => ({
      ...c,
      agent_name: agents.find((a) => a.id === c.assigned_agent)?.full_name ?? 'Unassigned',
    })),
    [customers, agents],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== 'all' && r.loan_status !== status) return false;
      if (!q) return true;
      return (
        r.full_name.toLowerCase().includes(q) ||
        (r.mobile ?? '').toLowerCase().includes(q) ||
        (r.customer_id ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, search, status]);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };
  const openEdit = async (c: Customer) => {
    setEditing(c);
    setForm(toForm(c));
    setModalOpen(true);
    // Prefill the login email if this customer already has an account.
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('customer_id', c.id)
      .eq('role', 'customer')
      .maybeSingle();
    if (data?.email) {
      setForm((f) => ({ ...f, email: data.email }));
    }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      flash('Please select an image file', 'err');
      return;
    }
    setUploadingPhoto(true);
    try {
      const dataUrl = await compressImageToDataUrl(file);
      setForm((f) => ({ ...f, photo_url: dataUrl }));
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Photo upload failed', 'err');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Look up coordinates from the typed address (free OpenStreetMap geocoder).
  const pinFromAddress = async () => {
    if (!form.address.trim()) { flash('Enter an address first', 'err'); return; }
    setGeoBusy('geocoding');
    const p = await geocodeAddress(form.address);
    setGeoBusy('idle');
    if (!p) { flash('Could not find that address on the map', 'err'); return; }
    setForm((f) => ({ ...f, latitude: p.lat.toFixed(7), longitude: p.lng.toFixed(7) }));
    flash('Location pinned from address');
  };

  // Capture the device's current GPS position (stand at the customer's door).
  const useMyGps = () => {
    if (!('geolocation' in navigator)) { flash('GPS not available on this device', 'err'); return; }
    setGeoBusy('gps');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({ ...f, latitude: pos.coords.latitude.toFixed(7), longitude: pos.coords.longitude.toFixed(7) }));
        setGeoBusy('idle');
        flash('Current location captured');
      },
      () => { setGeoBusy('idle'); flash('Could not get your location — allow location access', 'err'); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleSave = async () => {
    if (!form.full_name.trim()) { flash('Full name is required', 'err'); return; }
    // If giving app access, both email and password are needed (on create).
    if (!editing && form.email.trim() && form.password.length < 6) {
      flash('Password must be at least 6 characters', 'err'); return;
    }
    if (!editing && form.password && !form.email.trim()) {
      flash('Enter an email to create a login', 'err'); return;
    }
    setSaving(true);
    try {
      // Resolve the map location so the pin follows the address the user typed.
      // Auto-geocode when the address is set and either there are no coordinates
      // yet, or the address was changed (so it always matches). Manually kept GPS
      // coords with an unchanged address are preserved.
      let lat = form.latitude.trim() ? parseFloat(form.latitude) : null;
      let lng = form.longitude.trim() ? parseFloat(form.longitude) : null;
      const addr = form.address.trim();
      const addressChanged = !editing || (editing.address ?? '').trim() !== addr;
      if (addr && (lat == null || lng == null || addressChanged)) {
        const p = await geocodeAddress(addr);
        if (p) { lat = p.lat; lng = p.lng; }
      }
      const payload = {
        full_name: form.full_name.trim(),
        mobile: form.mobile.trim() || null,
        address: addr || null,
        aadhaar: form.aadhaar.trim() || null,
        pan: form.pan.trim() || null,
        occupation: form.occupation.trim() || null,
        photo_url: form.photo_url.trim() || null,
        assigned_agent: form.assigned_agent || null,
        email: form.email.trim() || null,
        password: form.password || null,
        latitude: lat,
        longitude: lng,
      };
      const { error } = editing
        ? await apiCall(`customers.php?id=${editing.id}`, { method: 'PATCH', body: payload })
        : await apiCall('customers.php', { method: 'POST', body: payload });
      if (error) throw new Error(error.message);
      flash(editing ? 'Customer updated' : 'Customer added');
      setModalOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      await fetchCustomers();
    } catch (e: any) {
      flash(e?.message ?? 'Save failed', 'err');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      const { error } = await supabase.from('customers').delete().eq('id', deleting.id);
      if (error) throw error;
      flash('Customer deleted');
      await fetchCustomers();
    } catch (e: any) {
      flash(e?.message ?? 'Delete failed', 'err');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Customers"
        subtitle={`${rows.length} total · ${rows.filter((r) => r.loan_status === 'active').length} active loans`}
        actions={
          <>
            <ExportMenu rows={filtered} />
            <button className="btn-primary" onClick={openAdd}>
              <UserPlus className="w-4 h-4" /> Add Customer
            </button>
          </>
        }
      />

      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              className="input pl-10"
              placeholder="Search by name, mobile, customer ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="sm:w-48">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-7 h-7 text-brand-500 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Users}
            title={rows.length === 0 ? 'No customers yet' : 'No matching customers'}
            description={rows.length === 0 ? 'Add your first customer to get started.' : 'Try adjusting your search or filter.'}
            action={rows.length === 0 ? (
              <button className="btn-primary" onClick={openAdd}>
                <UserPlus className="w-4 h-4" /> Add Customer
              </button>
            ) : undefined}
          />
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="card overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-head">Customer</th>
                    <th className="table-head">Mobile</th>
                    <th className="table-head">Address</th>
                    <th className="table-head">Aadhaar</th>
                    <th className="table-head">Loan</th>
                    <th className="table-head">Agent</th>
                    <th className="table-head">Created</th>
                    <th className="table-head text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {filtered.map((r, i) => (
                    <tr
                      key={r.id}
                      className="hover:bg-ink-50/70 transition-colors animate-fade-in"
                      style={{ animationDelay: `${Math.min(i * 30, 360)}ms` }}
                    >
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <Avatar name={r.full_name} src={r.photo_url} size={36} />
                          <div className="min-w-0">
                            <p className="font-semibold text-ink-900 truncate">{r.full_name}</p>
                            <p className="text-xs text-ink-400">{r.customer_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">{r.mobile ?? '-'}</td>
                      <td className="table-cell max-w-[180px] truncate">{r.address ?? '-'}</td>
                      <td className="table-cell font-mono text-xs">{maskAadhaar(r.aadhaar)}</td>
                      <td className="table-cell"><StatusBadge status={r.loan_status} /></td>
                      <td className="table-cell">{r.agent_name}</td>
                      <td className="table-cell">{formatDate(r.created_at)}</td>
                      <td className="table-cell">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setViewing(r)} className="w-8 h-8 rounded-lg hover:bg-brand-50 text-ink-500 hover:text-brand-600 flex items-center justify-center transition-colors" title="View">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => openEdit(r)} className="w-8 h-8 rounded-lg hover:bg-brand-50 text-ink-500 hover:text-brand-600 flex items-center justify-center transition-colors" title="Edit">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleting(r)} className="w-8 h-8 rounded-lg hover:bg-rose-50 text-ink-500 hover:text-rose-600 flex items-center justify-center transition-colors" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((r, i) => (
              <div key={r.id} className="card p-4 animate-slide-up" style={{ animationDelay: `${Math.min(i * 30, 360)}ms` }}>
                <div className="flex items-start gap-3">
                  <Avatar name={r.full_name} src={r.photo_url} size={44} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-ink-900 truncate">{r.full_name}</p>
                      <StatusBadge status={r.loan_status} />
                    </div>
                    <p className="text-xs text-ink-400">{r.customer_id}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                  <div className="flex items-center gap-1.5 text-ink-600"><Phone className="w-3.5 h-3.5 text-ink-400" />{r.mobile ?? '-'}</div>
                  <div className="flex items-center gap-1.5 text-ink-600"><MapPin className="w-3.5 h-3.5 text-ink-400" />{(r.address ?? '-').slice(0, 18)}</div>
                  <div className="flex items-center gap-1.5 text-ink-600"><CreditCard className="w-3.5 h-3.5 text-ink-400" />{maskAadhaar(r.aadhaar)}</div>
                  <div className="flex items-center gap-1.5 text-ink-600"><Briefcase className="w-3.5 h-3.5 text-ink-400" />{r.agent_name}</div>
                </div>
                <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-ink-100">
                  <button onClick={() => setViewing(r)} className="btn-ghost px-3 py-1.5 text-xs"><Eye className="w-3.5 h-3.5" /> View</button>
                  <button onClick={() => openEdit(r)} className="btn-ghost px-3 py-1.5 text-xs"><Pencil className="w-3.5 h-3.5" /> Edit</button>
                  <button onClick={() => setDeleting(r)} className="btn-ghost px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Add / Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        title={editing ? 'Edit Customer' : 'Add Customer'}
        size="lg"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Full Name" required>
            <input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="e.g. Ramesh Kumar" />
          </Field>
          <Field label="Mobile">
            <input className="input" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="10-digit number" />
          </Field>
          <Field label="Address" >
            <TextArea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Residential address" />
          </Field>
          <div className="grid grid-cols-1 gap-4">
            <Field label="Aadhaar">
              <input className="input font-mono" value={form.aadhaar} onChange={(e) => setForm({ ...form, aadhaar: e.target.value })} placeholder="1234-5678-9012" maxLength={14} />
            </Field>
            <Field label="PAN">
              <input className="input font-mono uppercase" value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} placeholder="ABCDE1234F" maxLength={10} />
            </Field>
          </div>
          <Field label="Occupation">
            <input className="input" value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })} placeholder="e.g. Businessman" />
          </Field>
          <Field label="Assigned Agent">
            <Select value={form.assigned_agent} onChange={(e) => setForm({ ...form, assigned_agent: e.target.value })}>
              <option value="">Unassigned</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.full_name}</option>
              ))}
            </Select>
          </Field>

          <div className="sm:col-span-2 rounded-xl border border-ink-100 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-ink-600 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-brand-600" /> Map Location <span className="font-normal text-ink-400">(for agent route)</span>
              </p>
              {form.latitude && form.longitude && (
                <span className="text-[11px] text-emerald-600 font-semibold">Pinned ✓</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              <button type="button" onClick={pinFromAddress} disabled={geoBusy !== 'idle'} className="btn-secondary text-xs px-3 py-2">
                {geoBusy === 'geocoding' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />} Pin from address
              </button>
              <button type="button" onClick={useMyGps} disabled={geoBusy !== 'idle'} className="btn-secondary text-xs px-3 py-2">
                {geoBusy === 'gps' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />} Use my GPS
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Latitude">
                <input className="input font-mono" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="13.0827" />
              </Field>
              <Field label="Longitude">
                <input className="input font-mono" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="80.2707" />
              </Field>
            </div>
            <p className="text-[11px] text-ink-400 mt-1.5">
              Shows this customer on the agent's live Route Map. “Pin from address” looks up the address above; “Use my GPS” captures where you're standing.
            </p>
          </div>

          <div className="sm:col-span-2 mt-1 rounded-xl border border-brand-100 bg-brand-50/50 p-3">
            <p className="text-xs font-semibold text-brand-700 mb-2 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5" /> Portal Login (optional)
            </p>
            <p className="text-[11px] text-ink-500 mb-3">
              Set an email &amp; password to let this customer sign in and view their own loans &amp; payments.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Login Email">
                <input
                  type="email"
                  className="input"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="customer@email.com"
                  autoComplete="off"
                />
              </Field>
              <Field label={editing ? 'New Password' : 'Password'}>
                <input
                  type="password"
                  className="input"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={editing ? 'Leave blank to keep current' : 'Min. 6 characters'}
                  autoComplete="new-password"
                />
              </Field>
            </div>
          </div>

          <Field label="Customer Photo">
            <div className="flex items-center gap-3">
              <Avatar name={form.full_name || 'Customer'} src={form.photo_url || null} size={52} />
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <button
                  type="button"
                  className="btn-secondary text-xs !py-1.5"
                  onClick={() => photoInput.current?.click()}
                  disabled={uploadingPhoto}
                >
                  {uploadingPhoto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {uploadingPhoto ? 'Uploading…' : form.photo_url ? 'Change Photo' : 'Upload Photo'}
                </button>
                {form.photo_url && (
                  <button
                    type="button"
                    className="btn-ghost text-xs !py-1.5 text-rose-600 hover:bg-rose-50"
                    onClick={() => setForm((f) => ({ ...f, photo_url: '' }))}
                    disabled={uploadingPhoto}
                  >
                    Remove
                  </button>
                )}
                <input
                  ref={photoInput}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoSelect}
                />
              </div>
            </div>
          </Field>
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button className="btn-secondary" onClick={() => { setModalOpen(false); setEditing(null); }}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            {editing ? 'Save Changes' : 'Add Customer'}
          </button>
        </div>
      </Modal>

      {/* View profile */}
      <CustomerProfile
        customer={viewing}
        onClose={() => setViewing(null)}
        onNavigateLoans={() => { if (viewing) onNavigate('loans'); }}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete Customer"
        message={`Are you sure you want to delete ${deleting?.full_name ?? ''}? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
      />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] animate-slide-up">
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-card-hover text-sm font-semibold ${
            toast.tone === 'ok' ? 'bg-ink-900 text-white' : 'bg-rose-600 text-white'
          }`}>
            {toast.tone === 'ok' ? <Wallet className="w-4 h-4" /> : <X className="w-4 h-4" />}
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerProfile({
  customer, onClose, onNavigateLoans,
}: {
  customer: Row | null;
  onClose: () => void;
  onNavigateLoans: () => void;
}) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!customer) return;
    setLoading(true);
    (async () => {
      try {
        const [l, c] = await Promise.all([
          supabase.from('loans').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false }),
          supabase.from('collections').select('*').eq('customer_id', customer.id).order('collection_date', { ascending: false }).limit(5),
        ]);
        setLoans((l.data ?? []) as Loan[]);
        setCollections((c.data ?? []) as Collection[]);
      } finally {
        setLoading(false);
      }
    })();
  }, [customer]);

  if (!customer) return null;

  return (
    <Modal open={!!customer} onClose={onClose} title={`Customer Profile · ${customer.customer_id}`} size="xl">
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl bg-gradient-to-br from-brand-50 to-white border border-brand-100">
            <Avatar name={customer.full_name} src={customer.photo_url} size={64} />
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-ink-900">{customer.full_name}</h3>
              <p className="text-sm text-ink-500 flex items-center gap-1.5 mt-0.5">
                <Phone className="w-3.5 h-3.5" /> {customer.mobile ?? '-'}
                <span className="mx-1">·</span>
                <Briefcase className="w-3.5 h-3.5" /> {customer.occupation ?? '-'}
              </p>
            </div>
            <StatusBadge status={customer.loan_status} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Address</p>
              <p className="text-sm text-ink-800">{customer.address ?? '-'}</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Aadhaar</p>
              <p className="text-sm text-ink-800 font-mono">{maskAadhaar(customer.aadhaar)}</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">PAN</p>
              <p className="text-sm text-ink-800 font-mono">{customer.pan ?? '-'}</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Assigned Agent</p>
              <p className="text-sm text-ink-800">{customer.agent_name}</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-3">Documents</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {DOC_SLOTS.map((d) => (
                <div key={d.key} className="group rounded-xl border-2 border-dashed border-ink-200 hover:border-brand-300 hover:bg-brand-50/40 p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all">
                  <div className="w-9 h-9 rounded-lg bg-ink-100 group-hover:bg-brand-100 text-ink-500 group-hover:text-brand-600 flex items-center justify-center mb-2 transition-colors">
                    <Upload className="w-4 h-4" />
                  </div>
                  <p className="text-xs font-semibold text-ink-600">{d.label}</p>
                  <p className="text-[10px] text-ink-400 mt-0.5">Click to upload</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Loan Information</p>
              <button onClick={onNavigateLoans} className="text-xs font-semibold text-brand-600 hover:text-brand-700">View all →</button>
            </div>
            {loans.length === 0 ? (
              <div className="rounded-xl border border-ink-100 bg-ink-50/50 py-6 text-center text-sm text-ink-400">
                No loans on record.
              </div>
            ) : (
              <div className="space-y-2">
                {loans.map((l) => (
                  <div key={l.id} className="flex items-center gap-3 p-3 rounded-xl border border-ink-100 hover:bg-ink-50/60 transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                      <Landmark className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink-800">{l.loan_number}</p>
                      <p className="text-xs text-ink-400">{l.loan_duration} mo · {formatDate(l.start_date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-ink-800">{formatCurrency(Number(l.loan_amount))}</p>
                      <Badge color={l.status === 'active' ? 'green' : l.status === 'overdue' ? 'red' : 'gray'}>{l.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-3">Recent Collections</p>
            {collections.length === 0 ? (
              <div className="rounded-xl border border-ink-100 bg-ink-50/50 py-6 text-center text-sm text-ink-400">
                No collections yet.
              </div>
            ) : (
              <div className="space-y-2">
                {collections.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-ink-50/60 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink-800 truncate">{c.receipt_number ?? '-'}</p>
                      <p className="text-xs text-ink-400 uppercase">{c.payment_method}{c.loan_number ? ` · ${c.loan_number}` : ''}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-600">{formatCurrency(Number(c.collection_amount))}</p>
                      <p className="text-[11px] text-ink-400">{formatDate(c.collection_date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
