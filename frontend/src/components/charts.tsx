import { type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'blue',
  trend,
  sublabel,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: 'blue' | 'green' | 'amber' | 'rose' | 'violet' | 'cyan';
  trend?: { value: string; up: boolean };
  sublabel?: string;
}) {
  const tones = {
    blue: { bg: 'bg-brand-50', fg: 'text-brand-600', ring: 'ring-brand-100' },
    green: { bg: 'bg-emerald-50', fg: 'text-emerald-600', ring: 'ring-emerald-100' },
    amber: { bg: 'bg-amber-50', fg: 'text-amber-600', ring: 'ring-amber-100' },
    rose: { bg: 'bg-rose-50', fg: 'text-rose-600', ring: 'ring-rose-100' },
    violet: { bg: 'bg-violet-50', fg: 'text-violet-600', ring: 'ring-violet-100' },
    cyan: { bg: 'bg-cyan-50', fg: 'text-cyan-600', ring: 'ring-cyan-100' },
  } as const;
  const t = tones[tone];
  return (
    <div className="card p-4 sm:p-5 hover:shadow-card-hover transition-all duration-300 group">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide">{label}</p>
          <p className="text-lg sm:text-2xl font-bold text-ink-900 mt-1.5 leading-tight break-words">{value}</p>
          {sublabel && <p className="text-xs text-ink-400 mt-0.5">{sublabel}</p>}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              {trend.up ? (
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
              )}
              <span
                className={`text-xs font-semibold ${trend.up ? 'text-emerald-600' : 'text-rose-600'}`}
              >
                {trend.value}
              </span>
            </div>
          )}
        </div>
        <div
          className={`shrink-0 w-9 h-9 sm:w-11 sm:h-11 rounded-xl ${t.bg} ${t.fg} flex items-center justify-center ring-2 sm:ring-4 ${t.ring} group-hover:scale-110 transition-transform`}
        >
          <Icon className="w-5 h-5 sm:w-5.5 sm:h-5.5" strokeWidth={2.2} />
        </div>
      </div>
    </div>
  );
}

