import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { compressImageToDataUrl } from '../image';
import { useCompany } from '../company';
import type { Settings } from '../types';
import {
  PageHeader, Field, TextArea,
} from '../components/ui';
import {
  Building2, Percent, MessageSquare, Save, Image, Loader2,
  CheckCheck, Settings as SettingsIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Tab = 'company' | 'system' | 'sms';

const EMI_FORMULA = 'P × r × (1 + r)ⁿ / ( (1 + r)ⁿ − 1 )';

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'company', label: 'Company', icon: Building2 },
  { id: 'system', label: 'System', icon: Percent },
  { id: 'sms', label: 'SMS & WhatsApp', icon: MessageSquare },
];

const EMPTY: Settings = {
  id: '',
  company_name: '',
  logo_url: null,
  address: null,
  gst_number: null,
  contact_number: null,
  interest_config: 12,
  emi_formula: EMI_FORMULA,
  sms_enabled: false,
  whatsapp_enabled: false,
  updated_at: '',
};

interface Toast {
  id: number;
  kind: 'success' | 'error';
  text: string;
}

export default function SettingsScreen({ onNavigate }: { onNavigate: (id: string) => void }) {
  const [active, setActive] = useState<Tab>('company');
  const [settings, setSettings] = useState<Settings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const { refresh: refreshCompany } = useCompany();

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (!active) return;
      if (data) {
        const s = { ...EMPTY, ...(data as Settings), emi_formula: EMI_FORMULA } as Settings;
        setSettings(s);
        setLogoPreview(s.logo_url ?? null);
      } else {
        setSettings({ ...EMPTY });
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  function pushToast(text: string, kind: Toast['kind']) {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  }

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  async function handleLogoPick(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      pushToast('Please select an image file', 'error');
      return;
    }
    try {
      // Store as a base64 data URL so the logo persists in the database
      // (a blob: URL would be discarded on reload).
      const dataUrl = await compressImageToDataUrl(file, 240, 0.85);
      setLogoPreview(dataUrl);
      update('logo_url', dataUrl);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'Logo upload failed', 'error');
    }
  }

  async function saveCompany() {
    setSaving(true);
    const payload = {
      company_name: settings.company_name,
      address: settings.address,
      gst_number: settings.gst_number,
      contact_number: settings.contact_number,
      logo_url: settings.logo_url,
    };
    const ok = await persist(payload);
    setSaving(false);
    if (ok) {
      pushToast('Company details saved', 'success');
      refreshCompany(); // update the sidebar logo & name immediately
    }
  }

  async function saveSystem() {
    setSaving(true);
    const ok = await persist({ interest_config: settings.interest_config });
    setSaving(false);
    if (ok) pushToast('System configuration saved', 'success');
  }

  async function saveSms() {
    setSaving(true);
    const ok = await persist({
      sms_enabled: settings.sms_enabled,
      whatsapp_enabled: settings.whatsapp_enabled,
    });
    setSaving(false);
    if (ok) pushToast('Communication preferences saved', 'success');
  }

  async function persist(payload: Partial<Settings>): Promise<boolean> {
    try {
      if (settings.id) {
        const { error } = await supabase
          .from('settings')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('settings')
          .insert({ ...payload, updated_at: new Date().toISOString(), emi_formula: EMI_FORMULA })
          .select('*')
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (data) setSettings((s) => ({ ...s, id: (data as Settings).id }));
      }
      return true;
    } catch {
      pushToast('Failed to save. Please try again.', 'error');
      return false;
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 items-center w-full px-4 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium text-white flex items-center gap-2 animate-slide-up ${
              t.kind === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
            }`}
          >
            {t.kind === 'success' ? <CheckCheck className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
            {t.text}
          </div>
        ))}
      </div>

      <PageHeader
        title="Settings"
        subtitle="Configure your organization, system, and communication"
      />

      <div className="card p-2 flex items-center gap-1 overflow-x-auto no-scrollbar">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={`flex-1 min-w-[130px] px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                isActive ? 'bg-brand-600 text-white shadow-sm' : 'text-ink-600 hover:bg-ink-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="card p-16 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
          <p className="text-sm text-ink-500 mt-3">Loading settings...</p>
        </div>
      ) : (
        <>
          {active === 'company' && (
            <div className="card p-5 sm:p-6 space-y-5 animate-fade-in">
              <SectionTitle icon={Building2} title="Company Profile" subtitle="Branding and business details" />

              <div className="flex flex-col sm:flex-row gap-5">
                <div className="sm:w-44 shrink-0">
                  <Field label="Company Logo">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleLogoPick(e.target.files?.[0])}
                    />
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="w-full aspect-square rounded-2xl border-2 border-dashed border-ink-200 hover:border-brand-300 hover:bg-brand-50/40 transition-colors flex flex-col items-center justify-center gap-2 overflow-hidden group"
                    >
                      {logoPreview ? (
                        <img
                          src={logoPreview}
                          alt="Logo preview"
                          className="w-full h-full object-contain p-2"
                        />
                      ) : (
                        <>
                          <div className="w-12 h-12 rounded-xl bg-ink-100 flex items-center justify-center group-hover:bg-brand-100 transition-colors">
                            <Image className="w-6 h-6 text-ink-400 group-hover:text-brand-500" />
                          </div>
                          <span className="text-xs font-medium text-ink-500 px-2 text-center">
                            Click to upload
                          </span>
                        </>
                      )}
                    </button>
                    {logoPreview && (
                      <button
                        type="button"
                        onClick={() => {
                          setLogoPreview(null);
                          update('logo_url', null);
                        }}
                        className="btn-ghost !px-3 !py-1.5 w-full mt-2 text-xs"
                      >
                        Remove logo
                      </button>
                    )}
                  </Field>
                </div>

                <div className="flex-1 space-y-4">
                  <Field label="Company Name" required>
                    <input
                      className="input"
                      placeholder="e.g. RR Groups Pvt Ltd"
                      value={settings.company_name}
                      onChange={(e) => update('company_name', e.target.value)}
                    />
                  </Field>
                  <Field label="Address">
                    <TextArea
                      placeholder="Registered business address"
                      value={settings.address ?? ''}
                      onChange={(e) => update('address', e.target.value)}
                    />
                  </Field>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="GST Number">
                      <input
                        className="input uppercase"
                        placeholder="22AAAAA0000A1Z5"
                        value={settings.gst_number ?? ''}
                        onChange={(e) => update('gst_number', e.target.value.toUpperCase())}
                      />
                    </Field>
                    <Field label="Contact Number">
                      <input
                        className="input"
                        placeholder="+91 98765 43210"
                        value={settings.contact_number ?? ''}
                        onChange={(e) => update('contact_number', e.target.value)}
                      />
                    </Field>
                  </div>
                </div>
              </div>

              <SaveBar onSave={saveCompany} saving={saving} label="Save company details" />
            </div>
          )}

          {active === 'system' && (
            <div className="card p-5 sm:p-6 space-y-5 animate-fade-in">
              <SectionTitle icon={Percent} title="System Configuration" subtitle="Interest and EMI calculation settings" />

              <Field label="Default Interest Rate (% p.a.)" hint="Applied to new loans when not overridden">
                <div className="relative">
                  <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    className="input pl-9"
                    value={settings.interest_config}
                    onChange={(e) => update('interest_config', Number(e.target.value))}
                  />
                </div>
              </Field>

              <div className="rounded-2xl border border-ink-100 bg-ink-50/60 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center">
                    <Percent className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-semibold text-ink-800">EMI Formula</h4>
                </div>
                <div className="rounded-xl bg-white border border-ink-200 p-4 text-center">
                  <code className="text-base sm:text-lg font-mono font-semibold text-brand-700 tracking-tight break-all">
                    {EMI_FORMULA}
                  </code>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 text-center">
                  <LegendItem symbol="P" desc="Principal loan amount" />
                  <LegendItem symbol="r" desc="Monthly rate (annual ÷ 12 ÷ 100)" />
                  <LegendItem symbol="n" desc="Total months (tenure)" />
                </div>
                <p className="text-xs text-ink-500 mt-3 leading-relaxed">
                  Note: EMI is computed at origination using this amortization formula. Once a loan is created, the schedule is fixed and not affected by later global changes.
                </p>
              </div>

              <SaveBar onSave={saveSystem} saving={saving} label="Save system settings" />
            </div>
          )}

          {active === 'sms' && (
            <div className="card p-5 sm:p-6 space-y-5 animate-fade-in">
              <SectionTitle icon={MessageSquare} title="SMS & WhatsApp" subtitle="Automated customer communication channels" />

              <ToggleRow
                title="SMS Notifications"
                description="Send automated EMI reminders, overdue alerts, and payment receipts to customers via SMS."
                checked={settings.sms_enabled}
                onChange={(v) => update('sms_enabled', v)}
              />
              <div className="h-px bg-ink-100" />
              <ToggleRow
                title="WhatsApp Messages"
                description="Deliver receipts and reminders through WhatsApp Business API. Requires verified WhatsApp Business account."
                checked={settings.whatsapp_enabled}
                onChange={(v) => update('whatsapp_enabled', v)}
              />

              <div className="rounded-xl bg-amber-50 border border-amber-100 p-3.5 flex gap-2.5">
                <MessageSquare className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 leading-relaxed">
                  Enabling a channel activates templates but messages will only send once your provider credentials are verified in the backend.
                </p>
              </div>

              <SaveBar onSave={saveSms} saving={saving} label="Save preferences" />
            </div>
          )}
        </>
      )}

      <button
        className="btn-ghost w-full justify-center"
        onClick={() => onNavigate('dashboard')}
      >
        <SettingsIcon className="w-4 h-4" />
        Back to dashboard
      </button>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3 pb-4 border-b border-ink-100">
      <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h3 className="text-base font-bold text-ink-900">{title}</h3>
        <p className="text-xs text-ink-500">{subtitle}</p>
      </div>
    </div>
  );
}

function LegendItem({ symbol, desc }: { symbol: string; desc: string }) {
  return (
    <div className="rounded-lg bg-white border border-ink-200 py-2 px-1">
      <p className="text-base font-mono font-bold text-brand-700">{symbol}</p>
      <p className="text-[11px] text-ink-500 mt-0.5 leading-tight">{desc}</p>
    </div>
  );
}

function SaveBar({
  onSave,
  saving,
  label,
}: {
  onSave: () => void;
  saving: boolean;
  label: string;
}) {
  return (
    <div className="flex justify-end pt-2 border-t border-ink-100">
      <button className="btn-primary" onClick={onSave} disabled={saving}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {label}
      </button>
    </div>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink-900">{title}</p>
        <p className="text-xs text-ink-500 mt-1 leading-relaxed">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`shrink-0 relative w-12 h-7 rounded-full transition-colors duration-200 flex items-center ${
          checked ? 'bg-brand-600' : 'bg-ink-200'
        }`}
      >
        <span
          className={`absolute w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}
