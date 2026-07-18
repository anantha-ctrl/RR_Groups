import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MapPin,
  Navigation,
  Loader2,
  Users,
  CheckCircle2,
  Clock,
  Wallet,
  Map as MapIcon,
  Phone,
  RefreshCw,
  LocateFixed,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../auth';
import { PageHeader, StatusBadge, EmptyState, Badge } from '../components/ui';
import { formatCurrency } from '../calc';
import { RouteMap, type MapStop } from '../components/RouteMap';
import type { Loan, Customer } from '../types';

type StopStatus = 'paid' | 'pending' | 'visited';

interface Stop extends Omit<Loan, 'status'> {
  status: StopStatus;
  address: string | null;
  mobile: string | null;
  lat: number | null;
  lng: number | null;
}

interface GeoPos {
  lat: number;
  lng: number;
}

// Build a real Google Maps directions URL to a customer's address, using the
// agent's live GPS as the origin when available. Works on phone & desktop.
function directionsUrl(dest: string, origin: GeoPos | null): string {
  const d = encodeURIComponent(dest);
  const o = origin ? `&origin=${origin.lat},${origin.lng}` : '';
  return `https://www.google.com/maps/dir/?api=1${o}&destination=${d}`;
}

export default function AgentRouteScreen({ onNavigate }: { onNavigate: (id: string) => void }) {
  const { profile } = useAuth();
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myPos, setMyPos] = useState<GeoPos | null>(null);
  const [geoState, setGeoState] = useState<'idle' | 'locating' | 'ok' | 'denied'>('idle');
  const activeRef = useRef(true);

  const load = useCallback(async (isRefresh = false) => {
    if (!profile?.id) return;
    if (isRefresh) setRefreshing(true);
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
    const loans = (loansRes.data ?? []) as Loan[];
    // Pull each stop's real address + mobile from the customers table.
    const custIds = [...new Set(loans.map((l) => l.customer_id).filter(Boolean))];
    let custMap = new Map<string, Customer>();
    if (custIds.length) {
      const { data: custs } = await supabase.from('customers').select('*').in('id', custIds as string[]);
      custMap = new Map((custs ?? []).map((c: Customer) => [c.id, c]));
    }
    const cols = colRes.data ?? [];
    const paidIds = new Set(cols.map((c: { loan_id: string | null }) => c.loan_id));
    const stopsData: Stop[] = loans.map((l) => {
      const c = l.customer_id ? custMap.get(l.customer_id) : undefined;
      return {
        ...l,
        status: paidIds.has(l.id) ? 'paid' : 'pending',
        address: c?.address ?? null,
        mobile: c?.mobile ?? null,
        lat: c?.latitude ?? null,
        lng: c?.longitude ?? null,
      };
    });
    if (!activeRef.current) return;
    setStops(stopsData);
    setLoading(false);
    setRefreshing(false);
  }, [profile?.id]);

  useEffect(() => {
    activeRef.current = true;
    load();
    const timer = setInterval(() => load(true), 30000);
    return () => { activeRef.current = false; clearInterval(timer); };
  }, [load]);

  // Ask for the agent's real location once (used as the origin for directions).
  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) { setGeoState('denied'); return; }
    setGeoState('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!activeRef.current) return;
        setMyPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoState('ok');
      },
      () => { if (activeRef.current) setGeoState('denied'); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }, []);

  useEffect(() => { locate(); }, [locate]);

  const stats = useMemo(() => {
    const total = stops.length;
    const completed = stops.filter((s) => s.status === 'paid').length;
    const pendingAmount = stops
      .filter((s) => s.status !== 'paid')
      .reduce((sum, s) => sum + Number(s.emi || s.outstanding_balance || 0), 0);
    return { total, completed, remaining: total - completed, pendingAmount };
  }, [stops]);

  // Stops that have real coordinates → plotted on the live map.
  const mapStops = useMemo<MapStop[]>(
    () => stops
      .filter((s) => s.lat != null && s.lng != null)
      .map((s, i) => ({
        id: s.id,
        name: `${i + 1}. ${s.customer_name ?? 'Stop'}`,
        lat: Number(s.lat),
        lng: Number(s.lng),
        paid: s.status === 'paid',
        amount: formatCurrency(s.emi || s.outstanding_balance),
      })),
    [stops],
  );
  const unmapped = stops.length - mapStops.length;

  function goNavigate(stop: Stop) {
    const dest = stop.address?.trim() || stop.customer_name || '';
    if (!dest) return;
    window.open(directionsUrl(dest, myPos), '_blank', 'noopener,noreferrer');
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
        title="Today's Route"
        subtitle={`${stops.length} stop${stops.length === 1 ? '' : 's'} assigned today`}
        actions={
          <div className="flex items-center gap-2">
            <button className="btn-secondary" onClick={() => load(true)} disabled={refreshing} title="Refresh">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button onClick={() => onNavigate('collections')} className="btn-primary text-sm font-semibold px-4 py-2">
              Start Collecting
            </button>
          </div>
        }
      />

      {/* Live location status */}
      <div className={`flex items-center gap-2 text-xs rounded-xl px-3.5 py-2.5 ${
        geoState === 'ok' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
        : geoState === 'denied' ? 'bg-amber-50 border border-amber-200 text-amber-700'
        : 'bg-ink-50 border border-ink-200 text-ink-500'
      }`}>
        <LocateFixed className={`w-4 h-4 shrink-0 ${geoState === 'locating' ? 'animate-pulse' : ''}`} />
        {geoState === 'ok' && <span>Live location on — directions will start from where you are.</span>}
        {geoState === 'locating' && <span>Getting your location…</span>}
        {geoState === 'idle' && <span>Location not enabled yet.</span>}
        {geoState === 'denied' && (
          <span className="flex items-center gap-2">
            Location off — directions still open to the customer.
            <button onClick={locate} className="underline font-semibold">Enable</button>
          </span>
        )}
      </div>

      {stops.length === 0 && (
        <EmptyState
          icon={MapIcon}
          title="No route assigned"
          description="You have no active or overdue customers assigned today."
        />
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBox icon={Users} label="Total Stops" value={String(stats.total)} tone="bg-brand-50 text-brand-600" />
        <StatBox icon={CheckCircle2} label="Completed" value={String(stats.completed)} tone="bg-emerald-50 text-emerald-600" />
        <StatBox icon={Clock} label="Remaining" value={String(stats.remaining)} tone="bg-amber-50 text-amber-600" />
        <StatBox icon={Wallet} label="Pending" value={formatCurrency(stats.pendingAmount)} tone="bg-violet-50 text-violet-600" />
      </div>

      {mapStops.length > 0 ? (
        <div className="card p-0 overflow-hidden animate-slide-up">
          <RouteMap stops={mapStops} me={myPos} />
          {unmapped > 0 && (
            <p className="text-[11px] text-ink-400 px-4 py-2 border-t border-ink-100">
              {unmapped} stop{unmapped === 1 ? '' : 's'} not on the map yet — set the customer's location in Customers.
            </p>
          )}
        </div>
      ) : stops.length > 0 && (
        <div className="card p-6 text-center">
          <MapIcon className="w-8 h-8 text-ink-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-ink-700">No pinned locations yet</p>
          <p className="text-xs text-ink-400 mt-1">Set each customer's location in Customers (pin from address or capture GPS) to see them on the live map. Navigate still works below.</p>
        </div>
      )}

      <div className="space-y-3">
        {stops.map((stop, idx) => (
          <div key={stop.id} className="card p-4 animate-slide-up hover:shadow-card-hover transition-all">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-ink-900 truncate">{stop.customer_name ?? 'Unknown'}</p>
                  <StatusBadge status={stop.status} />
                </div>
                <div className="flex items-center gap-2 text-xs text-ink-500 mt-0.5">
                  <Badge color="gray">{stop.loan_number}</Badge>
                  <span className="font-semibold text-ink-700">{formatCurrency(stop.emi || stop.outstanding_balance)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {stop.mobile && (
                  <a
                    href={`tel:${stop.mobile}`}
                    className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-ink-200 text-ink-600 hover:border-emerald-300 hover:text-emerald-600 transition-colors"
                    title={`Call ${stop.mobile}`}
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                )}
                <button
                  onClick={() => goNavigate(stop)}
                  disabled={!stop.address && !stop.customer_name}
                  className="btn-primary text-xs font-semibold px-3 py-2.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Navigation className="w-3.5 h-3.5" /> Navigate
                </button>
              </div>
            </div>
            {stop.address ? (
              <p className="text-xs text-ink-500 mt-2.5 flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-ink-400" />
                <span className="line-clamp-2">{stop.address}</span>
              </p>
            ) : (
              <p className="text-xs text-amber-600 mt-2.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 shrink-0" /> No address on file — add it in Customers for exact directions.
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatBox({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="card p-3 flex items-center gap-2.5">
      <div className={`w-9 h-9 rounded-xl ${tone} flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-ink-500 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-bold text-ink-900 truncate">{value}</p>
      </div>
    </div>
  );
}
