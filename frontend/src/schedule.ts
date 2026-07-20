import { supabase } from './supabaseClient';
import type { RepaymentSchedule } from './types';

function todayISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

/**
 * Recompute a loan's repayment_schedule from the actual collections recorded
 * against it. This is a waterfall: the total collected is applied to the
 * earliest installments first, marking each paid / partial / pending / overdue.
 *
 * It is idempotent — it always recomputes from the current collection total, so
 * it stays correct even if a collection is later edited or deleted. Call it
 * after any collection insert/update/delete so the customer's Repayment
 * Schedule reflects payments in real time.
 */
export async function syncScheduleFromCollections(loanId: string | null | undefined): Promise<void> {
  if (!loanId) return;

  // Total collected against this loan.
  const { data: cols } = await supabase
    .from('collections')
    .select('collection_amount')
    .eq('loan_id', loanId);
  let remaining = (cols ?? []).reduce(
    (sum: number, c: { collection_amount?: number }) => sum + (Number(c.collection_amount) || 0),
    0,
  );

  // Existing schedule rows, earliest first.
  const { data: schedRows } = await supabase
    .from('repayment_schedule')
    .select('*')
    .eq('loan_id', loanId)
    .order('installment_no', { ascending: true });
  const rows = (schedRows ?? []) as RepaymentSchedule[];
  if (!rows.length) return;

  const today = todayISO();

  let totalBalance = 0;
  for (const r of rows) {
    const emi = Number(r.emi_amount) || 0;
    const paid = Math.min(remaining, emi);
    remaining = Math.max(0, remaining - paid);
    const balance = Math.round((emi - paid) * 100) / 100;
    totalBalance = Math.round((totalBalance + balance) * 100) / 100;

    let status: RepaymentSchedule['status'];
    if (paid >= emi && emi > 0) status = 'paid';
    else if (paid > 0) status = 'partial';
    else if (r.due_date && r.due_date < today) status = 'overdue';
    else status = 'pending';

    // Only write when something actually changed, to avoid needless updates.
    const paidRounded = Math.round(paid * 100) / 100;
    if (
      Number(r.paid_amount) !== paidRounded ||
      Number(r.balance) !== balance ||
      r.status !== status
    ) {
      await supabase
        .from('repayment_schedule')
        .update({ paid_amount: paidRounded, balance, status })
        .eq('id', r.id);
    }
  }

  // Keep the loan's outstanding balance (and closed status) in sync so the
  // dashboard, loan list and admin views all reflect payments in real time.
  const { data: loanRows } = await supabase.from('loans').select('*').eq('id', loanId);
  const loan = (loanRows ?? [])[0] as { outstanding_balance?: number; status?: string } | undefined;
  if (loan) {
    const patch: { outstanding_balance: number; status?: string } = { outstanding_balance: totalBalance };
    if (totalBalance <= 0.01 && loan.status !== 'closed') patch.status = 'closed';
    else if (totalBalance > 0.01 && loan.status === 'closed') patch.status = 'active';
    if (
      Number(loan.outstanding_balance) !== totalBalance ||
      patch.status !== undefined
    ) {
      await supabase.from('loans').update(patch).eq('id', loanId);
    }
  }
}
