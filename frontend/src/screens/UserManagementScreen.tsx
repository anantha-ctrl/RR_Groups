import { useEffect, useMemo, useRef, useState } from 'react';
import {
  UserCog,
  Users,
  Plus,
  Search,
  Shield,
  Edit,
  Trash2,
  Loader2,
  Crown,
  UserCheck,
  UserX,
  UserPlus,
  Check,
  Upload,
  X,
} from 'lucide-react';
import { supabase, apiCall } from '../supabaseClient';
import { useAuth } from '../auth';
import { formatDate } from '../calc';
import { compressImageToDataUrl } from '../image';
import type { Profile, UserRole } from '../types';
import {
  PageHeader,
  Modal,
  Field,
  Select,
  TextArea,
  StatusBadge,
  EmptyState,
  Avatar,
  ConfirmDialog,
} from '../components/ui';

const ROLE_META: Record<UserRole, { label: string; badge: string }> = {
  admin: { label: 'Admin', badge: 'bg-cyan-100 text-cyan-700' },
  agent: { label: 'Agent', badge: 'bg-emerald-100 text-emerald-700' },
  customer: { label: 'Customer', badge: 'bg-sky-100 text-sky-700' },
};

const MODULES = [
  'Dashboard',
  'Customers',
  'Loans',
  'Collections',
  'Overdue',
  'Chit Groups',
  'Reports',
  'Settings',
  'User Mgmt',
] as const;

const PERMISSIONS: Record<string, boolean[]> = {
  Admin: [true, true, true, true, true, true, true, true, true],
  Agent: [true, true, true, true, true, false, false, false, false],
  Customer: [true, false, false, false, false, false, false, false, false],
};

type FormState = {
  full_name: string;
  email: string;
  password: string;
  mobile: string;
  address: string;
  aadhaar: string;
  pan: string;
  occupation: string;
  role: UserRole;
  status: 'active' | 'inactive';
  avatar_url: string;
};

const EMPTY_FORM: FormState = {
  full_name: '',
  email: '',
  password: '',
  mobile: '',
  address: '',
  aadhaar: '',
  pan: '',
  occupation: '',
  role: 'agent',
  status: 'active',
  avatar_url: '',
};

