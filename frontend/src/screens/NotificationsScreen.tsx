import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../auth';
import type { Notification, Profile } from '../types';
import { formatDateTime } from '../calc';
import { PageHeader, Badge, EmptyState } from '../components/ui';
import {
  Bell, CheckCheck, Trash2, BellOff, Loader2, CalendarClock,
  AlertCircle, UserCheck, AlarmClock, Info, Send, X, Search, Check, Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Filter = 'all' | 'unread' | 'emi_due' | 'overdue' | 'approval' | 'reminder';

const TYPE_META: Record<
  Notification['type'],
  { icon: LucideIcon; ring: string; bg: string; fg: string; label: string }
> = {
  emi_due: { icon: CalendarClock, ring: 'ring-brand-100', bg: 'bg-brand-50', fg: 'text-brand-600', label: 'EMI Due' },
  overdue: { icon: AlertCircle, ring: 'ring-rose-100', bg: 'bg-rose-50', fg: 'text-rose-600', label: 'Overdue' },
  approval: { icon: UserCheck, ring: 'ring-amber-100', bg: 'bg-amber-50', fg: 'text-amber-600', label: 'Approval' },
  reminder: { icon: AlarmClock, ring: 'ring-violet-100', bg: 'bg-violet-50', fg: 'text-violet-600', label: 'Reminder' },
  info: { icon: Info, ring: 'ring-ink-100', bg: 'bg-ink-50', fg: 'text-ink-500', label: 'Info' },
};

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'emi_due', label: 'EMI Due' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'approval', label: 'Approvals' },
  { id: 'reminder', label: 'Reminders' },
];

