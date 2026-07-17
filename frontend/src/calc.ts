import type { RepaymentSchedule } from './types';

/** Compute EMI using the standard amortization formula. */
export function calculateEMI(principal: number, annualRatePct: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  if (annualRatePct === 0) return round(principal / months, 2);
  const r = annualRatePct / 100 / 12;
  const emi = (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
  return round(emi, 2);
}

export function calculateTotalInterest(principal: number, emi: number, months: number): number {
  return round(emi * months - principal, 2);
}

export function round(value: number, decimals = 2): number {
  const f = Math.pow(10, decimals);
  return Math.round(value * f) / f;
}

/** Build an installment schedule for a new loan. */
export function buildSchedule(
  principal: number,
  annualRatePct: number,
  months: number,
  startDate: string,
): { schedule: Omit<RepaymentSchedule, 'id' | 'loan_id' | 'created_at'>[]; emi: number; totalInterest: number } {
  const emi = calculateEMI(principal, annualRatePct, months);
  const totalInterest = calculateTotalInterest(principal, emi, months);
  const schedule: Omit<RepaymentSchedule, 'id' | 'loan_id' | 'created_at'>[] = [];
  const start = new Date(startDate);
  for (let i = 1; i <= months; i++) {
    const dueDate = new Date(start.getFullYear(), start.getMonth() + i, start.getDate());
    schedule.push({
      installment_no: i,
      due_date: dueDate.toISOString().slice(0, 10),
      emi_amount: emi,
      paid_amount: 0,
      balance: emi,
      status: 'pending',
    });
  }
  return { schedule, emi, totalInterest };
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

export function formatCurrencyExact(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

export function formatDate(value: string | Date | null): string {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value: string | Date | null): string {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function maskAadhaar(value: string | null | undefined): string {
  if (!value) return '-';
  return value.replace(/(\d{4})\d{4}(\d{4})/, '$1-XXXX-$2').replace(/-/g, '-');
}

export function daysBetween(a: string | Date, b: string | Date): number {
  const aD = new Date(a);
  const bD = new Date(b);
  const diff = bD.getTime() - aD.getTime();
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
}

// ─── Weekly Schedule (upfront interest) ──────────────────────────────────────
// Interest is DEDUCTED at disbursement.
//   upfrontInterest = principal × rate%
//   disbursed       = principal - upfrontInterest
//   weekly install  = principal / weeks  (borrower repays full principal over weeks)
export function buildWeeklySchedule(
  principal: number,
  ratePct: number,
  weeks: number,
  startDate: string,
): { schedule: Omit<RepaymentSchedule, 'id' | 'loan_id' | 'created_at'>[]; installment: number; totalInterest: number; disbursedAmount: number } {
  if (principal <= 0 || weeks <= 0) return { schedule: [], installment: 0, totalInterest: 0, disbursedAmount: 0 };
  const totalInterest = round(principal * ratePct / 100, 2);
  const disbursedAmount = round(principal - totalInterest, 2);
  const installment = round(principal / weeks, 2);
  const schedule: Omit<RepaymentSchedule, 'id' | 'loan_id' | 'created_at'>[] = [];
  const start = new Date(startDate);
  for (let i = 1; i <= weeks; i++) {
    const due = new Date(start);
    due.setDate(start.getDate() + i * 7);
    // Last installment absorbs rounding difference
    const amount = i === weeks ? round(principal - installment * (weeks - 1), 2) : installment;
    schedule.push({
      installment_no: i,
      due_date: due.toISOString().slice(0, 10),
      emi_amount: amount,
      paid_amount: 0,
      balance: amount,
      status: 'pending',
    });
  }
  return { schedule, installment, totalInterest, disbursedAmount };
}

// ─── Daily Schedule (interest added to repayment) ────────────────────────────
// Interest is ADDED to the amount repaid; the borrower receives the full principal.
//   totalInterest = principal × rate%
//   totalRepayment = principal + totalInterest
//   disbursed      = principal (full — no upfront deduction)
//   daily install  = totalRepayment / days
export function buildDailySchedule(
  principal: number,
  ratePct: number,
  days: number,
  startDate: string,
): { schedule: Omit<RepaymentSchedule, 'id' | 'loan_id' | 'created_at'>[]; installment: number; totalInterest: number; totalRepayment: number; disbursedAmount: number } {
  if (principal <= 0 || days <= 0) return { schedule: [], installment: 0, totalInterest: 0, totalRepayment: 0, disbursedAmount: 0 };
  const totalInterest = round(principal * ratePct / 100, 2);
  const totalRepayment = round(principal + totalInterest, 2);
  const disbursedAmount = principal; // borrower receives the full principal
  const installment = round(totalRepayment / days, 2);
  const schedule: Omit<RepaymentSchedule, 'id' | 'loan_id' | 'created_at'>[] = [];
  const start = new Date(startDate);
  for (let i = 1; i <= days; i++) {
    const due = new Date(start);
    due.setDate(start.getDate() + i);
    // Last installment absorbs rounding difference
    const amount = i === days ? round(totalRepayment - installment * (days - 1), 2) : installment;
    schedule.push({
      installment_no: i,
      due_date: due.toISOString().slice(0, 10),
      emi_amount: amount,
      paid_amount: 0,
      balance: amount,
      status: 'pending',
    });
  }
  return { schedule, installment, totalInterest, totalRepayment, disbursedAmount };
}
