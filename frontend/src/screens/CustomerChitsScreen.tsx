import { useCallback, useEffect, useRef, useState } from 'react';
import { Group as GroupIcon, Loader2, RefreshCw, Users, CalendarClock } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../auth';
import { PageHeader, StatusBadge, EmptyState } from '../components/ui';
import { formatCurrency, formatDate } from '../calc';
import type { ChitGroup, ChitMember } from '../types';

type Row = ChitMember & { group?: ChitGroup };

export default function CustomerChitsScreen() {
  const { profile } = useAuth();
  const cid = profile?.customer_id ?? null;
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const activeRef = useRef(true);

  const load = useCallback(async (isRefresh = false) => {
    if (!cid) { setLoading(false); return; }
    if (isRefresh) setRefreshing(true);
    const { data: mem } = await supabase
      .from('chit_members')
      .select('*')
      .eq('customer_id', cid)
      .order('created_at', { ascending: false });
    const members = (mem ?? []) as ChitMember[];

    const groupIds = [...new Set(members.map((m) => m.group_id).filter(Boolean))];
    let groups: ChitGroup[] = [];
    if (groupIds.length) {
      const { data: gr } = await supabase.from('chit_groups').select('*').in('id', groupIds);
      groups = (gr ?? []) as ChitGroup[];
    }
    const gmap = new Map(groups.map((g) => [g.id, g]));

    if (!activeRef.current) return;
    setRows(members.map((m) => ({ ...m, group: gmap.get(m.group_id) })));
    setLoading(false);
    setRefreshing(false);
  }, [cid]);

  useEffect(() => {
    activeRef.current = true;
    load();
    const timer = setInterval(() => load(true), 30000); // keep chit status live
    const onFocus = () => { if (document.visibilityState !== 'hidden') load(true); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      activeRef.current = false;
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [load]);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="My Chits"
        subtitle="Chit fund groups you're a member of"
        actions={
          <button className="btn-secondary" onClick={() => load(true)} disabled={refreshing} title="Refresh">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-7 h-7 text-violet-500 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={GroupIcon}
            title="No chit memberships"
            description="You are not part of any chit group yet. Contact the office to join one."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rows.map((r) => {
            const g = r.group;
            const pct = g && g.group_value > 0 ? Math.min(100, (g.collected_amount / g.group_value) * 100) : 0;
            return (
              <div key={r.id} className="card p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink-900 truncate">{g?.group_name ?? 'Chit Group'}</p>
                    <p className="text-xs text-ink-400 mt-0.5">{g?.group_number ?? '—'}</p>
                  </div>
                  <StatusBadge status={r.payment_status} />
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-ink-400">My Contribution</p>
                    <p className="font-semibold text-ink-800">{formatCurrency(r.contribution_amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-ink-400">Group Value</p>
                    <p className="font-semibold text-ink-800">{formatCurrency(g?.group_value ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-ink-400 flex items-center gap-1"><CalendarClock className="w-3 h-3" /> Next Due</p>
                    <p className="font-semibold text-ink-800">{r.due_date ? formatDate(r.due_date) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-ink-400 flex items-center gap-1"><Users className="w-3 h-3" /> Members</p>
                    <p className="font-semibold text-ink-800">{g?.total_members ?? '—'}</p>
                  </div>
                </div>

                {g && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-ink-400">Group Collection</span>
                      <span className="text-xs font-medium text-ink-600">
                        {formatCurrency(g.collected_amount)} / {formatCurrency(g.group_value)}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-ink-100 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-400 to-violet-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
