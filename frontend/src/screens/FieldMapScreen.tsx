import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Map as MapIcon, Users, CheckCircle2, Wallet, UserCheck, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { PageHeader, EmptyState } from '../components/ui';
import { RouteMap, type MapStop } from '../components/RouteMap';
import { formatCurrency, formatDate, formatTime } from '../calc';
import type { Customer, Collection, Profile } from '../types';

export default function FieldMapScreen() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [agents, setAgents] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [agentFilter, setAgentFilter] = useState('all');
  const activeRef = useRef(true);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const [custRes, colRes, agRes] = await Promise.all([
      supabase.from('customers').select('*'),
      supabase.from('collections').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('role', 'agent'),
    ]);
    if (!activeRef.current) return;
    setCustomers((custRes.data ?? []) as Customer[]);
    setCollections((colRes.data ?? []) as Collection[]);
    setAgents((agRes.data ?? []) as Profile[]);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    activeRef.current = true;
    load();
    const timer = setInterval(() => load(true), 30000); // keep the field view live
    return () => { activeRef.current = false; clearInterval(timer); };
  }, [load]);

  // Latest collection per customer (collections are already newest-first).
  const latestByCustomer = useMemo(() => {
    const m = new Map<string, Collection>();
    for (const c of collections) {
      if (c.customer_id && !m.has(c.customer_id)) m.set(c.customer_id, c);
    }
    return m;
  }, [collections]);

  // Customers this agent has collected from (for the filter).
  const collectedByAgent = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const c of collections) {
      if (!c.agent_id || !c.customer_id) continue;
      if (!m.has(c.agent_id)) m.set(c.agent_id, new Set());
      m.get(c.agent_id)!.add(c.customer_id);
    }
    return m;
  }, [collections]);

  const withCoords = useMemo(
    () => customers.filter((c) => c.latitude != null && c.longitude != null),
    [customers],
  );

  const stops = useMemo<MapStop[]>(() => {
    let list = withCoords;
    if (agentFilter !== 'all') {
      const set = collectedByAgent.get(agentFilter) ?? new Set();
      list = list.filter((c) => set.has(c.id));
    }
    return list.map((c) => {
      const col = latestByCustomer.get(c.id);
      const relevant = agentFilter === 'all' ? col
        : collections.find((x) => x.customer_id === c.id && x.agent_id === agentFilter) ?? col;
      const paid = !!relevant;
      const subtitle = relevant
        ? `${relevant.agent_name ?? 'Agent'} · ${formatCurrency(relevant.collection_amount)} · ${formatDate(relevant.collection_date)} ${formatTime(relevant.created_at)}`
        : 'No collection yet';
      return {
        id: c.id,
        name: c.full_name,
        lat: Number(c.latitude),
        lng: Number(c.longitude),
        paid,
        subtitle,
        amount: relevant ? formatCurrency(relevant.collection_amount) : undefined,
      };
    });
  }, [withCoords, agentFilter, collectedByAgent, latestByCustomer, collections]);

  const stats = useMemo(() => {
    const shown = stops.length;
    const collected = stops.filter((s) => s.paid).length;
    // Respect the agent filter so the value matches what's plotted.
    const rel = agentFilter === 'all' ? collections : collections.filter((c) => c.agent_id === agentFilter);
    const activeAgents = new Set(rel.map((c) => c.agent_id).filter(Boolean)).size;
    const totalCollected = rel.reduce((s, c) => s + Number(c.collection_amount || 0), 0);
    return { shown, collected, activeAgents, totalCollected };
  }, [stops, collections, agentFilter]);

  const unmapped = customers.length - withCoords.length;

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Field Map"
        subtitle="Where each agent has collected — live"
        actions={
          <div className="flex items-center gap-2">
            <select
              className="input !w-auto !py-2 text-sm"
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
            >
              <option value="all">All agents</option>
              {agents.map((a) => (<option key={a.id} value={a.id}>{a.full_name}</option>))}
            </select>
            <button className="btn-secondary" onClick={() => load(true)} disabled={refreshing} title="Refresh">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Tile icon={Users} label="On Map" value={String(stats.shown)} tone="bg-brand-50 text-brand-600" />
        <Tile icon={CheckCircle2} label="Collected" value={String(stats.collected)} tone="bg-emerald-50 text-emerald-600" />
        <Tile icon={UserCheck} label="Active Agents" value={String(stats.activeAgents)} tone="bg-violet-50 text-violet-600" />
        <Tile icon={Wallet} label="Total Collected" value={formatCurrency(stats.totalCollected)} tone="bg-amber-50 text-amber-600" />
      </div>

      {loading ? (
        <div className="card p-16 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
          <p className="text-sm text-ink-500 mt-3">Loading field map…</p>
        </div>
      ) : stops.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={MapIcon}
            title="No mapped customers"
            description="Set customer locations (Customers → Edit → Pin from address, or agents use the Visit button) to see them here."
          />
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <RouteMap stops={stops} me={null} />
          <div className="flex flex-wrap items-center gap-4 px-4 py-2.5 border-t border-ink-100 text-[11px] text-ink-500">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Collected</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Not collected</span>
            {unmapped > 0 && <span className="ml-auto">{unmapped} customer{unmapped === 1 ? '' : 's'} without a location</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function Tile({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: string; tone: string }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl ${tone} flex items-center justify-center shrink-0`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500 truncate">{label}</p>
        <p className="text-base sm:text-lg font-bold text-ink-900 truncate">{value}</p>
      </div>
    </div>
  );
}
