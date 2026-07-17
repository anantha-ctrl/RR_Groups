import { useEffect, useMemo, useState } from 'react';
import {
  MapPin,
  Navigation,
  Loader2,
  Users,
  CheckCircle2,
  Clock,
  Route as RouteIcon,
  Map,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../auth';
import { PageHeader, StatusBadge, EmptyState, Badge } from '../components/ui';
import { formatCurrency } from '../calc';
import type { Loan } from '../types';

type StopStatus = 'paid' | 'pending' | 'visited';

interface Stop extends Omit<Loan, 'status'> {
  status: StopStatus;
  pin: { x: number; y: number };
}

const PIN_POSITIONS = [
  { x: 18, y: 28 },
  { x: 42, y: 18 },
  { x: 68, y: 32 },
  { x: 54, y: 58 },
  { x: 82, y: 64 },
  { x: 28, y: 72 },
  { x: 60, y: 82 },
  { x: 78, y: 48 },
];

function distanceKm(stops: Stop[]): string {
  let total = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i].pin;
    const b = stops[i + 1].pin;
    total += Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }
  return (total * 0.18).toFixed(1);
}

export default function AgentRouteScreen({ onNavigate }: { onNavigate: (id: string) => void }) {
  const { profile } = useAuth();
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    let active = true;
    (async () => {
      setLoading(true);
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
      if (!active) return;
      const cols = colRes.data ?? [];
      const paidIds = new Set(cols.map((c: { loan_id: string | null }) => c.loan_id));
      const stopsData: Stop[] = (loansRes.data ?? []).map((l: Loan, i: number) => ({
        ...l,
        status: paidIds.has(l.id) ? 'paid' : 'pending',
        pin: PIN_POSITIONS[i % PIN_POSITIONS.length],
      }));
      setStops(stopsData);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [profile?.id]);

  const stats = useMemo(() => {
    const total = stops.length;
    const completed = stops.filter((s) => s.status === 'paid').length;
    return { total, completed, remaining: total - completed, distance: distanceKm(stops) };
  }, [stops]);

  function navigateTo(name: string) {
    alert(`Opening navigation to ${name}...`);
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
        subtitle={`${stops.length} stops • ${stats.distance} km estimated`}
        actions={
          <button onClick={() => onNavigate('collections')} className="btn-primary text-sm font-semibold px-4 py-2">
            Start Collecting
          </button>
        }
      />

      {stops.length === 0 && (
        <EmptyState
          icon={Map}
          title="No route assigned"
          description="You have no active or overdue customers assigned today."
        />
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBox icon={Users} label="Total Stops" value={String(stats.total)} tone="bg-brand-50 text-brand-600" />
        <StatBox
          icon={CheckCircle2}
          label="Completed"
          value={String(stats.completed)}
          tone="bg-emerald-50 text-emerald-600"
        />
        <StatBox
          icon={Clock}
          label="Remaining"
          value={String(stats.remaining)}
          tone="bg-amber-50 text-amber-600"
        />
        <StatBox
          icon={RouteIcon}
          label="Distance"
          value={`${stats.distance} km`}
          tone="bg-violet-50 text-violet-600"
        />
      </div>

      <div className="card p-0 overflow-hidden animate-slide-up">
        <div className="relative h-72 sm:h-80 bg-gradient-to-br from-brand-100 via-emerald-50 to-cyan-100 overflow-hidden">
          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            <path
              d="M 8 88 Q 60 40 120 70 T 240 60 T 340 120 T 460 180"
              fill="none"
              stroke="rgba(37,99,235,0.25)"
              strokeWidth="10"
            />
            {stops.length > 1 && (
              <polyline
                points={stops
                  .map((s) => `${(s.pin.x / 100) * 480},${(s.pin.y / 100) * 320}`)
                  .join(' ')}
                fill="none"
                stroke="#a87615"
                strokeWidth="3"
                strokeDasharray="8 6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>

          <div className="absolute" style={{ left: '46%', top: '50%' }}>
            <div className="relative">
              <span className="absolute inset-0 rounded-full bg-cyan-400 animate-ping opacity-60" />
              <div className="relative w-7 h-7 rounded-full bg-cyan-500 border-2 border-white shadow-lg flex items-center justify-center">
                <Navigation className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold text-cyan-700 bg-white/80 px-1.5 py-0.5 rounded">
                You
              </span>
            </div>
          </div>

          {stops.map((s, idx) => {
            const paid = s.status === 'paid';
            return (
              <div
                key={s.id}
                className="absolute -translate-x-1/2 -translate-y-full"
                style={{ left: `${s.pin.x}%`, top: `${s.pin.y}%` }}
              >
                <div className="flex flex-col items-center">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center border-2 border-white shadow-lg ${
                      paid ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5 text-white" fill="currentColor" />
                  </div>
                  <div className="w-0.5 h-2 bg-rose-500/60" />
                  <span className="mt-0.5 text-[10px] font-bold text-ink-800 bg-white/80 px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
                    {idx + 1}. {(s.customer_name ?? 'Stop').split(' ')[0]}
                  </span>
                </div>
              </div>
            );
          })}

          <div className="absolute bottom-3 right-3 flex flex-col gap-1 bg-white/85 backdrop-blur rounded-lg p-2 text-[10px] font-semibold text-ink-700">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Pending
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Paid
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> You
            </div>
          </div>

          <div className="absolute top-3 left-3 bg-white/85 backdrop-blur rounded-lg px-2.5 py-1.5 text-xs font-bold text-ink-800 flex items-center gap-1.5">
            <Map className="w-3.5 h-3.5 text-brand-600" /> Route Map
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {stops.map((stop, idx) => (
          <div
            key={stop.id}
            className="card p-4 flex items-center gap-3 animate-slide-up hover:shadow-card-hover transition-all"
          >
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
                <span className="font-semibold text-ink-700">
                  {formatCurrency(stop.emi || stop.outstanding_balance)}
                </span>
              </div>
            </div>
            <button
              onClick={() => navigateTo(stop.customer_name ?? 'stop')}
              className="btn-primary text-xs font-semibold px-3 py-2.5 rounded-lg flex items-center gap-1.5 flex-shrink-0"
            >
              <Navigation className="w-3.5 h-3.5" /> Navigate
            </button>
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