export default function NotificationsScreen({
  onNavigate,
  onChanged,
}: {
  onNavigate: (id: string) => void;
  onChanged?: () => void;
}) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const userId = profile?.id;

  async function load() {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setItems((data ?? []) as Notification[]);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      if (!userId) return;
      setLoading(true);
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (!active) return;
      setItems((data ?? []) as Notification[]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const stats = useMemo(() => {
    const total = items.length;
    const unread = items.filter((n) => !n.read).length;
    const overdue = items.filter((n) => n.type === 'overdue').length;
    return { total, unread, overdue };
  }, [items]);

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'unread') return items.filter((n) => !n.read);
    return items.filter((n) => n.type === filter);
  }, [items, filter]);

  const unreadRemaining = stats.unread > 0;

  async function markRead(id: string) {
    const target = items.find((n) => n.id === id);
    if (!target || target.read) return;
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setBusyId(id);
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setBusyId(null);
    onChanged?.();
  }

  async function markAllRead() {
    const unreadIds = items.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
    onChanged?.();
  }

  async function remove(id: string) {
    const prev = items;
    setItems((cur) => cur.filter((n) => n.id !== id));
    setBusyId(id);
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (error) setItems(prev);
    setBusyId(null);
    onChanged?.();
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Notifications"
        subtitle="Stay on top of dues, approvals, and reminders"
        actions={
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              className="btn-secondary flex-1 sm:flex-none justify-center"
              onClick={markAllRead}
              disabled={!unreadRemaining}
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>
            {isAdmin && (
              <button
                className="btn-primary flex-1 sm:flex-none justify-center"
                onClick={() => setComposeOpen(true)}
              >
                <Send className="w-4 h-4" />
                Send Notification
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

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <StatTile label="Total" value={stats.total} icon={Bell} tone="brand" />
        <StatTile label="Unread" value={stats.unread} icon={BellOff} tone="violet" />
        <StatTile label="Overdue" value={stats.overdue} icon={AlertCircle} tone="rose" />
      </div>

      <div className="card p-2 flex items-center gap-1 overflow-x-auto no-scrollbar">
        {FILTERS.map((f) => {
          const active = filter === f.id;
          const count =
            f.id === 'all'
              ? stats.total
              : f.id === 'unread'
              ? stats.unread
              : items.filter((n) => n.type === f.id).length;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-200 flex items-center gap-2 ${
                active ? 'bg-brand-600 text-white shadow-sm' : 'text-ink-600 hover:bg-ink-100'
              }`}
            >
              {f.label}
              <span
                className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                  active ? 'bg-white/25 text-white' : 'bg-ink-100 text-ink-500'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="card p-16 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
          <p className="text-sm text-ink-500 mt-3">Loading notifications...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Bell}
            title="No notifications"
            description={
              filter === 'all'
                ? "You're all caught up. New alerts will appear here."
                : 'No notifications in this category.'
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((n) => {
            const meta = TYPE_META[n.type];
            const Icon = meta.icon;
            return (
              <div
                key={n.id}
                className={`card p-4 flex gap-3.5 transition-all duration-200 hover:shadow-card-hover ${
                  n.read ? 'opacity-70' : 'ring-1 ring-brand-100'
                }`}
              >
                <button
                  onClick={() => markRead(n.id)}
                  disabled={n.read || busyId === n.id}
                  className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ring-1 ${meta.ring} ${meta.bg} ${meta.fg} hover:scale-105 transition-transform`}
                  title={n.read ? 'Read' : 'Mark as read'}
                >
                  <Icon className="w-5 h-5" />
                </button>

                <button
                  onClick={() => markRead(n.id)}
                  className="flex-1 min-w-0 text-left group"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    {!n.read && (
                      <span className="shrink-0 w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                    )}
                    <p className={`text-sm font-semibold ${n.read ? 'text-ink-700' : 'text-ink-900'}`}>
                      {n.title}
                    </p>
                    <Badge
                      color={
                        n.type === 'emi_due'
                          ? 'blue'
                          : n.type === 'overdue'
                          ? 'red'
                          : n.type === 'approval'
                          ? 'yellow'
                          : n.type === 'reminder'
                          ? 'purple'
                          : 'gray'
                      }
                    >
                      {meta.label}
                    </Badge>
                  </div>
                  {n.message && (
                    <p className="text-sm text-ink-600 mt-1 leading-relaxed line-clamp-2">
                      {n.message}
                    </p>
                  )}
                  <p className="text-xs text-ink-400 mt-1.5">{formatDateTime(n.created_at)}</p>
                </button>

                <div className="flex flex-col items-center gap-1.5">
                  <button
                    onClick={() => remove(n.id)}
                    disabled={busyId === n.id}
                    className="w-9 h-9 rounded-xl text-ink-400 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition-colors disabled:opacity-40"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onNavigate(n.id)}
                    className="hidden sm:flex w-9 h-9 rounded-xl text-ink-400 hover:bg-ink-100 hover:text-ink-700 items-center justify-center transition-colors"
                    title="Open"
                  >
                    <Bell className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {composeOpen && (
        <ComposeModal
          onClose={() => setComposeOpen(false)}
          onSent={(count) => {
            setComposeOpen(false);
            setToast(
              `Notification sent to ${count} customer${count === 1 ? '' : 's'}.`,
            );
            load();
          }}
        />
      )}
    </div>
  );
}

const COMPOSE_TYPES: { id: Notification['type']; label: string }[] = [
  { id: 'info', label: 'Info' },
  { id: 'reminder', label: 'Reminder' },
  { id: 'emi_due', label: 'EMI Due' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'approval', label: 'Approval' },
];

function ComposeModal({
  onClose,
  onSent,
}: {
  onClose: () => void;
  onSent: (count: number) => void;
}) {
  const [customers, setCustomers] = useState<Profile[]>([]);
  const [loadingCust, setLoadingCust] = useState(true);
  const [mode, setMode] = useState<'all' | 'select'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<Notification['type']>('info');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingCust(true);
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'customer')
        .order('full_name', { ascending: true });
      if (!active) return;
      setCustomers((data ?? []) as Profile[]);
      setLoadingCust(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.mobile ?? '').includes(q),
    );
  }, [customers, search]);

  const targetIds = mode === 'all' ? customers.map((c) => c.id) : [...selected];

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function send() {
    setError(null);
    if (!title.trim()) {
      setError('Please enter a title.');
      return;
    }
    if (targetIds.length === 0) {
      setError('Select at least one customer to notify.');
      return;
    }
    setSending(true);
    const rows = targetIds.map((uid) => ({
      user_id: uid,
      title: title.trim(),
      message: message.trim() || null,
      type,
    }));
    const { error: insErr } = await supabase.from('notifications').insert(rows);
    setSending(false);
    if (insErr) {
      setError(insErr.message || 'Failed to send. Please try again.');
      return;
    }
    onSent(targetIds.length);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[90vh] flex flex-col animate-scale-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
              <Send className="w-[18px] h-[18px]" />
            </div>
            <div>
              <p className="font-bold text-ink-900 leading-tight">Send Notification</p>
              <p className="text-xs text-ink-400">Notify your customers instantly</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-ink-100 text-ink-400 flex items-center justify-center"
          >
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

          {/* Recipients */}
          <div>
            <label className="label">Recipients</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode('all')}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                  mode === 'all'
                    ? 'border-brand-400 bg-brand-50 text-brand-700'
                    : 'border-ink-200 text-ink-600 hover:border-ink-300'
                }`}
              >
                <Users className="w-4 h-4" />
                All Customers
                <span className="ml-auto text-xs text-ink-400">{customers.length}</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('select')}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                  mode === 'select'
                    ? 'border-brand-400 bg-brand-50 text-brand-700'
                    : 'border-ink-200 text-ink-600 hover:border-ink-300'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                Select
                {mode === 'select' && selected.size > 0 && (
                  <span className="ml-auto text-xs text-brand-600">{selected.size}</span>
                )}
              </button>
            </div>
          </div>

          {mode === 'select' && (
            <div className="rounded-xl border border-ink-200 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-ink-100 bg-ink-50">
                <Search className="w-4 h-4 text-ink-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search customers..."
                  className="flex-1 bg-transparent text-sm outline-none placeholder-ink-400"
                />
              </div>
              <div className="max-h-48 overflow-y-auto">
                {loadingCust ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
                  </div>
                ) : filteredCustomers.length === 0 ? (
                  <p className="text-center text-sm text-ink-400 py-8">No customers found.</p>
                ) : (
                  filteredCustomers.map((c) => {
                    const on = selected.has(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggle(c.id)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-ink-50 text-left transition-colors"
                      >
                        <span
                          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                            on ? 'bg-brand-600 border-brand-600 text-white' : 'border-ink-300'
                          }`}
                        >
                          {on && <Check className="w-3.5 h-3.5" />}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink-800 truncate">{c.full_name}</p>
                          <p className="text-xs text-ink-400 truncate">{c.email ?? c.mobile ?? '—'}</p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Type */}
          <div>
            <label className="label">Type</label>
            <div className="flex flex-wrap gap-2">
              {COMPOSE_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setType(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    type === t.id
                      ? 'bg-brand-600 text-white'
                      : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="label">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. EMI due tomorrow"
              className="input"
              maxLength={191}
            />
          </div>

          {/* Message */}
          <div>
            <label className="label">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your message to customers..."
              rows={3}
              className="input resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-ink-100">
          <p className="text-xs text-ink-400">
            {targetIds.length > 0
              ? `Will notify ${targetIds.length} customer${targetIds.length === 1 ? '' : 's'}`
              : 'No recipients selected'}
          </p>
          <div className="flex items-center gap-2">
            <button className="btn-secondary" onClick={onClose} disabled={sending}>
              Cancel
            </button>
            <button className="btn-primary" onClick={send} disabled={sending}>
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: 'brand' | 'violet' | 'rose';
}) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600 ring-brand-100',
    violet: 'bg-violet-50 text-violet-600 ring-violet-100',
    rose: 'bg-rose-50 text-rose-600 ring-rose-100',
  } as const;
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ring-1 ${tones[tone]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
        <p className="text-lg sm:text-xl font-bold text-ink-900">{value}</p>
      </div>
    </div>
  );
}
