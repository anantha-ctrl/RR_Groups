import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { Loan, Collection, Customer, Profile } from '../types';
import { formatCurrency, formatDate } from '../calc';
import { exportData, type ExportColumn, type ExportFormat } from '../export';
import { PageHeader, Badge, EmptyState } from '../components/ui';
import { BarChart, TrendChart, ChartCard } from '../components/charts';
import {
  FileBarChart,
  Download,
  FileText,
  TrendingUp,
  Users,
  Wallet,
  Loader2,
  FileSpreadsheet,
  IndianRupee,
  Calendar,
} from 'lucide-react';

type ReportType = 'daily' | 'monthly' | 'agent' | 'daily_report' | 'monthly_report' | 'agent_performance';

const TABS: { id: ReportType; label: string }[] = [
  { id: 'daily', label: 'Daily Report' },
  { id: 'monthly', label: 'Monthly Report' },
  { id: 'agent', label: 'Agent Performance' },
];

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  const dt = new Date(Number(y), Number(m) - 1, 1);
  return dt.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

// Local YYYY-MM-DD (avoids the UTC shift that toISOString() introduces).
function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type ExpRow = Record<string, string | number | null | undefined>;

export default function ReportsScreen({ onNavigate }: { onNavigate: (id: string) => void }) {
  const [reportType, setReportType] = useState<ReportType>('daily');
  const [loans, setLoans] = useState<Loan[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const todayStr = localDate(now);
  const [startDate, setStartDate] = useState(localDate(firstOfMonth));
  const [endDate, setEndDate] = useState(todayStr);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [lo, co, cu, pr] = await Promise.all([
          supabase.from('loans').select('*'),
          supabase.from('collections').select('*'),
          supabase.from('customers').select('*'),
          supabase.from('profiles').select('*'),
        ]);
        if (mounted) {
          if (lo.error) throw lo.error;
          if (co.error) throw co.error;
          if (cu.error) throw cu.error;
          if (pr.error) throw pr.error;
          setLoans((lo.data as Loan[]) ?? []);
          setCollections((co.data as Collection[]) ?? []);
          setCustomers((cu.data as Customer[]) ?? []);
          setProfiles((pr.data as Profile[]) ?? []);
        }
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Failed to load report data');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const agentName = (id: string | null): string => {
    if (!id) return 'Unassigned';
    const p = profiles.find((x) => x.id === id);
    return p?.full_name ?? 'Unknown Agent';
  };

  const dailyCollections = useMemo(
    () =>
      collections.filter(
        (c) => (c.collection_date ?? c.created_at ?? '').slice(0, 10) === todayStr,
      ),
    [collections, todayStr],
  );

  const dailyLoans = useMemo(
    () =>
      loans
        .filter((l) => (l.created_at ?? '').slice(0, 10) === todayStr)
        .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')),
    [loans, todayStr],
  );

  const monthlySummary = useMemo(() => {
    const inRange = (dt: string) => {
      const d = (dt ?? '').slice(0, 10);
      return d >= startDate && d <= endDate;
    };
    const rangeLoans = loans.filter((l) => inRange(l.created_at));
    const rangeCollections = collections.filter((c) =>
      inRange(c.collection_date ?? c.created_at),
    );
    const newCustomers = customers.filter((c) => inRange(c.created_at));
    const disbursement = rangeLoans.reduce((s, l) => s + (l.loan_amount ?? 0), 0);
    const interest = rangeLoans.reduce((s, l) => s + (l.total_interest ?? 0), 0);
    const collected = rangeCollections.reduce((s, c) => s + (c.collection_amount ?? 0), 0);
    return {
      disbursement,
      interest,
      collected,
      newCustomers: newCustomers.length,
      rangeLoans,
      rangeCollections,
    };
  }, [loans, collections, customers, startDate, endDate]);

  const collectionTrend = useMemo(() => {
    const months: { key: string }[] = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: monthKey(d) });
    }
    return months.map((m) => ({
      label: monthLabel(m.key),
      value: collections
        .filter((c) => (c.collection_date ?? c.created_at ?? '').slice(0, 7) === m.key)
        .reduce((s, c) => s + (c.collection_amount ?? 0), 0),
    }));
  }, [collections, now]);

  const disbursementByMonth = useMemo(() => {
    const months: { key: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: monthKey(d) });
    }
    return months.map((m) => ({
      label: monthLabel(m.key),
      value: loans
        .filter((l) => (l.created_at ?? '').slice(0, 7) === m.key)
        .reduce((s, l) => s + (l.loan_amount ?? 0), 0),
    }));
  }, [loans, now]);

  const agentRows = useMemo(() => {
    const inRange = (dt: string) => {
      const d = (dt ?? '').slice(0, 10);
      return d >= startDate && d <= endDate;
    };
    const map = new Map<
      string,
      { name: string; assigned: number; collCount: number; collSum: number; paidLoans: number; totalLoans: number }
    >();
    for (const p of profiles.filter((x) => x.role === 'agent')) {
      map.set(p.id, {
        name: p.full_name,
        assigned: 0,
        collCount: 0,
        collSum: 0,
        paidLoans: 0,
        totalLoans: 0,
      });
    }
    const unassigned = map.get('__unassigned') ?? {
      name: 'Unassigned',
      assigned: 0,
      collCount: 0,
      collSum: 0,
      paidLoans: 0,
      totalLoans: 0,
    };
    map.set('__unassigned', unassigned);

    for (const c of customers) {
      const key = c.assigned_agent ?? '__unassigned';
      const row = map.get(key);
      if (row) row.assigned += 1;
    }
    for (const c of collections.filter((c) => inRange(c.collection_date ?? c.created_at))) {
      const key = c.agent_id ?? '__unassigned';
      const row = map.get(key);
      if (row) {
        row.collCount += 1;
        row.collSum += c.collection_amount ?? 0;
      }
    }
    for (const l of loans) {
      const key = l.assigned_agent ?? '__unassigned';
      const row = map.get(key);
      if (row) {
        row.totalLoans += 1;
        if (l.status === 'closed') row.paidLoans += 1;
        else if (l.outstanding_balance !== undefined && l.outstanding_balance <= 0) row.paidLoans += 1;
      }
    }
    return Array.from(map.entries())
      .filter(([k, v]) => k !== '__unassigned' || v.collCount > 0 || v.assigned > 0)
      .map(([id, v]) => ({
        id,
        ...v,
        efficiency: v.totalLoans > 0 ? Math.round((v.paidLoans / v.totalLoans) * 100) : 0,
      }))
      .sort((a, b) => b.collSum - a.collSum);
  }, [customers, collections, loans, profiles, startDate, endDate]);

  const agentChart = useMemo(
    () =>
      agentRows
        .filter((r) => r.id !== '__unassigned')
        .map((r) => ({ label: r.name.split(' ')[0], value: r.collSum })),
    [agentRows],
  );

  const buildExport = (): { filename: string; title: string; columns: ExportColumn<ExpRow>[]; rows: ExpRow[] } => {
    if (reportType === 'daily') {
      const rows: ExpRow[] = [
        ...dailyCollections.map((c) => ({
          type: 'Collection',
          customer: c.customer_name ?? '-',
          reference: c.loan_number ?? '-',
          amount: c.collection_amount ?? 0,
          method: c.payment_method ?? '-',
          agent: c.agent_name ?? agentName(c.agent_id),
        })),
        ...dailyLoans.map((l) => ({
          type: 'New Loan',
          customer: l.customer_name ?? '-',
          reference: l.loan_number,
          amount: l.loan_amount,
          method: '',
          agent: '',
        })),
      ];
      return {
        filename: `daily_report_${todayStr}`,
        title: `Daily Report — ${formatDate(todayStr)}`,
        columns: [
          { header: 'Type', value: (r) => r.type },
          { header: 'Customer', value: (r) => r.customer },
          { header: 'Reference', value: (r) => r.reference },
          { header: 'Amount', value: (r) => r.amount },
          { header: 'Method', value: (r) => r.method },
          { header: 'Agent', value: (r) => r.agent },
        ],
        rows,
      };
    }
    if (reportType === 'monthly') {
      const rows: ExpRow[] = [
        { metric: 'Loan Disbursement', value: monthlySummary.disbursement },
        { metric: 'Interest Earned', value: monthlySummary.interest },
        { metric: 'Collection Total', value: monthlySummary.collected },
        { metric: 'New Customers', value: monthlySummary.newCustomers },
      ];
      return {
        filename: `monthly_report_${startDate}_${endDate}`,
        title: `Monthly Report (${formatDate(startDate)} - ${formatDate(endDate)})`,
        columns: [
          { header: 'Metric', value: (r) => r.metric },
          { header: 'Value', value: (r) => r.value },
        ],
        rows,
      };
    }
    const rows: ExpRow[] = agentRows.map((r) => ({
      agent: r.name,
      assigned: r.assigned,
      collections: r.collCount,
      collected: r.collSum,
      efficiency: `${r.efficiency}%`,
    }));
    return {
      filename: `agent_performance_${startDate}_${endDate}`,
      title: `Agent Performance (${formatDate(startDate)} - ${formatDate(endDate)})`,
      columns: [
        { header: 'Agent', value: (r) => r.agent },
        { header: 'Assigned', value: (r) => r.assigned },
        { header: 'Collections', value: (r) => r.collections },
        { header: 'Collected', value: (r) => r.collected },
        { header: 'Efficiency', value: (r) => r.efficiency },
      ],
      rows,
    };
  };

  const handleExport = (format: ExportFormat): void => {
    void exportData(format, buildExport()).catch(() => {});
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-ink-400 animate-fade-in">
        <Loader2 className="w-8 h-8 animate-spin mb-3" />
        <p className="text-sm font-medium">Loading reports…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="animate-fade-in">
        <EmptyState
          icon={FileBarChart}
          title="Couldn't load reports"
          description={error}
          action={
            <button className="btn-primary" onClick={() => onNavigate('reports')}>
              Retry
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto animate-fade-in">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Daily, monthly and agent performance insights"
        actions={
          <>
            <button className="btn-secondary" onClick={() => handleExport('pdf')}>
              <FileText className="w-4 h-4" />
              Export PDF
            </button>
            <button className="btn-primary" onClick={() => handleExport('excel')}>
              <Download className="w-4 h-4" />
              Export Excel
            </button>
          </>
        }
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <div className="inline-flex p-1 bg-ink-100 rounded-xl self-start">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setReportType(t.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                reportType === t.id
                  ? 'bg-white text-ink-900 shadow-sm'
                  : 'text-ink-500 hover:text-ink-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 sm:ml-auto flex-wrap">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-ink-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input py-1.5 text-sm w-auto"
            />
            <span className="text-ink-400 text-xs">→</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input py-1.5 text-sm w-auto"
            />
          </div>
        </div>
      </div>

      {reportType === 'daily' && (
        <div className="space-y-6">
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-ink-100 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-brand-600" />
              <h3 className="text-sm font-bold text-ink-800">Today's Collections</h3>
              <Badge color="blue">{dailyCollections.length}</Badge>
            </div>
            {dailyCollections.length === 0 ? (
              <EmptyState icon={Wallet} title="No collections today" description="Collections made today will appear here." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-ink-50">
                      <th className="table-head">Customer</th>
                      <th className="table-head">Loan</th>
                      <th className="table-head">Amount</th>
                      <th className="table-head">Method</th>
                      <th className="table-head">Agent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyCollections.map((c) => (
                      <tr key={c.id} className="border-t border-ink-100 hover:bg-ink-50">
                        <td className="table-cell font-medium text-ink-800">{c.customer_name ?? '-'}</td>
                        <td className="table-cell text-ink-600">{c.loan_number ?? '-'}</td>
                        <td className="table-cell font-semibold text-emerald-600">{formatCurrency(c.collection_amount ?? 0)}</td>
                        <td className="table-cell"><Badge color="gray">{c.payment_method}</Badge></td>
                        <td className="table-cell text-ink-600">{c.agent_name ?? agentName(c.agent_id)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-ink-100 flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-brand-600" />
              <h3 className="text-sm font-bold text-ink-800">New Loans Created Today</h3>
              <Badge color="purple">{dailyLoans.length}</Badge>
            </div>
            {dailyLoans.length === 0 ? (
              <EmptyState icon={FileSpreadsheet} title="No new loans today" description="Loans created today will appear here." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-ink-50">
                      <th className="table-head">Loan No</th>
                      <th className="table-head">Customer</th>
                      <th className="table-head">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyLoans.map((l) => (
                      <tr key={l.id} className="border-t border-ink-100 hover:bg-ink-50">
                        <td className="table-cell font-medium text-ink-800">{l.loan_number}</td>
                        <td className="table-cell text-ink-600">{l.customer_name ?? '-'}</td>
                        <td className="table-cell font-semibold text-ink-900">{formatCurrency(l.loan_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {reportType === 'monthly' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide">Loan Disbursement</p>
                  <p className="text-2xl font-bold text-ink-900 mt-1.5">{formatCurrency(monthlySummary.disbursement)}</p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center ring-4 ring-brand-100">
                  <Wallet className="w-5 h-5" strokeWidth={2.2} />
                </div>
              </div>
            </div>
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide">Interest Earned</p>
                  <p className="text-2xl font-bold text-ink-900 mt-1.5">{formatCurrency(monthlySummary.interest)}</p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center ring-4 ring-emerald-100">
                  <TrendingUp className="w-5 h-5" strokeWidth={2.2} />
                </div>
              </div>
            </div>
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide">Collection Total</p>
                  <p className="text-2xl font-bold text-ink-900 mt-1.5">{formatCurrency(monthlySummary.collected)}</p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center ring-4 ring-violet-100">
                  <IndianRupee className="w-5 h-5" strokeWidth={2.2} />
                </div>
              </div>
            </div>
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide">New Customers</p>
                  <p className="text-2xl font-bold text-ink-900 mt-1.5">{monthlySummary.newCustomers}</p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center ring-4 ring-amber-100">
                  <Users className="w-5 h-5" strokeWidth={2.2} />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="Collections Trend" subtitle="Last 8 months">
              {collectionTrend.every((d) => d.value === 0) ? (
                <EmptyState icon={TrendingUp} title="No collection data" />
              ) : (
                <TrendChart data={collectionTrend} color="#a87615" />
              )}
            </ChartCard>
            <ChartCard title="Loan Disbursement" subtitle="By month">
              {disbursementByMonth.every((d) => d.value === 0) ? (
                <EmptyState icon={Wallet} title="No disbursement data" />
              ) : (
                <BarChart data={disbursementByMonth} />
              )}
            </ChartCard>
          </div>
        </div>
      )}

      {reportType === 'agent' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 card overflow-hidden">
              <div className="px-5 py-4 border-b border-ink-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-brand-600" />
                <h3 className="text-sm font-bold text-ink-800">Agent Performance</h3>
                <Badge color="blue">{agentRows.length}</Badge>
              </div>
              {agentRows.length === 0 ? (
                <EmptyState icon={Users} title="No agent data" description="Agents and their activity will appear here." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-ink-50">
                        <th className="table-head">Agent</th>
                        <th className="table-head">Assigned</th>
                        <th className="table-head">Collections</th>
                        <th className="table-head">Collected Amt</th>
                        <th className="table-head">Efficiency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agentRows.map((r) => (
                        <tr key={r.id} className="border-t border-ink-100 hover:bg-ink-50">
                          <td className="table-cell font-medium text-ink-800">{r.name}</td>
                          <td className="table-cell text-ink-600">{r.assigned}</td>
                          <td className="table-cell text-ink-600">
                            {r.collCount} <span className="text-ink-400">/ {formatCurrency(r.collSum)}</span>
                          </td>
                          <td className="table-cell font-semibold text-ink-900">{formatCurrency(r.collSum)}</td>
                          <td className="table-cell">
                            <Badge color={r.efficiency > 80 ? 'green' : r.efficiency >= 60 ? 'yellow' : 'red'}>
                              {r.efficiency}%
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <ChartCard title="Collections by Agent" subtitle="Total amount collected" className="self-start">
              {agentChart.every((d) => d.value === 0) ? (
                <EmptyState icon={FileBarChart} title="No data" />
              ) : (
                <BarChart data={agentChart} />
              )}
            </ChartCard>
          </div>
        </div>
      )}
    </div>
  );
}
