export type UserRole = 'admin' | 'agent' | 'customer';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string;
  mobile: string | null;
  role: UserRole;
  customer_id: string | null;
  address: string | null;
  aadhaar: string | null;
  pan: string | null;
  occupation: string | null;
  status: 'active' | 'inactive';
  avatar_url: string | null;
  created_at: string;
}

export interface Customer {
  id: string;
  customer_id: string;
  full_name: string;
  mobile: string | null;
  address: string | null;
  aadhaar: string | null;
  pan: string | null;
  occupation: string | null;
  photo_url: string | null;
  loan_status: 'none' | 'active' | 'overdue' | 'closed';
  assigned_agent: string | null;
  created_at: string;
}

export interface Loan {
  id: string;
  loan_number: string;
  customer_id: string;
  customer_name: string | null;
  loan_amount: number;
  interest_percentage: number;
  loan_duration: number;
  loan_type: 'monthly' | 'weekly' | 'daily';
  start_date: string;
  assigned_agent: string | null;
  agent_name: string | null;
  processing_fee: number;
  emi: number;
  total_interest: number;
  total_repayment: number;
  outstanding_balance: number;
  status: 'active' | 'overdue' | 'closed' | 'pending';
  notes: string | null;
  created_at: string;
}

export interface RepaymentSchedule {
  id: string;
  loan_id: string;
  installment_no: number;
  due_date: string;
  emi_amount: number;
  paid_amount: number;
  balance: number;
  status: 'paid' | 'partial' | 'overdue' | 'pending';
  created_at: string;
}

export interface Collection {
  id: string;
  receipt_number: string;
  loan_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  loan_number: string | null;
  collection_amount: number;
  payment_method: 'cash' | 'upi' | 'card' | 'bank' | 'cheque';
  collection_date: string;
  agent_id: string | null;
  agent_name: string | null;
  notes: string | null;
  proof_url: string | null;
  signature_url: string | null;
  created_at: string;
}

export interface ChitGroup {
  id: string;
  group_name: string;
  group_number: string;
  total_members: number;
  group_value: number;
  monthly_contribution: number;
  duration: number;
  start_date: string;
  collected_amount: number;
  pending_amount: number;
  status: 'active' | 'closed' | 'pending';
  created_at: string;
}

export interface ChitMember {
  id: string;
  group_id: string;
  customer_id: string | null;
  member_name: string | null;
  contribution_amount: number;
  due_date: string | null;
  payment_status: 'paid' | 'partial' | 'overdue' | 'pending';
  created_at: string;
}

export interface Fund {
  id: string;
  fund_number: string;
  customer_id: string | null;
  customer_name: string | null;
  weekly_amount: number;
  weeks: number;
  bonus: number;
  deposit_amount: number;
  total_amount: number;
  collected_amount: number;
  start_date: string | null;
  maturity_date: string | null;
  status: 'active' | 'matured' | 'closed';
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string | null;
  title: string;
  message: string | null;
  type: 'emi_due' | 'overdue' | 'approval' | 'reminder' | 'info';
  read: boolean;
  created_at: string;
}

export interface Settings {
  id: string;
  company_name: string;
  logo_url: string | null;
  address: string | null;
  gst_number: string | null;
  contact_number: string | null;
  interest_config: number;
  emi_formula: string | null;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  updated_at: string;
}