export function ChartCard({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`card p-5 ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-ink-800">{title}</h3>
          {subtitle && <p className="text-xs text-ink-400 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/**
 * Lightweight dependency-free SVG charts.
 */

export function TrendChart({
  data,
  height = 180,
  color = '#a87615',
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
}) {
  if (data.length === 0) return null;
  const w = 600;
  const h = height;
  const pad = { top: 16, right: 16, bottom: 28, left: 44 };
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;
  const max = Math.max(...data.map((d) => d.value), 1);
  const step = innerW / Math.max(data.length - 1, 1);
  const points = data.map((d, i) => {
    const x = pad.left + i * step;
    const y = pad.top + innerH - (d.value / max) * innerH;
    return { x, y, ...d };
  });
  const linePath = points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x},${pad.top + innerH} L${points[0].x},${pad.top + innerH} Z`;
  const yTicks = 4;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const y = pad.top + (innerH / yTicks) * i;
        const val = Math.round((max / yTicks) * (yTicks - i));
        return (
          <g key={i}>
            <line x1={pad.left} y1={y} x2={w - pad.right} y2={y} stroke="#f1f5f9" strokeWidth="1" />
            <text x={pad.left - 8} y={y + 3} textAnchor="end" className="fill-ink-400 text-[10px]">
              {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
            </text>
          </g>
        );
      })}
      <path d={areaPath} fill="url(#trendGrad)" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3.5" fill="white" stroke={color} strokeWidth="2" />
          <text x={p.x} y={h - 8} textAnchor="middle" className="fill-ink-400 text-[10px]">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function DonutChart({
  data,
  size = 170,
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = size / 2 - 16;
  const cx = size / 2;
  const cy = size / 2;
  let cumulative = 0;
  const segments = data.map((d) => {
    const startAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    cumulative += d.value;
    const endAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    const path = `M${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2}`;
    return { path, color: d.color, label: d.label, value: d.value };
  });

  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map((s, i) => (
          <path key={i} d={s.path} fill="none" stroke={s.color} strokeWidth="18" strokeLinecap="round" />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" className="fill-ink-900 font-bold" fontSize="18">
          {total}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="fill-ink-400" fontSize="11">
          Total
        </text>
      </svg>
      <div className="space-y-2 flex-1">
        {data.map((d, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ background: d.color }} />
              <span className="text-xs text-ink-600">{d.label}</span>
            </div>
            <span className="text-xs font-semibold text-ink-800">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Dependency-free 3D pie chart. The top face is drawn on a tilted ellipse and
 * each visible front slice is extruded downward to form a solid side wall, with
 * glossy radial-gradient shading — no external chart library needed.
 */
export function Pie3DChart({
  data,
  size = 240,
  depth = 24,
  tilt = 0.58,
  centerLabel,
  formatValue = (v: number) => String(Math.round(v)),
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
  depth?: number;
  tilt?: number;
  centerLabel?: string;
  formatValue?: (v: number) => string;
}) {
  const slices = data.filter((d) => d.value > 0);
  const total = slices.reduce((s, d) => s + d.value, 0);
  const w = size;
  const h = size * tilt + depth + 8;
  const cx = w / 2;
  const rx = w / 2 - 8;
  const ry = rx * tilt;
  const cy = ry + 6;

  const uid = `pie3d-${Math.random().toString(36).slice(2, 8)}`;

  // Darken a #rrggbb colour by a factor for the side walls / gradients.
  const shade = (hex: string, f: number) => {
    const n = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * f)));
    const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * f)));
    const b = Math.max(0, Math.min(255, Math.round((n & 255) * f)));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  };

  const pt = (a: number, dy = 0) => [cx + rx * Math.cos(a), cy + ry * Math.sin(a) + dy] as const;

  // Build angular segments, starting at the top (−90°) going clockwise.
  type Seg = { s: number; e: number; color: string; label: string; value: number };
  const segs: Seg[] = [];
  let cum = -Math.PI / 2;
  for (const d of slices) {
    const frac = total ? d.value / total : 0;
    const s = cum;
    const e = cum + frac * 2 * Math.PI;
    cum = e;
    segs.push({ s, e, color: d.color, label: d.label, value: d.value });
  }

  // Front region (visible side walls) is where sin(angle) > 0, i.e. (0, π).
  const FRONT_START = 0;
  const FRONT_END = Math.PI;
  const wallFor = (s: number, e: number) => {
    // Normalise to [0, 2π) and split wrap-arounds so we can intersect the front.
    const parts: [number, number][] = [];
    let a0 = s;
    let a1 = e;
    const TWO = Math.PI * 2;
    a0 = ((a0 % TWO) + TWO) % TWO;
    a1 = a0 + (e - s);
    const raw: [number, number][] = a1 > TWO ? [[a0, TWO], [0, a1 - TWO]] : [[a0, a1]];
    for (const [x0, x1] of raw) {
      const w0 = Math.max(x0, FRONT_START);
      const w1 = Math.min(x1, FRONT_END);
      if (w1 > w0) parts.push([w0, w1]);
    }
    return parts;
  };

  const arc = (a0: number, a1: number, dy: number, sweep: 0 | 1) => {
    const [x0, y0] = pt(a0, dy);
    const [x1, y1] = pt(a1, dy);
    const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
    return { start: [x0, y0] as const, d: `A${rx},${ry} 0 ${large} ${sweep} ${x1},${y1}` };
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-auto overflow-visible"
        style={{ maxWidth: w, filter: 'drop-shadow(0 10px 12px rgba(15,23,42,0.18))' }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {segs.map((sg, i) => (
            <radialGradient key={i} id={`${uid}-g${i}`} cx="42%" cy="34%" r="72%">
              <stop offset="0%" stopColor={shade(sg.color, 1.22)} />
              <stop offset="62%" stopColor={sg.color} />
              <stop offset="100%" stopColor={shade(sg.color, 0.82)} />
            </radialGradient>
          ))}
        </defs>

        {/* Side walls (extruded front rim), drawn first so the top face sits over them. */}
        {segs.map((sg, i) =>
          wallFor(sg.s, sg.e).map(([w0, w1], j) => {
            const top = arc(w0, w1, 0, 1);
            const bottom = arc(w1, w0, depth, 0);
            const path = `M${top.start[0]},${top.start[1]} ${top.d} L${bottom.start[0]},${bottom.start[1]} ${bottom.d} Z`;
            return <path key={`${i}-${j}`} d={path} fill={shade(sg.color, 0.7)} />;
          }),
        )}

        {/* Top faces. */}
        {segs.map((sg, i) => {
          if (segs.length === 1) {
            // Single slice = full ellipse.
            return (
              <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${uid}-g${i})`} stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
            );
          }
          const top = arc(sg.s, sg.e, 0, 1);
          const path = `M${cx},${cy} L${top.start[0]},${top.start[1]} ${top.d} Z`;
          return <path key={i} d={path} fill={`url(#${uid}-g${i})`} stroke="rgba(255,255,255,0.45)" strokeWidth="1" />;
        })}

        {centerLabel && (
          <text x={cx} y={cy + 4} textAnchor="middle" className="fill-white font-bold" fontSize="13" style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}>
            {centerLabel}
          </text>
        )}
      </svg>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 w-full max-w-sm mx-auto">
        {slices.map((d, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-3 h-3 rounded-md shrink-0 shadow-sm" style={{ background: d.color }} />
              <span className="text-xs text-ink-600 truncate">{d.label}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-ink-800 tabular-nums">{formatValue(d.value)}</span>
              <span className="text-[10px] font-semibold text-ink-400 w-9 text-right tabular-nums">
                {total ? Math.round((d.value / total) * 100) : 0}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BarChart({
  data,
  height = 180,
}: {
  data: { label: string; value: number; color?: string }[];
  height?: number;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end justify-between gap-2" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
          <span className="text-xs font-semibold text-ink-700">
            {d.value >= 1000 ? `${(d.value / 1000).toFixed(0)}k` : d.value}
          </span>
          <div
            className="w-full rounded-t-lg transition-all hover:opacity-80"
            style={{
              height: `${(d.value / max) * 100}%`,
              background: d.color ?? '#a87615',
              minHeight: '4px',
            }}
          />
          <span className="text-[10px] text-ink-400 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function ProgressChart({
  segments,
  height = 10,
}: {
  segments: { value: number; color: string; label: string }[];
  height?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div>
      <div className="flex w-full rounded-full overflow-hidden" style={{ height }}>
        {segments.map((s, i) => (
          <div
            key={i}
            style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
            className="transition-all"
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3 mt-2">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
            <span className="text-[11px] text-ink-500">
              {s.label} ({Math.round((s.value / total) * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
