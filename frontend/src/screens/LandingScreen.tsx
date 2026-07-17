import {
  Landmark, Wallet, Users, PieChart, MapPin, Bell, ShieldCheck, Receipt,
  CalendarClock, TrendingUp, Smartphone, ArrowRight, CheckCircle2,
  Layers, Building2,
} from 'lucide-react';

const FEATURES = [
  { icon: Landmark, tone: 'brand', title: 'Loan Management', desc: 'Monthly, weekly & daily plans with automatic EMI, interest and processing-fee calculation.' },
  { icon: Receipt, tone: 'emerald', title: 'Field Collections', desc: 'Digital receipts with photo proof and borrower signature captured right on the field.' },
  { icon: Layers, tone: 'violet', title: 'Chit Fund Groups', desc: 'Run chit groups end-to-end — members, monthly contributions and payout tracking.' },
  { icon: CalendarClock, tone: 'cyan', title: 'Repayment Schedules', desc: 'Auto-generated installment plans with real-time paid, partial and overdue status.' },
  { icon: PieChart, tone: 'amber', title: 'Reports & Analytics', desc: 'Portfolio health, collection efficiency and agent performance at a glance.' },
  { icon: MapPin, tone: 'rose', title: 'Agent Route Map', desc: 'Optimised daily collection routes so agents know exactly where to go next.' },
] as const;

const FEATURE_TONES: Record<string, string> = {
  brand: 'bg-brand-50 text-brand-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  violet: 'bg-violet-50 text-violet-600',
  cyan: 'bg-cyan-50 text-cyan-600',
  amber: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-600',
};

const ADMIN_POINTS = [
  'Full portfolio & user management',
  'Approve loans and assign agents',
  'Company-wide reports & settings',
  'Overdue tracking and recovery',
];
const AGENT_POINTS = [
  'Daily route with assigned customers',
  'Record collections on the go',
  'Instant digital receipts',
  'Push alerts for new assignments',
];

const STATS = [
  { value: '₹12 Cr+', label: 'Loans Disbursed' },
  { value: '180+', label: 'Field Agents' },
  { value: '50k+', label: 'Receipts Issued' },
  { value: '99.9%', label: 'Uptime SLA' },
];

function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <img
        src="/assets/rr-groups-logo.png"
        alt="RR Groups"
        className={`w-10 h-10 rounded-full object-cover shadow-sm ring-2 ${light ? 'ring-white/30' : 'ring-brand-200'}`}
      />
      <div className="leading-tight">
        <p className={`font-extrabold tracking-tight ${light ? 'text-white' : 'text-ink-900'}`}>RR Groups</p>
        <p className={`text-[10px] ${light ? 'text-brand-200' : 'text-ink-400'}`}>Loan &amp; Collection Suite</p>
      </div>
    </div>
  );
}

