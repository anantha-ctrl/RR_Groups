import { useEffect, useMemo, useState } from 'react';
import {
  Group as GroupIcon,
  Plus,
  Search,
  Users,
  IndianRupee,
  TrendingUp,
  Edit,
  Trash2,
  UserPlus,
  UserMinus,
  Loader2,
  Phone,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../auth';
import type { ChitGroup, ChitMember, Customer } from '../types';
import { formatCurrency, formatDate } from '../calc';
import {
  PageHeader,
  Modal,
  Field,
  Select,
  StatusBadge,
  Badge,
  EmptyState,
  ConfirmDialog,
} from '../components/ui';

type StatusFilter = 'all' | ChitGroup['status'];
const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'closed', label: 'Closed' },
];

const emptyForm = {
  group_name: '',
  total_members: '',
  group_value: '',
  monthly_contribution: '',
  duration: '',
  start_date: new Date().toISOString().slice(0, 10),
};

export default function ChitGroupsScreen({ onNavigate }: { onNavigate: (id: string) => void }) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [groups, setGroups] = useState<ChitGroup[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ChitGroup | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const [dashboardGroup, setDashboardGroup] = useState<ChitGroup | null>(null);
  const [members, setMembers] = useState<ChitMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberForm, setMemberForm] = useState({ customer_id: '', contribution: '' });
  const [addMemberError, setAddMemberError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<ChitGroup | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [collectingId, setCollectingId] = useState<string | null>(null);

  useEffect(() => {
    fetchGroups();
    fetchCustomers();
    // Keep the list live so collections by agents show up here in real time.
    const timer = setInterval(() => fetchGroups(true), 30000);
    const onFocus = () => { if (document.visibilityState !== 'hidden') fetchGroups(true); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchGroups(silent = false) {
    if (!silent) setLoading(true);
    const { data } = await supabase.from('chit_groups').select('*').order('created_at', { ascending: false });
    setGroups((data as ChitGroup[]) ?? []);
    if (!silent) setLoading(false);
  }

  async function fetchCustomers() {
    const { data } = await supabase.from('customers').select('*').order('full_name', { ascending: true });
    setCustomers((data as Customer[]) ?? []);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups.filter((g) => {
      if (status !== 'all' && g.status !== status) return false;
      if (!q) return true;
      return (
        g.group_name.toLowerCase().includes(q) ||
        g.group_number.toLowerCase().includes(q)
      );
    });
  }, [groups, query, status]);

  const stats = useMemo(() => {
    return {
      total: groups.length,
      active: groups.filter((g) => g.status === 'active').length,
      collected: groups.reduce((s, g) => s + (g.collected_amount ?? 0), 0),
      pending: groups.reduce((s, g) => s + (g.pending_amount ?? 0), 0),
    };
  }, [groups]);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm });
    setShowForm(true);
  }

  function openEdit(g: ChitGroup) {
    setEditing(g);
    setForm({
      group_name: g.group_name,
      total_members: String(g.total_members),
      group_value: String(g.group_value),
      monthly_contribution: String(g.monthly_contribution),
      duration: String(g.duration),
      start_date: g.start_date,
    });
    setShowForm(true);
  }

  async function saveGroup() {
    setSaving(true);
    const payload = {
      group_name: form.group_name.trim(),
      total_members: Number(form.total_members) || 0,
      group_value: Number(form.group_value) || 0,
      monthly_contribution: Number(form.monthly_contribution) || 0,
      duration: Number(form.duration) || 0,
      start_date: form.start_date,
    };
    if (editing) {
      await supabase.from('chit_groups').update(payload).eq('id', editing.id);
    } else {
      const seq = (groups.length + 1).toString().padStart(4, '0');
      await supabase.from('chit_groups').insert({
        ...payload,
        group_number: `CG-${seq}`,
        collected_amount: 0,
        pending_amount: payload.group_value,
        status: 'pending',
      });
    }
    setSaving(false);
    setShowForm(false);
    fetchGroups();
  }

  async function deleteGroup() {
    if (!deleteTarget) return;
    setDeleting(true);
    await supabase.from('chit_members').delete().eq('group_id', deleteTarget.id);
    await supabase.from('chit_groups').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    fetchGroups();
  }

  async function openDashboard(g: ChitGroup) {
    setDashboardGroup(g);
    await fetchMembers(g.id);
  }

  async function fetchMembers(groupId: string) {
    setMembersLoading(true);
    const { data } = await supabase
      .from('chit_members')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });
    setMembers((data as ChitMember[]) ?? []);
    setMembersLoading(false);
  }

  function openAddMember() {
    setMemberForm({ customer_id: '', contribution: '' });
    setAddMemberError('');
    setShowAddMember(true);
  }

  async function addMember() {
    if (!dashboardGroup) return;
    const customer = customers.find((c) => c.id === memberForm.customer_id);
    if (!customer) {
      setAddMemberError('Please select a customer.');
      return;
    }
    const contribution = Number(memberForm.contribution) || dashboardGroup.monthly_contribution;
    const due = new Date(dashboardGroup.start_date);
    const dueDate = new Date(due.getFullYear(), due.getMonth() + 1, due.getDate())
      .toISOString()
      .slice(0, 10);
    await supabase.from('chit_members').insert({
      group_id: dashboardGroup.id,
      customer_id: customer.id,
      member_name: customer.full_name,
      contribution_amount: contribution,
      due_date: dueDate,
      payment_status: 'pending',
    });
    setShowAddMember(false);
    fetchMembers(dashboardGroup.id);
  }

  async function removeMember(id: string) {
    if (!dashboardGroup) return;
    setRemovingId(id);
    await supabase.from('chit_members').delete().eq('id', id);
    setRemovingId(null);
    fetchMembers(dashboardGroup.id);
  }

  // Record one monthly contribution from a member: mark them paid, add the
  // money to the group's collected total, shrink the pending amount, advance the
  // member's due date to next month, and close the group once it's fully funded.
  async function collectFromMember(m: ChitMember) {
    if (!dashboardGroup) return;
    setCollectingId(m.id);
    const amt = Number(m.contribution_amount) || 0;
    const newCollected = Math.round(((dashboardGroup.collected_amount ?? 0) + amt) * 100) / 100;
    const newPending = Math.max(0, Math.round(((dashboardGroup.group_value ?? 0) - newCollected) * 100) / 100);
    const newStatus: ChitGroup['status'] = newCollected >= dashboardGroup.group_value ? 'closed' : 'active';

    // Next month's due date for this member.
    const base = m.due_date ? new Date(m.due_date) : new Date();
    const nextDue = new Date(base.getFullYear(), base.getMonth() + 1, base.getDate())
      .toISOString()
      .slice(0, 10);

    await supabase.from('chit_members').update({ payment_status: 'paid', due_date: nextDue }).eq('id', m.id);
    await supabase
      .from('chit_groups')
      .update({ collected_amount: newCollected, pending_amount: newPending, status: newStatus })
      .eq('id', dashboardGroup.id);

    // Reflect immediately in the open dashboard + the card list.
    setDashboardGroup({ ...dashboardGroup, collected_amount: newCollected, pending_amount: newPending, status: newStatus });
    setCollectingId(null);
    fetchMembers(dashboardGroup.id);
    fetchGroups();
  }

  const memberLookup = useMemo(() => {
    const map = new Map<string, Customer>();
    customers.forEach((c) => map.set(c.id, c));
    return map;
  }, [customers]);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Chit Groups"
        subtitle={isAdmin ? 'Manage chit fund groups and member contributions' : 'View chit groups and collect member contributions'}
        actions={
          isAdmin ? (
            <button className="btn-primary" onClick={openCreate}>
              <Plus className="w-4 h-4" /> Create Group
            </button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard icon={GroupIcon} label="Total Groups" value={String(stats.total)} accent="violet" />
        <StatCard icon={TrendingUp} label="Active Groups" value={String(stats.active)} accent="amber" />
        <StatCard icon={IndianRupee} label="Collected" value={formatCurrency(stats.collected)} accent="emerald" />
        <StatCard icon={IndianRupee} label="Pending" value={formatCurrency(stats.pending)} accent="rose" />
      </div>

      <div className="card p-3 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className="input pl-9"
              placeholder="Search by group name or number..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className="sm:w-44">
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-7 h-7 text-violet-500 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={GroupIcon}
            title={groups.length === 0 ? 'No chit groups yet' : 'No groups match your filters'}
            description={groups.length === 0 ? 'Create your first chit fund group to get started.' : 'Try adjusting your search or status filter.'}
            action={
              groups.length === 0 && isAdmin ? (
                <button className="btn-primary" onClick={openCreate}>
                  <Plus className="w-4 h-4" /> Create Group
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((g) => (
            <GroupCard
              key={g.id}
              group={g}
              isAdmin={isAdmin}
              onView={() => openDashboard(g)}
              onEdit={() => openEdit(g)}
              onDelete={() => setDeleteTarget(g)}
              onNavigate={() => onNavigate(g.id)}
            />
          ))}
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit Group' : 'Create Group'}
        size="lg"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Field label="Group Name" required>
              <input
                className="input"
                value={form.group_name}
                onChange={(e) => setForm({ ...form, group_name: e.target.value })}
                placeholder="e.g. Lakshmi Chit Fund"
              />
            </Field>
          </div>
          <Field label="Total Members" required>
            <input
              type="number"
              className="input"
              value={form.total_members}
              onChange={(e) => setForm({ ...form, total_members: e.target.value })}
            />
          </Field>
          <Field label="Duration (months)" required>
            <input
              type="number"
              className="input"
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: e.target.value })}
            />
          </Field>
          <Field label="Group Value" required>
            <input
              type="number"
              className="input"
              value={form.group_value}
              onChange={(e) => setForm({ ...form, group_value: e.target.value })}
            />
          </Field>
          <Field label="Monthly Contribution" required>
            <input
              type="number"
              className="input"
              value={form.monthly_contribution}
              onChange={(e) => setForm({ ...form, monthly_contribution: e.target.value })}
            />
          </Field>
          <Field label="Start Date" required>
            <input
              type="date"
              className="input"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          <button className="btn-primary" onClick={saveGroup} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {editing ? 'Update' : 'Create'} Group
          </button>
        </div>
      </Modal>

      <Modal
        open={!!dashboardGroup}
        onClose={() => setDashboardGroup(null)}
        title={dashboardGroup ? dashboardGroup.group_name : ''}
        size="xl"
      >
        {dashboardGroup && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MiniStat label="Group No." value={dashboardGroup.group_number} />
              <MiniStat label="Members" value={String(dashboardGroup.total_members)} />
              <MiniStat label="Value" value={formatCurrency(dashboardGroup.group_value)} />
              <MiniStat label="Duration" value={`${dashboardGroup.duration} mo`} />
            </div>

            <div className="card !shadow-none border border-ink-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-ink-700">Collection Progress</span>
                <span className="text-sm text-ink-500">
                  {formatCurrency(dashboardGroup.collected_amount)} / {formatCurrency(dashboardGroup.group_value)}
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-ink-100 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-violet-500 rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, dashboardGroup.group_value > 0 ? (dashboardGroup.collected_amount / dashboardGroup.group_value) * 100 : 0)}%`,
                  }}
                />
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs">
                <span className="flex items-center gap-1.5 text-emerald-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Collected {formatCurrency(dashboardGroup.collected_amount)}
                </span>
                <span className="flex items-center gap-1.5 text-rose-500">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  Pending {formatCurrency(dashboardGroup.pending_amount)}
                </span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-ink-800">Member Collection Tracking</h3>
                {isAdmin && (
                  <button className="btn-ghost text-violet-600" onClick={openAddMember}>
                    <UserPlus className="w-4 h-4" /> Add Member
                  </button>
                )}
              </div>

              {membersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
                </div>
              ) : members.length === 0 ? (
                <div className="text-center py-8 text-sm text-ink-400">No members added yet.</div>
              ) : (
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                        <th className="table-head">Member</th>
                        <th className="table-head">Contribution</th>
                        <th className="table-head">Due Date</th>
                        <th className="table-head">Status</th>
                        <th className="table-head text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-50">
                      {members.map((m) => {
                        const cust = m.customer_id ? memberLookup.get(m.customer_id) : null;
                        return (
                          <tr key={m.id} className="hover:bg-ink-50/50">
                            <td className="table-cell">
                              <div className="font-medium text-ink-800">{m.member_name ?? 'Unknown'}</div>
                              {cust?.mobile && (
                                <div className="flex items-center gap-1 text-xs text-ink-400 mt-0.5">
                                  <Phone className="w-3 h-3" /> {cust.mobile}
                                </div>
                              )}
                            </td>
                            <td className="table-cell">{formatCurrency(m.contribution_amount)}</td>
                            <td className="table-cell">{formatDate(m.due_date)}</td>
                            <td className="table-cell"><StatusBadge status={m.payment_status} /></td>
                            <td className="table-cell">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  className="btn-ghost text-emerald-600 px-2"
                                  onClick={() => collectFromMember(m)}
                                  disabled={collectingId === m.id}
                                  title={`Collect ${formatCurrency(m.contribution_amount)}`}
                                >
                                  {collectingId === m.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <><IndianRupee className="w-4 h-4" /> Collect</>
                                  )}
                                </button>
                                {isAdmin && (
                                  <button
                                    className="btn-ghost text-rose-500 px-2"
                                    onClick={() => removeMember(m.id)}
                                    disabled={removingId === m.id}
                                    title="Remove member"
                                  >
                                    {removingId === m.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <UserMinus className="w-4 h-4" />
                                    )}
                                  </button>
                                )}
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
          </div>
        )}
      </Modal>

      <Modal open={showAddMember} onClose={() => setShowAddMember(false)} title="Add Member" size="md">
        <div className="space-y-4">
          <Field label="Customer" required>
            <Select
              value={memberForm.customer_id}
              onChange={(e) => setMemberForm({ ...memberForm, customer_id: e.target.value })}
            >
              <option value="">Select a customer...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}{c.mobile ? ` — ${c.mobile}` : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Contribution Amount"
            hint={dashboardGroup ? `Defaults to ${formatCurrency(dashboardGroup.monthly_contribution)}` : undefined}
          >
            <input
              type="number"
              className="input"
              value={memberForm.contribution}
              onChange={(e) => setMemberForm({ ...memberForm, contribution: e.target.value })}
              placeholder={dashboardGroup ? String(dashboardGroup.monthly_contribution) : ''}
            />
          </Field>
          {addMemberError && <p className="text-sm text-rose-500">{addMemberError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={() => setShowAddMember(false)}>Cancel</button>
            <button className="btn-primary" onClick={addMember}>
              <UserPlus className="w-4 h-4" /> Add Member
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteGroup}
        title="Delete Group"
        message={deleteTarget ? `Delete "${deleteTarget.group_name}"? This also removes all its members and cannot be undone.` : ''}
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
  accent,
}: {
  icon: typeof GroupIcon;
  label: string;
  value: string;
  accent: 'violet' | 'amber' | 'emerald' | 'rose';
}) {
  const accents = {
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-600',
  };
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${accents[accent]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-ink-500">{label}</p>
        <p className="text-lg font-bold text-ink-900 truncate">{value}</p>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-ink-50/70 rounded-xl px-3 py-2">
      <p className="text-xs text-ink-500">{label}</p>
      <p className="text-sm font-semibold text-ink-800 truncate">{value}</p>
    </div>
  );
}

function GroupCard({
  group,
  isAdmin,
  onView,
  onEdit,
  onDelete,
  onNavigate,
}: {
  group: ChitGroup;
  isAdmin: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onNavigate: () => void;
}) {
  const pct = group.group_value > 0 ? Math.min(100, (group.collected_amount / group.group_value) * 100) : 0;
  return (
    <div className="card p-4 flex flex-col gap-3 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <button onClick={onNavigate} className="font-semibold text-ink-900 truncate hover:text-violet-600 transition-colors text-left">
              {group.group_name}
            </button>
            <StatusBadge status={group.status} />
          </div>
          <p className="text-xs text-ink-400 mt-0.5">{group.group_number}</p>
        </div>
        <Badge color="purple" className="shrink-0">
          <Users className="w-3 h-3 mr-1" />
          {group.total_members}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-xs text-ink-400">Group Value</p>
          <p className="font-medium text-ink-800">{formatCurrency(group.group_value)}</p>
        </div>
        <div>
          <p className="text-xs text-ink-400">Monthly</p>
          <p className="font-medium text-ink-800">{formatCurrency(group.monthly_contribution)}</p>
        </div>
        <div>
          <p className="text-xs text-ink-400">Duration</p>
          <p className="font-medium text-ink-800">{group.duration} months</p>
        </div>
        <div>
          <p className="text-xs text-ink-400">Starts</p>
          <p className="font-medium text-ink-800">{formatDate(group.start_date)}</p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-ink-400">Collected</span>
          <span className="text-xs font-medium text-ink-600">{pct.toFixed(0)}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-ink-100 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-violet-500 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-ink-50 mt-1">
        <button className="btn-primary flex-1 justify-center" onClick={onView}>View Dashboard</button>
        {isAdmin && (
          <>
            <button className="btn-ghost px-2.5" onClick={onEdit} title="Edit"><Edit className="w-4 h-4" /></button>
            <button className="btn-ghost text-rose-500 px-2.5" onClick={onDelete} title="Delete"><Trash2 className="w-4 h-4" /></button>
          </>
        )}
      </div>
    </div>
  );
}
