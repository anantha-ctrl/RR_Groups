import { useEffect, useState } from 'react';
import { Receipt, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../auth';
import { PageHeader, EmptyState } from '../components/ui';
import { formatCurrency, formatDate } from '../calc';
import type { Collection } from '../types';

export default function CustomerPaymentsScreen() {
  const { profile } = useAuth();
  const cid = profile?.customer_id ?? null;
  const [rows, setRows] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cid) { setLoading(false); return; }
    let active = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('collections')
        .select('*')
        .eq('customer_id', cid)
        .order('collection_date', { ascending: false });
      if (!active) return;
      setRows((data ?? []) as Collection[]);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [cid]);

  const total = rows.reduce((s, c) => s + Number(c.collection_amount), 0);

  return (
    <div>
      <PageHeader title="Payment History" subtitle={`Total paid: ${formatCurrency(total)}`} />
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Receipt} title="No payments" description="No payments have been recorded on your account yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/50">
                  {['Receipt', 'Loan', 'Amount', 'Method', 'Date', 'Collected By'].map((h) => (
                    <th key={h} className="table-head text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b border-ink-50 hover:bg-ink-50/40">
                    <td className="table-cell font-medium text-ink-900">{c.receipt_number}</td>
                    <td className="table-cell text-ink-700">{c.loan_number ?? '—'}</td>
                    <td className="table-cell font-bold text-emerald-600">{formatCurrency(c.collection_amount)}</td>
                    <td className="table-cell uppercase text-ink-600">{c.payment_method}</td>
                    <td className="table-cell text-ink-500">{formatDate(c.collection_date)}</td>
                    <td className="table-cell text-ink-600">{c.agent_name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
