import { useEffect, useState } from 'react';
import { Landmark, Loader2, FileText, Download } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../auth';
import { PageHeader, StatusBadge, EmptyState, Modal, Badge } from '../components/ui';
import { formatCurrency, formatDate } from '../calc';
import { exportData, type ExportColumn } from '../export';
import type { Loan, RepaymentSchedule } from '../types';

export default function CustomerLoansScreen() {
  const { profile } = useAuth();
  const cid = profile?.customer_id ?? null;
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<Loan | null>(null);
  const [schedule, setSchedule] = useState<RepaymentSchedule[]>([]);
  const [loadingSched, setLoadingSched] = useState(false);

  useEffect(() => {
    if (!cid) { setLoading(false); return; }
    let active = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from('loans').select('*').eq('customer_id', cid).order('created_at', { ascending: false });
      if (!active) return;
      setLoans((data ?? []) as Loan[]);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [cid]);

  const openView = async (l: Loan) => {
    setViewing(l);
    setLoadingSched(true);
    const { data } = await supabase
      .from('repayment_schedule')
      .select('*')
      .eq('loan_id', l.id)
      .order('installment_no', { ascending: true });
    setSchedule((data ?? []) as RepaymentSchedule[]);
    setLoadingSched(false);
  };

  return (
    <div>
      <PageHeader title="My Loans" subtitle="Your active and past loan accounts" />

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
        ) : loans.length === 0 ? (
          <EmptyState icon={Landmark} title="No loans found" description="You have no loans on record yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/50">
                  {['Loan No', 'Amount', 'EMI', 'Outstanding', 'Type', 'Status', 'Start', ''].map((h) => (
                    <th key={h} className="table-head text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loans.map((l) => (
                  <tr key={l.id} className="border-b border-ink-50 hover:bg-ink-50/40">
                    <td className="table-cell font-medium text-ink-900">{l.loan_number}</td>
                    <td className="table-cell">{formatCurrency(l.loan_amount)}</td>
                    <td className="table-cell">{formatCurrency(l.emi)}</td>
                    <td className="table-cell font-semibold text-ink-900">{formatCurrency(l.outstanding_balance)}</td>
                    <td className="table-cell capitalize">{l.loan_type}</td>
                    <td className="table-cell"><StatusBadge status={l.status} /></td>
                    <td className="table-cell text-ink-500">{formatDate(l.start_date)}</td>
                    <td className="table-cell">
                      <button className="btn-secondary !py-1.5 text-xs" onClick={() => openView(l)}>
                        <FileText className="w-3.5 h-3.5" /> Schedule
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewing && (
        <Modal open onClose={() => setViewing(null)} title={`Loan ${viewing.loan_number}`} size="xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              ['Loan Amount', formatCurrency(viewing.loan_amount)],
              ['EMI', formatCurrency(viewing.emi)],
              ['Outstanding', formatCurrency(viewing.outstanding_balance)],
              ['Interest', `${viewing.interest_percentage}%`],
              ['Duration', `${viewing.loan_duration}`],
              ['Total Repayment', formatCurrency(viewing.total_repayment)],
              ['Start Date', formatDate(viewing.start_date)],
              ['Agent', viewing.agent_name ?? '—'],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-ink-50 p-3">
                <p className="text-xs text-ink-500">{k}</p>
                <p className="text-sm font-semibold text-ink-900 mt-0.5 truncate">{v}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mb-3">
            <Badge color={viewing.status === 'active' ? 'green' : viewing.status === 'overdue' ? 'red' : viewing.status === 'pending' ? 'yellow' : 'gray'}>
              {viewing.status}
            </Badge>
            <div className="flex items-center gap-2 ml-auto">
              <button className="btn-ghost !py-1.5" onClick={() => downloadSchedule(viewing, schedule, 'csv')}>
                <Download className="w-4 h-4" /> CSV
              </button>
              <button className="btn-ghost !py-1.5" onClick={() => downloadSchedule(viewing, schedule, 'pdf')}>
                <FileText className="w-4 h-4" /> PDF
              </button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-80 rounded-xl border border-ink-100">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 sticky top-0">
                <tr>{['#', 'Due Date', 'EMI', 'Paid', 'Balance', 'Status'].map((h) => (
                  <th key={h} className="table-head text-left">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {loadingSched ? (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-ink-400"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
                ) : schedule.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-ink-400">No schedule records.</td></tr>
                ) : schedule.map((r) => (
                  <tr key={r.id} className="border-t border-ink-50">
                    <td className="px-3 py-2 text-ink-600">{r.installment_no}</td>
                    <td className="px-3 py-2 text-ink-700">{formatDate(r.due_date)}</td>
                    <td className="px-3 py-2 text-ink-900 font-medium">{formatCurrency(r.emi_amount)}</td>
                    <td className="px-3 py-2 text-emerald-700">{formatCurrency(r.paid_amount)}</td>
                    <td className="px-3 py-2 text-ink-700">{formatCurrency(r.balance)}</td>
                    <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
}

const SCHEDULE_COLUMNS: ExportColumn<RepaymentSchedule>[] = [
  { header: 'Installment No', value: (r) => r.installment_no },
  { header: 'Due Date', value: (r) => formatDate(r.due_date) },
  { header: 'EMI Amount', value: (r) => r.emi_amount },
  { header: 'Paid Amount', value: (r) => r.paid_amount },
  { header: 'Balance', value: (r) => r.balance },
  { header: 'Status', value: (r) => r.status },
];

function downloadSchedule(loan: Loan, rows: RepaymentSchedule[], format: 'csv' | 'pdf') {
  void exportData(format, {
    filename: `loan_${loan.loan_number}_schedule`,
    title: `Loan ${loan.loan_number} — Repayment Schedule`,
    columns: SCHEDULE_COLUMNS,
    rows,
  });
}
