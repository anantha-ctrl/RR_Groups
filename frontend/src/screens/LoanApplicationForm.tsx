import { useEffect, useState } from 'react';
import { Printer, X, Loader2, FileText } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { formatCurrency, formatDate } from '../calc';
import type { Loan, Customer } from '../types';
import { Modal } from '../components/ui';

const COMPANY = 'RR Groups';
const COMPANY_ADDRESS = '42 Finance Street, Bengaluru, KA 560001';
const COMPANY_PHONE = '+91 98765 43210';
const COMPANY_GST = '29AABCF1234L1Z5';

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">{label}</span>
      <span className={`text-sm font-semibold text-gray-800 border-b border-dashed border-gray-300 pb-0.5 min-h-[20px] ${mono ? 'font-mono' : ''}`}>
        {value || '—'}
      </span>
    </div>
  );
}

function SignBox({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-full h-16 border border-dashed border-gray-400 rounded" />
      <span className="text-[10px] text-gray-500 font-semibold">{label}</span>
    </div>
  );
}

interface Props {
  loan: Loan | null;
  open: boolean;
  onClose: () => void;
}

export default function LoanApplicationForm({ loan, open, onClose }: Props) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!loan) { setCustomer(null); return; }
    setLoading(true);
    supabase
      .from('customers')
      .select('*')
      .eq('id', loan.customer_id)
      .single()
      .then(({ data }) => {
        setCustomer(data as Customer ?? null);
        setLoading(false);
      });
  }, [loan]);

  if (!open || !loan) return null;

  const loanTypeLabel =
    loan.loan_type === 'weekly' ? 'Weekly Collection — 10 Weeks' :
      loan.loan_type === 'daily' ? 'Daily Collection' :
        'Monthly EMI';

  const installmentLabel =
    loan.loan_type === 'weekly' ? 'Weekly Installment' :
      loan.loan_type === 'daily' ? 'Daily Installment' :
        'Monthly EMI';

  return (
    <Modal open={open} onClose={onClose} title="Loan Application Form" size="xl">
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-7 h-7 text-brand-500 animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Print target ── */}
          <div id="loan-app-print" className="bg-white text-gray-900 p-8 rounded-xl border border-gray-200 space-y-5 text-sm print:p-4">

            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b-2 border-gray-800">
              <div className="flex items-center gap-4">
                <img
                  src="/assets/rr-groups-logo.png"
                  alt={COMPANY}
                  className="w-16 h-16 rounded-full object-cover ring-2 ring-brand-300"
                />
                <div>
                  <h1 className="text-xl font-extrabold text-gray-900">{COMPANY}</h1>
                  <p className="text-xs text-gray-500">{COMPANY_ADDRESS}</p>
                  <p className="text-xs text-gray-500">Ph: {COMPANY_PHONE} · GST: {COMPANY_GST}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-base font-bold text-brand-700 uppercase tracking-wide">Loan Application</p>
                <p className="text-xs text-gray-500 mt-0.5">Ref: {loan.loan_number}</p>
                <p className="text-xs text-gray-500">Date: {formatDate(loan.start_date)}</p>
              </div>
            </div>

            {/* Applicant + Photo row */}
            <div className="flex gap-6">
              <div className="flex-1 grid grid-cols-2 gap-x-8 gap-y-4">
                <InfoRow label="Full Name" value={customer?.full_name ?? loan.customer_name ?? ''} />
                <InfoRow label="Mobile" value={customer?.mobile ?? ''} />
                <InfoRow label="Address" value={customer?.address ?? ''} />
                <InfoRow label="Occupation" value={customer?.occupation ?? ''} />
                <InfoRow label="Aadhaar Number" value={customer?.aadhaar ?? ''} mono />
                <InfoRow label="PAN Number" value={customer?.pan ?? ''} mono />
              </div>
              {/* Photo box */}
              <div className="flex flex-col items-center gap-1 shrink-0">
                {customer?.photo_url ? (
                  <img
                    src={customer.photo_url}
                    alt="Applicant"
                    className="w-28 h-32 object-cover rounded-lg border-2 border-gray-300"
                  />
                ) : (
                  <div className="w-28 h-32 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 gap-1">
                    <FileText className="w-6 h-6" />
                    <span className="text-[10px] font-semibold">Affix Photo</span>
                  </div>
                )}
                <span className="text-[9px] text-gray-400 font-semibold">APPLICANT PHOTO</span>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-dashed border-gray-300" />

            {/* Loan Details */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Loan Details</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
                <InfoRow label="Loan Number" value={loan.loan_number} mono />
                <InfoRow label="Collection Type" value={loanTypeLabel} />
                <InfoRow label="Loan Amount" value={formatCurrency(loan.loan_amount)} />
                <InfoRow label="Interest Rate" value={`${loan.interest_percentage}%`} />
                {loan.loan_type === 'weekly' ? (
                  <>
                    <InfoRow label="Duration" value="10 Weeks" />
                    <InfoRow label="Upfront Interest" value={formatCurrency(loan.total_interest)} />
                    <InfoRow label="Disbursed Amount" value={formatCurrency(loan.loan_amount - loan.total_interest)} />
                  </>
                ) : loan.loan_type === 'daily' ? (
                  <>
                    <InfoRow label="Duration" value={`${loan.loan_duration} Days`} />
                    <InfoRow label="Total Interest" value={formatCurrency(loan.total_interest)} />
                    <InfoRow label="Total Repayment" value={formatCurrency(loan.total_repayment)} />
                  </>
                ) : (
                  <>
                    <InfoRow label="Duration" value={`${loan.loan_duration} Months`} />
                    <InfoRow label="Total Interest" value={formatCurrency(loan.total_interest)} />
                    <InfoRow label="Total Repayment" value={formatCurrency(loan.total_repayment)} />
                  </>
                )}
                <InfoRow label={installmentLabel} value={formatCurrency(loan.emi)} />
                <InfoRow label="Start Date" value={formatDate(loan.start_date)} />
                <InfoRow label="Processing Fee" value={formatCurrency(loan.processing_fee)} />
                <InfoRow label="Assigned Agent" value={loan.agent_name ?? ''} />
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-dashed border-gray-300" />

            {/* Terms */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Declaration</p>
              <p className="text-xs text-gray-600 leading-relaxed">
                I, the undersigned, hereby declare that all the information provided above is true and correct to the best of my knowledge.
                I agree to repay the loan amount along with applicable interest as per the agreed schedule.
                I understand that failure to repay on time may attract additional charges and legal action as per applicable laws.
              </p>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-3 gap-6 pt-4">
              <SignBox label="Borrower Signature" />
              <SignBox label="Guarantor Signature" />
              <SignBox label="Authorised Signatory" />
            </div>

            {/* Footer */}
            <p className="text-[10px] text-gray-400 text-center pt-3 border-t border-dashed border-gray-200">
              This is a computer-generated application form. · {COMPANY} · {COMPANY_ADDRESS}
            </p>
          </div>

          {/* Action buttons (hidden when printing) */}
          <div className="flex justify-end gap-2 mt-4 no-print">
            <button className="btn-secondary" onClick={onClose}>
              <X className="w-4 h-4" /> Close
            </button>
            <button className="btn-primary" onClick={() => window.print()}>
              <Printer className="w-4 h-4" /> Print Application
            </button>
          </div>

          {/* Print styles */}
          <style>{`
            @media print {
              body * { visibility: hidden !important; }
              #loan-app-print, #loan-app-print * { visibility: visible !important; }
              #loan-app-print { position: absolute; left: 0; top: 0; width: 100%; border: none !important; padding: 20px; }
              .no-print { display: none !important; }
            }
          `}</style>
        </>
      )}
    </Modal>
  );
}