export default function UserManagementScreen({
  defaultRoleFilter = 'all',
}: {
  onNavigate?: (id: string) => void;
  defaultRoleFilter?: 'all' | UserRole;
}) {
  const { profile: currentProfile } = useAuth();
  const scopedToAgents = defaultRoleFilter === 'agent';
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>(defaultRoleFilter);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formInfo, setFormInfo] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);

  async function fetchProfiles() {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      setFormError(error.message);
    } else {
      setProfiles((data as Profile[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchProfiles();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return profiles.filter((p) => {
      const matchesSearch =
        !q ||
        (p.full_name ?? '').toLowerCase().includes(q) ||
        (p.mobile ?? '').toLowerCase().includes(q);
      const matchesRole = roleFilter === 'all' || p.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [profiles, search, roleFilter]);

  const stats = useMemo(() => {
    const agentList = profiles.filter((p) => p.role === 'agent');
    const monthKey = new Date().toISOString().slice(0, 7);
    return {
      total: profiles.length,
      active: profiles.filter((p) => p.status === 'active').length,
      agents: agentList.length,
      admins: profiles.filter((p) => p.role === 'admin').length,
      customers: profiles.filter((p) => p.role === 'customer').length,
      activeAgents: agentList.filter((p) => p.status === 'active').length,
      inactiveAgents: agentList.filter((p) => p.status === 'inactive').length,
      agentsThisMonth: agentList.filter((p) => (p.created_at ?? '').slice(0, 7) === monthKey).length,
    };
  }, [profiles]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormInfo('Set an email and password so this user can sign in to the app.');
    setModalOpen(true);
  }

  function openEdit(p: Profile) {
    setEditing(p);
    setForm({
      full_name: p.full_name ?? '',
      email: p.email ?? '',
      password: '',
      mobile: p.mobile ?? '',
      address: p.address ?? '',
      aadhaar: p.aadhaar ?? '',
      pan: p.pan ?? '',
      occupation: p.occupation ?? '',
      role: p.role,
      status: p.status,
      avatar_url: p.avatar_url ?? '',
    });
    setFormError(null);
    setFormInfo(null);
    setModalOpen(true);
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFormError('Please select an image file.');
      return;
    }
    setUploadingPhoto(true);
    try {
      const dataUrl = await compressImageToDataUrl(file);
      setForm((f) => ({ ...f, avatar_url: dataUrl }));
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Photo upload failed.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSave() {
    setFormError(null);
    if (!form.full_name.trim()) {
      setFormError('Full name is required.');
      return;
    }
    if (!form.email.trim()) {
      setFormError('Email is required so the user can sign in.');
      return;
    }
    if (!editing && form.password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }
    setSaving(true);

    if (editing) {
      const body: Record<string, unknown> = {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        mobile: form.mobile.trim() || null,
        address: form.address.trim() || null,
        aadhaar: form.aadhaar.trim() || null,
        pan: form.pan.trim() || null,
        occupation: form.occupation.trim() || null,
        role: form.role,
        status: form.status,
        avatar_url: form.avatar_url.trim() || null,
      };
      if (form.password) body.password = form.password;
      const { data, error } = await apiCall<Profile>(`users.php?id=${editing.id}`, { method: 'PATCH', body });
      if (error) {
        setFormError(error.message);
        setSaving(false);
        return;
      }
      setProfiles((prev) => prev.map((p) => (p.id === editing.id ? (data as Profile) : p)));
      setModalOpen(false);
      setSaving(false);
      return;
    }

    const { data, error } = await apiCall<Profile>('users.php', {
      method: 'POST',
      body: {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
        mobile: form.mobile.trim() || null,
        address: form.address.trim() || null,
        aadhaar: form.aadhaar.trim() || null,
        pan: form.pan.trim() || null,
        occupation: form.occupation.trim() || null,
        role: form.role,
        status: form.status,
        avatar_url: form.avatar_url.trim() || null,
      },
    });
    if (error) {
      setFormError(error.message);
      setSaving(false);
      return;
    }
    if (data) setProfiles((prev) => [data as Profile, ...prev]);
    setModalOpen(false);
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await supabase.from('profiles').delete().eq('id', deleteTarget.id);
    setProfiles((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    setDeleting(false);
    setDeleteTarget(null);
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={scopedToAgents ? 'Agent Management' : 'User Management'}
        subtitle={
          scopedToAgents
            ? 'Add, edit, and manage your collection agents'
            : 'Add, edit, and manage collection agents and admin accounts'
        }
        actions={
          <button className="btn-primary" onClick={openAdd}>
            <Plus className="w-4 h-4" />
            {scopedToAgents ? 'Add Agent' : 'Add User'}
          </button>
        }
      />

      <div className={`grid grid-cols-2 gap-3 sm:gap-4 mb-5 ${scopedToAgents ? 'lg:grid-cols-4' : 'lg:grid-cols-5'}`}>
        {scopedToAgents ? (
          <>
            <StatCard icon={Shield} label="Total Agents" value={stats.agents} tone="emerald" />
            <StatCard icon={UserCheck} label="Active Agents" value={stats.activeAgents} tone="green" />
            <StatCard icon={UserX} label="Inactive Agents" value={stats.inactiveAgents} tone="blue" />
            <StatCard icon={UserPlus} label="Added This Month" value={stats.agentsThisMonth} tone="cyan" />
          </>
        ) : (
          <>
            <StatCard icon={UserCog} label="Total Users" value={stats.total} tone="blue" />
            <StatCard icon={UserCheck} label="Active" value={stats.active} tone="green" />
            <StatCard icon={Shield} label="Collection Agents" value={stats.agents} tone="emerald" />
            <StatCard icon={Crown} label="Admins" value={stats.admins} tone="cyan" />
            <StatCard icon={Users} label="Customers" value={stats.customers} tone="green" />
          </>
        )}
      </div>

      <div className="card mb-5">
        <div className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className="input pl-9"
              placeholder="Search by name or mobile..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as 'all' | UserRole)}
            className="sm:w-48"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="agent">Agent</option>
            <option value="customer">Customer</option>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={UserCog}
            title="No users found"
            description="Adjust your filters or add a new user to get started."
            action={
              <button className="btn-primary" onClick={openAdd}>
                <Plus className="w-4 h-4" />
                Add User
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-ink-100 bg-ink-50/60">
                  <th className="table-head text-left">User</th>
                  <th className="table-head text-left">Mobile</th>
                  <th className="table-head text-left">Role</th>
                  <th className="table-head text-left">Status</th>
                  <th className="table-head text-left">Created</th>
                  <th className="table-head text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const isSelf = currentProfile?.id === p.id;
                  const meta = ROLE_META[p.role] ?? ROLE_META['agent'];
                  return (
                    <tr key={p.id} className="border-t border-ink-100 hover:bg-ink-50/50 transition-colors">
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <Avatar name={p.full_name || 'User'} src={p.avatar_url} size={36} />
                          <div className="min-w-0">
                            <p className="font-medium text-ink-900 truncate">
                              {p.full_name || 'Unnamed'}{isSelf && <span className="text-xs text-ink-400 font-normal"> · You</span>}
                            </p>
                            {p.email && <p className="text-xs text-ink-400 truncate">{p.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="table-cell text-ink-600">{p.mobile || '-'}</td>
                      <td className="table-cell">
                        <span className={`badge ${meta.badge}`}>{meta.label}</span>
                      </td>
                      <td className="table-cell">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="table-cell text-ink-600">{formatDate(p.created_at)}</td>
                      <td className="table-cell">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            className="btn-ghost !p-2"
                            onClick={() => openEdit(p)}
                            title="Edit user"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            className="btn-ghost !p-2 disabled:opacity-40 disabled:cursor-not-allowed"
                            onClick={() => !isSelf && setDeleteTarget(p)}
                            disabled={isSelf}
                            title={isSelf ? 'You cannot delete your own account' : 'Delete user'}
                          >
                            <Trash2 className="w-4 h-4 text-rose-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!scopedToAgents && (
        <div className="card">
          <div className="p-4 border-b border-ink-100 flex items-center gap-2">
            <Shield className="w-5 h-5 text-brand-500" />
            <div>
              <h2 className="font-semibold text-ink-900">Permissions Matrix</h2>
              <p className="text-xs text-ink-500">Role-based module access overview</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-ink-50/60">
                  <th className="table-head text-left">Role</th>
                  {MODULES.map((m) => (
                    <th key={m} className="table-head text-center whitespace-nowrap">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(PERMISSIONS).map(([role, perms]) => (
                  <tr key={role} className="border-t border-ink-100">
                    <td className="table-cell font-medium text-ink-900 whitespace-nowrap">{role}</td>
                    {perms.map((allowed, i) => (
                      <td key={i} className="table-cell text-center">
                        {allowed ? (
                          <span className="inline-flex w-6 h-6 items-center justify-center rounded-full bg-emerald-100">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          </span>
                        ) : (
                          <span className="inline-flex w-6 h-6 items-center justify-center rounded-full bg-ink-100">
                            <X className="w-3.5 h-3.5 text-ink-400" />
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editing ? 'Edit User' : 'Add User'}
        size="md"
      >
        {formInfo && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex gap-2">
            <Shield className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{formInfo}</span>
          </div>
        )}
        <div className="space-y-4">
          <Field label="Full Name" required>
            <input
              className="input"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="e.g. Priya Sharma"
            />
          </Field>
          <Field label="Mobile">
            <input
              className="input"
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value })}
              placeholder="e.g. +91 98765 43210"
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Email" required>
              <input
                type="email"
                className="input"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="user@rrgroups.in"
                autoComplete="off"
              />
            </Field>
            <Field label={editing ? 'New Password' : 'Password'} required={!editing}>
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
          <div className="grid grid-cols-2 gap-4">
            <Field label="Role">
              <Select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                disabled={scopedToAgents}
              >
                {scopedToAgents ? (
                  <option value="agent">Agent</option>
                ) : (
                  <>
                    <option value="admin">Admin</option>
                    <option value="agent">Agent</option>
                    {editing?.role === 'customer' && <option value="customer">Customer</option>}
                  </>
                )}
              </Select>
            </Field>
            <Field label="Status">
              <Select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </Field>
          </div>
          <Field label="Address">
            <TextArea
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Residential address"
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Aadhaar">
              <input
                className="input font-mono"
                value={form.aadhaar}
                onChange={(e) => setForm({ ...form, aadhaar: e.target.value })}
                placeholder="1234-5678-9012"
                maxLength={14}
              />
            </Field>
            <Field label="PAN">
              <input
                className="input font-mono uppercase"
                value={form.pan}
                onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })}
                placeholder="ABCDE1234F"
                maxLength={10}
              />
            </Field>
          </div>
          <Field label="Occupation">
            <input
              className="input"
              value={form.occupation}
              onChange={(e) => setForm({ ...form, occupation: e.target.value })}
              placeholder="e.g. Field Executive"
            />
          </Field>
          <Field label="Profile Photo">
            <div className="flex items-center gap-3">
              <Avatar name={form.full_name || 'User'} src={form.avatar_url || null} size={52} />
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <button
                  type="button"
                  className="btn-secondary text-xs !py-1.5"
                  onClick={() => photoInput.current?.click()}
                  disabled={uploadingPhoto}
                >
                  {uploadingPhoto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {uploadingPhoto ? 'Uploading…' : form.avatar_url ? 'Change Photo' : 'Upload Photo'}
                </button>
                {form.avatar_url && (
                  <button
                    type="button"
                    className="btn-ghost text-xs !py-1.5 text-rose-600 hover:bg-rose-50"
                    onClick={() => setForm((f) => ({ ...f, avatar_url: '' }))}
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

          {formError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {editing ? 'Save Changes' : 'Create Profile'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete User"
        message={`Remove ${deleteTarget?.full_name ?? 'this user'}? This deletes the profile row and may cascade to the auth user. This cannot be undone.`}
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        danger
      />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
  onClick,
}: {
  icon: typeof UserCog;
  label: string;
  value: number;
  tone: 'blue' | 'green' | 'emerald' | 'cyan';
  onClick?: () => void;
}) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    cyan: 'bg-cyan-50 text-cyan-600',
  };
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      className="card !p-4 flex items-center gap-3 text-left w-full"
      onClick={onClick}
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${tones[tone]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-ink-900 leading-none">{value}</p>
        <p className="text-xs text-ink-500 mt-1">{label}</p>
      </div>
    </Comp>
  );
}
