import { useMemo, useRef, useState } from 'react';
import {
  User, Mail, Phone, MapPin, Briefcase, CreditCard, Fingerprint,
  Camera, Loader2, Check, AlertCircle, ShieldCheck, Save, Lock,
} from 'lucide-react';
import { useAuth } from '../auth';
import { apiCall } from '../supabaseClient';
import { compressImageToDataUrl } from '../image';
import { PageHeader, Avatar } from '../components/ui';
import type { Profile } from '../types';

const ROLE_LABEL: Record<Profile['role'], string> = {
  admin: 'Administrator',
  agent: 'Collection Agent',
  customer: 'Customer',
};

export default function ProfileScreen() {
  const { profile, refreshProfile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  // Details form
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [mobile, setMobile] = useState(profile?.mobile ?? '');
  const [address, setAddress] = useState(profile?.address ?? '');
  const [occupation, setOccupation] = useState(profile?.occupation ?? '');
  const [aadhaar, setAadhaar] = useState(profile?.aadhaar ?? '');
  const [pan, setPan] = useState(profile?.pan ?? '');
  const [avatar, setAvatar] = useState<string | null>(profile?.avatar_url ?? null);
  const [savingDetails, setSavingDetails] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [detailsMsg, setDetailsMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Security form
  const [email, setEmail] = useState(profile?.email ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [securityMsg, setSecurityMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const isCustomer = profile?.role === 'customer';
  const emailChanged = (email.trim().toLowerCase() || '') !== ((profile?.email ?? '').toLowerCase());

  const memberSince = useMemo(() => {
    if (!profile?.created_at) return '—';
    return new Date(profile.created_at).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }, [profile?.created_at]);

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setDetailsMsg(null);
    try {
      const dataUrl = await compressImageToDataUrl(file);
      setAvatar(dataUrl);
    } catch (err) {
      setDetailsMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not load image.' });
    } finally {
      setUploading(false);
    }
  }

  async function saveDetails() {
    if (!fullName.trim()) {
      setDetailsMsg({ ok: false, text: 'Full name is required.' });
      return;
    }
    setSavingDetails(true);
    setDetailsMsg(null);
    const { error } = await apiCall('auth.php?action=update_profile', {
      method: 'POST',
      body: {
        full_name: fullName.trim(),
        mobile: mobile.trim() || null,
        address: address.trim() || null,
        occupation: occupation.trim() || null,
        aadhaar: aadhaar.trim() || null,
        pan: pan.trim() || null,
        avatar_url: avatar,
      },
    });
    setSavingDetails(false);
    if (error) {
      setDetailsMsg({ ok: false, text: error.message || 'Failed to save. Please try again.' });
      return;
    }
    await refreshProfile();
    setDetailsMsg({ ok: true, text: 'Profile updated successfully.' });
  }

  async function saveSecurity() {
    setSecurityMsg(null);
    const wantsPassword = newPassword.length > 0 || confirmPassword.length > 0;
    if (!emailChanged && !wantsPassword) {
      setSecurityMsg({ ok: false, text: 'Nothing to update.' });
      return;
    }
    if (wantsPassword && newPassword !== confirmPassword) {
      setSecurityMsg({ ok: false, text: 'New password and confirmation do not match.' });
      return;
    }
    if (wantsPassword && newPassword.length < 6) {
      setSecurityMsg({ ok: false, text: 'New password must be at least 6 characters.' });
      return;
    }
    if (!currentPassword) {
      setSecurityMsg({ ok: false, text: 'Enter your current password to confirm changes.' });
      return;
    }
    setSavingSecurity(true);
    const body: Record<string, unknown> = { current_password: currentPassword };
    if (emailChanged) body.email = email.trim();
    if (wantsPassword) body.new_password = newPassword;
    const { error } = await apiCall('auth.php?action=update_profile', { method: 'POST', body });
    setSavingSecurity(false);
    if (error) {
      setSecurityMsg({ ok: false, text: error.message || 'Failed to update. Please try again.' });
      return;
    }
    await refreshProfile();
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setSecurityMsg({ ok: true, text: 'Security settings updated.' });
  }

  return (
    <div className="space-y-5 animate-fade-in max-w-4xl">
      <PageHeader title="My Profile" subtitle="Manage your account details and security" />

      {/* Identity banner */}
      <div className="card p-5 flex flex-col sm:flex-row items-center sm:items-start gap-5">
        <div className="relative shrink-0">
          <Avatar name={fullName || 'User'} src={avatar ?? undefined} size={88} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-brand-600 text-white flex items-center justify-center shadow-md hover:bg-brand-700 transition-colors disabled:opacity-60"
            title="Change photo"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
        </div>
        <div className="flex-1 text-center sm:text-left min-w-0">
          <h2 className="text-xl font-bold text-ink-900">{fullName || 'Unnamed User'}</h2>
          <p className="text-sm text-ink-500">{profile?.email ?? profile?.mobile ?? ''}</p>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide bg-brand-50 text-brand-700 rounded-full px-3 py-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              {profile ? ROLE_LABEL[profile.role] : ''}
            </span>
            <span className="text-xs text-ink-400">Member since {memberSince}</span>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
            <User className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-ink-900">Profile Details</h3>
        </div>

        {detailsMsg && <Notice msg={detailsMsg} />}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Full Name" icon={User}>
            <input className="input pl-10" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
          </Field>
          <Field label="Mobile Number" icon={Phone}>
            <input className="input pl-10" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="Mobile number" />
          </Field>
          <Field label="Occupation" icon={Briefcase}>
            <input className="input pl-10" value={occupation} onChange={(e) => setOccupation(e.target.value)} placeholder="Occupation" />
          </Field>
          <Field label="Aadhaar" icon={Fingerprint}>
            <input className="input pl-10" value={aadhaar} onChange={(e) => setAadhaar(e.target.value)} placeholder="Aadhaar number" />
          </Field>
          <Field label="PAN" icon={CreditCard}>
            <input className="input pl-10" value={pan} onChange={(e) => setPan(e.target.value)} placeholder="PAN number" />
          </Field>
          <Field label="Address" icon={MapPin} full>
            <textarea className="input pl-10 resize-none" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" />
          </Field>
        </div>

        <div className="flex justify-end mt-4">
          <button className="btn-primary" onClick={saveDetails} disabled={savingDetails || uploading}>
            {savingDetails ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save Changes</>}
          </button>
        </div>
        {isCustomer && (
          <p className="text-xs text-ink-400 mt-2">
            These details are visible to your loan agent and RR Groups administrators.
          </p>
        )}
      </div>

      {/* Security */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <Lock className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-ink-900">Email &amp; Password</h3>
        </div>

        {securityMsg && <Notice msg={securityMsg} />}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Email Address" icon={Mail} full>
            <input className="input pl-10" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </Field>
          <Field label="New Password" icon={Lock}>
            <input className="input pl-10" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Leave blank to keep current" autoComplete="new-password" />
          </Field>
          <Field label="Confirm New Password" icon={Lock}>
            <input className="input pl-10" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" autoComplete="new-password" />
          </Field>
          <Field label="Current Password" icon={ShieldCheck} full>
            <input className="input pl-10" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Required to change email or password" autoComplete="current-password" />
          </Field>
        </div>

        <div className="flex justify-end mt-4">
          <button className="btn-primary" onClick={saveSecurity} disabled={savingSecurity}>
            {savingSecurity ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ShieldCheck className="w-4 h-4" /> Update Security</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function Notice({ msg }: { msg: { ok: boolean; text: string } }) {
  return (
    <div
      className={`flex items-start gap-2 text-sm rounded-xl px-3.5 py-2.5 mb-4 ${
        msg.ok
          ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
          : 'bg-rose-50 border border-rose-200 text-rose-700'
      }`}
    >
      {msg.ok ? <Check className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
      <span>{msg.text}</span>
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  full,
  children,
}: {
  label: string;
  icon: typeof User;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="label">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3.5 top-3 w-[18px] h-[18px] text-ink-400 pointer-events-none" />
        {children}
      </div>
    </div>
  );
}