export default function LandingScreen({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="min-h-screen bg-white text-ink-800">
      {/* ───────────────── Nav ───────────────── */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-ink-100">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <Logo />
          <button onClick={onEnter} className="btn-primary">
            Sign In <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ───────────────── Hero ───────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-ink-900 via-ink-800 to-ink-900">
        {/* dot-grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.15] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />
        <div className="absolute inset-0 opacity-25 pointer-events-none">
          <div className="absolute -top-24 -left-16 w-96 h-96 rounded-full bg-brand-500 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-brand-400 blur-3xl" />
        </div>
        <div className="relative max-w-6xl mx-auto px-5 py-20 lg:py-28 grid lg:grid-cols-2 gap-12 items-center">
          <div className="animate-slide-up">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-brand-200 text-xs font-semibold ring-1 ring-white/15">
              <ShieldCheck className="w-3.5 h-3.5" /> Real-time loan &amp; collection management
            </span>
            <h1 className="mt-5 text-4xl sm:text-5xl font-extrabold text-white leading-[1.1]">
              Your lending business,<br />
              <span className="bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">
                fully in control.
              </span>
            </h1>
            <p className="mt-5 text-ink-200 text-lg max-w-lg leading-relaxed">
              Loans, repayments, chit funds and field collections — RR Groups brings your
              entire operation into one powerful, real-time platform built for Indian lenders.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={onEnter} className="btn-primary px-6 py-3 text-base">
                Get Started <ArrowRight className="w-4 h-4" />
              </button>
              <a href="#features" className="btn bg-white/10 text-white hover:bg-white/20 px-6 py-3 text-base ring-1 ring-white/15">
                Explore Features
              </a>
            </div>
            <div className="mt-8 flex items-center gap-2 text-ink-300 text-xs">
              <Smartphone className="w-4 h-4" /> Works on desktop &amp; mobile — no install required
            </div>
          </div>

          {/* Floating dashboard preview */}
          <div className="animate-slide-in-right hidden lg:block">
            <div className="relative">
              <div className="card !bg-white/95 p-5 shadow-card-hover">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs text-ink-400">Total Portfolio</p>
                    <p className="text-2xl font-extrabold text-ink-900">₹1,24,58,000</p>
                  </div>
                  <span className="badge bg-emerald-100 text-emerald-700">
                    <TrendingUp className="w-3.5 h-3.5" /> +18.4%
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { icon: Landmark, k: 'Active Loans', v: '342' },
                    { icon: Wallet, k: 'Collected Today', v: '₹4.2L' },
                    { icon: Users, k: 'Agents Out', v: '24' },
                  ].map((s) => (
                    <div key={s.k} className="rounded-xl bg-ink-50 p-3">
                      <s.icon className="w-4 h-4 text-brand-600 mb-1.5" />
                      <p className="text-sm font-bold text-ink-900">{s.v}</p>
                      <p className="text-[10px] text-ink-400 mt-0.5">{s.k}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  {[
                    { n: 'Ravi Kumar', a: '₹12,000', s: 'Paid' },
                    { n: 'Meena Traders', a: '₹8,500', s: 'Partial' },
                    { n: 'S. Balaji', a: '₹15,000', s: 'Overdue' },
                  ].map((r) => (
                    <div key={r.n} className="flex items-center justify-between rounded-lg border border-ink-100 px-3 py-2">
                      <span className="text-sm text-ink-700">{r.n}</span>
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-ink-900">{r.a}</span>
                        <span className={`badge ${r.s === 'Paid' ? 'bg-emerald-100 text-emerald-700'
                          : r.s === 'Partial' ? 'bg-amber-100 text-amber-700'
                            : 'bg-rose-100 text-rose-700'
                          }`}>{r.s}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute -bottom-4 -left-4 card p-3 flex items-center gap-2 shadow-card-hover">
                <span className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center">
                  <Bell className="w-4 h-4 text-brand-700" />
                </span>
                <div className="leading-tight">
                  <p className="text-xs font-semibold text-ink-900">New loan assigned</p>
                  <p className="text-[10px] text-ink-400">to Arjun Mehta · just now</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────── Stats band ───────────────── */}
      <section className="border-b border-ink-100 bg-ink-50/60">
        <div className="max-w-6xl mx-auto px-5 py-10 grid grid-cols-2 md:grid-cols-4 gap-6 divide-x divide-ink-100">
          {STATS.map((s) => (
            <div key={s.label} className="text-center px-2">
              <p className="text-3xl font-extrabold bg-gradient-to-br from-brand-600 to-brand-800 bg-clip-text text-transparent">
                {s.value}
              </p>
              <p className="text-xs font-medium text-ink-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────────── Features ───────────────── */}
      <section id="features" className="max-w-6xl mx-auto px-5 py-20">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-widest text-brand-600">Everything you need</span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-ink-900">One platform for your entire lending business</h2>
          <p className="mt-3 text-ink-500">From origination to the last-mile collection — RR Groups covers the whole journey.</p>
        </div>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group card p-6 hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 ${FEATURE_TONES[f.tone]}`}>
                <f.icon className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-ink-900">{f.title}</h3>
              <p className="mt-1.5 text-sm text-ink-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────────── Roles ───────────────── */}
      <section id="roles" className="bg-ink-50/60 border-y border-ink-100">
        <div className="max-w-6xl mx-auto px-5 py-20">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-widest text-brand-600">Built for every role</span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-ink-900">Admins plan. Agents deliver.</h2>
          </div>
          <div className="mt-12 grid md:grid-cols-2 gap-6">
            <div className="card p-8">
              <div className="flex items-center gap-3 mb-5">
                <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-white" />
                </span>
                <div>
                  <h3 className="font-bold text-ink-900 text-lg">Admin / Owner</h3>
                  <p className="text-xs text-ink-400">Run the whole operation</p>
                </div>
              </div>
              <ul className="space-y-3">
                {ADMIN_POINTS.map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-sm text-ink-700">
                    <CheckCircle2 className="w-4 h-4 text-brand-600 mt-0.5 shrink-0" /> {p}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card p-8">
              <div className="flex items-center gap-3 mb-5">
                <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-white" />
                </span>
                <div>
                  <h3 className="font-bold text-ink-900 text-lg">Collection Agent</h3>
                  <p className="text-xs text-ink-400">Win the last mile</p>
                </div>
              </div>
              <ul className="space-y-3">
                {AGENT_POINTS.map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-sm text-ink-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" /> {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────── Security ───────────────── */}
      <section id="security" className="max-w-6xl mx-auto px-5 py-20">
        <div className="card p-8 sm:p-12 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-brand-600">Trust &amp; security</span>
            <h2 className="mt-2 text-3xl font-extrabold text-ink-900">Your data stays protected</h2>
            <p className="mt-3 text-ink-500 leading-relaxed">
              Every session is protected with signed tokens, role-based access, and encrypted
              credentials. Sensitive records never leave your server.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: ShieldCheck, t: 'JWT authentication', d: 'Signed, expiring sessions' },
              { icon: Users, t: 'Role-based access', d: 'Admins & agents scoped separately' },
              { icon: Landmark, t: 'Self-hosted data', d: 'Runs on your own MySQL server' },
              { icon: Bell, t: 'Real-time alerts', d: 'Instant push notifications' },
            ].map((s) => (
              <div key={s.t} className="rounded-xl bg-ink-50 p-4">
                <s.icon className="w-5 h-5 text-brand-600 mb-2" />
                <p className="text-sm font-semibold text-ink-900">{s.t}</p>
                <p className="text-xs text-ink-400 mt-0.5">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────── CTA ───────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-ink-900">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute -top-20 right-10 w-80 h-80 rounded-full bg-brand-400 blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto px-5 py-16 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">Ready to streamline your collections?</h2>
          <p className="mt-3 text-brand-100">Sign in to your RR Groups account and get started in minutes.</p>
          <button onClick={onEnter} className="mt-8 btn bg-white text-brand-800 hover:bg-brand-50 px-8 py-3 text-base font-bold">
            Sign In to Dashboard <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* ───────────────── Footer ───────────────── */}
      <footer className="bg-ink-950 text-ink-300">
        <div className="max-w-6xl mx-auto px-5 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo light />
          <p className="text-xs text-ink-500">
            © {new Date().getFullYear()} RR Groups · Loan &amp; Collection Suite. All rights reserved. <br />Designed & Developed By <a href="https://www.cloudhawk.in" className="text-brand-400 hover:text-brand-300 transition-colors">CloudHawk</a>
          </p>
          <div className="flex items-center gap-2 text-xs text-ink-400">
            <ShieldCheck className="w-4 h-4" /> ISO 27001 · RBI compliant
          </div>
        </div>
      </footer>
    </div>
  );
}
