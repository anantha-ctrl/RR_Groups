import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Download, Loader2, FileText } from 'lucide-react';
import { supabase } from '../supabaseClient';
import type { RepaymentSchedule, Loan } from '../types';
import { formatCurrency, formatDate } from '../calc';
import { PageHeader, StatusBadge, Select, EmptyState } from '../components/ui';

type LoanOption = Pick<Loan, 'id' | 'loan_number' | 'customer_name'>;

function downloadCSV(filename: string, rows: string[][]) {
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const body = rows.map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="card px-4 py-3 flex flex-col gap-0.5">
      <span className="text-[11px] uppercase tracking-wide text-ink-500 font-medium">{label}</span>
      <span className={`text-sm font-semibold ${accent ?? 'text-ink-900'}`}>{value}</span>
    </div>
  );
}

function StatTile({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${tone}`}>
      <p className="text-[11px] uppercase tracking-wide font-medium opacity-80">{label}</p>
      <p className="text-lg font-bold mt-0.5">{value}</p>
    </div>
  );
}

function rowTint(status: RepaymentSchedule['status']): string {
  switch (status) {
    case 'paid':
      return 'bg-emerald-50/60 border-l-2 border-emerald-400';
    case 'partial':
      return 'bg-amber-50/60 border-l-2 border-amber-400';
    case 'overdue':
      return 'bg-rose-50/60 border-l-2 border-rose-400';
    default:
      return 'bg-white border-l-2 border-transparent';
  }
}

export default function RepaymentScheduleScreen({ onNavigate }: { onNavigate: (id: string) => void }) {
  const [loans, setLoans] = useState<LoanOption[]>([]);
  const [selectedLoanId, setSelectedLoanId] = useState<string>('');
  const [loan, setLoan] = useState<Loan | null>(null);
  const [schedule, setSchedule] = useState<RepaymentSchedule[]>([]);
  const [loadingLoans, setLoadingLoans] = useState(true);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingLoans(true);
      const { data } = await supabase
        .from('loans')
        .select('id, loan_number, customer_name')
        .order('created_at', { ascending: false });
      if (!active) return;
      const list = (data ?? []) as LoanOption[];
      setLoans(list);
      if (list[0]) setSelectedLoanId(list[0].id);
      setLoadingLoans(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedLoanId) {
      setLoan(null);
      setSchedule([]);
      return;
    }
    let active = true;
    (async () => {
      setLoadingData(true);
      const [loanRes, schedRes] = await Promise.all([
        supabase.from('loans').select('*').eq('id', selectedLoanId).single(),
        supabase
          .from('repayment_schedule')
          .select('*')
          .eq('loan_id', selectedLoanId)
          .order('installment_no'),
      ]);
      if (!active) return;
      setLoan((loanRes.data as Loan | null) ?? null);
      setSchedule((schedRes.data as RepaymentSchedule[] | null) ?? []);
      setLoadingData(false);
    })();
    return () => {
      active = false;
    };
  }, [selectedLoanId]);

  const stats = useMemo(() => {
    const total = schedule.length;
    const paid = schedule.filter((s) => s.status === 'paid').length;
    const pending = schedule.filter((s) => s.status === 'pending').length;
    const overdue = schedule.filter((s) => s.status === 'overdue').length;
    const next = schedule.find((s) => s.status === 'pending' || s.status === 'overdue');
    return { total, paid, pending, overdue, nextDue: next?.due_date ?? null };
  }, [schedule]);

  const handleDownload = () => {
    if (!loan) return;
    const header = ['Installment No', 'Due Date', 'EMI Amount', 'Paid Amount', 'Balance', 'Status'];
    const rows = schedule.map((s) => [
      String(s.installment_no),
      formatDate(s.due_date),
      String(s.emi_amount),
      String(s.paid_amount),
      String(s.balance),
      s.status,
    ]);
    downloadCSV(`schedule_${loan.loan_number}.csv`, [header, ...rows]);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Repayment Schedule"
        subtitle="Track installment-wise EMI collections and outstanding balances"
        actions={
          <button
            className="btn-primary inline-flex items-center gap-2"
            onClick={handleDownload}
            disabled={!loan || schedule.length === 0}
          >
            <Download className="w-4 h-4" />
            Download Schedule
          </button>
        }
      />

      <div className="card p-4 mb-5">
        <label className="label block mb-1.5">Select Loan</label>
        {loadingLoans ? (
          <div className="flex items-center gap-2 text-ink-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading loans…
          </div>
        ) : loans.length === 0 ? (
          <p className="text-sm text-ink-500">No loans available.</p>
        ) : (
          <Select value={selectedLoanId} onChange={(e) => setSelectedLoanId(e.target.value)}>
            {loans.map((l) => (
              <option key={l.id} value={l.id}>
                {l.loan_number} — {l.customer_name ?? 'Unknown'}
              </option>
            ))}
          </Select>
        )}
      </div>

      {!selectedLoanId && !loadingLoans ? (
        <EmptyState
          icon={FileText}
          title="No loan selected"
          description="Select a loan above to view its repayment schedule."
        />
      ) : loadingData ? (
        <div className="flex items-center justify-center py-16 text-ink-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading schedule…
        </div>
      ) : !loan ? (
        <EmptyState icon={FileText} title="Loan not found" description="The selected loan could not be loaded." />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <SummaryCard label="Loan Number" value={loan.loan_number} />
            <SummaryCard label="Customer" value={loan.customer_name ?? '-'} />
            <SummaryCard label="Loan Amount" value={formatCurrency(loan.loan_amount)} />
            <SummaryCard label="EMI" value={formatCurrency(loan.emi)} />
            <SummaryCard label="Total Repayment" value={formatCurrency(loan.total_repayment)} />
            <SummaryCard
              label="Outstanding"
              value={formatCurrency(loan.outstanding_balance)}
              accent={loan.outstanding_balance > 0 ? 'text-rose-600' : 'text-emerald-600'}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <StatTile label="Total Inst." value={stats.total} tone="bg-ink-50 border-ink-200 text-ink-800" />
            <StatTile label="Paid" value={stats.paid} tone="bg-emerald-50 border-emerald-200 text-emerald-700" />
            <StatTile label="Pending" value={stats.pending} tone="bg-amber-50 border-amber-200 text-amber-700" />
            <StatTile label="Overdue" value={stats.overdue} tone="bg-rose-50 border-rose-200 text-rose-700" />
            <StatTile
              label="Next Due"
              value={formatDate(stats.nextDue)}
              tone="bg-brand-50 border-brand-200 text-brand-700"
            />
          </div>

          {schedule.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="No schedule generated"
              description="This loan does not have any repayment installments yet."
            />
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-ink-50 text-left">
                      <th className="table-head">Inst. No</th>
                      <th className="table-head">Due Date</th>
                      <th className="table-head text-right">EMI Amount</th>
                      <th className="table-head text-right">Paid Amount</th>
                      <th className="table-head text-right">Balance</th>
                      <th className="table-head">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map((s) => (
                      <tr key={s.id} className={`border-t border-ink-100 ${rowTint(s.status)}`}>
                        <td className="table-cell font-medium text-ink-800">#{s.installment_no}</td>
                        <td className="table-cell text-ink-700">{formatDate(s.due_date)}</td>
                        <td className="table-cell text-right text-ink-800">{formatCurrency(s.emi_amount)}</td>
                        <td
                          className={`table-cell text-right ${
                            s.status === 'partial' ? 'text-amber-600 font-semibold' : 'text-ink-800'
                          }`}
                        >
                          {formatCurrency(s.paid_amount)}
                        </td>
                        <td className="table-cell text-right text-ink-700">{formatCurrency(s.balance)}</td>
                        <td className="table-cell">
                          <StatusBadge status={s.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <button
        type="button"
        className="sr-only"
        onClick={() => onNavigate(loan?.id ?? selectedLoanId)}
        aria-hidden
      />
    </div>
  );
}
