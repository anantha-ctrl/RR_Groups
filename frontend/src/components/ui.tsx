import { type ReactNode, type ComponentProps } from 'react';
import { X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export function Badge({
  children,
  color = 'gray',
  className = '',
}: {
  children: ReactNode;
  color?: 'gray' | 'green' | 'yellow' | 'red' | 'blue' | 'purple';
  className?: string;
}) {
  const palette = {
    gray: 'bg-ink-100 text-ink-700',
    green: 'bg-emerald-100 text-emerald-700',
    yellow: 'bg-amber-100 text-amber-700',
    red: 'bg-rose-100 text-rose-700',
    blue: 'bg-brand-100 text-brand-700',
    purple: 'bg-violet-100 text-violet-700',
  } as const;
  return <span className={`badge ${palette[color]} ${className}`}>{children}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: 'green' | 'yellow' | 'red' | 'blue' | 'gray'; label: string }> = {
    active: { color: 'green', label: 'Active' },
    overdue: { color: 'red', label: 'Overdue' },
    closed: { color: 'gray', label: 'Closed' },
    pending: { color: 'yellow', label: 'Pending' },
    paid: { color: 'green', label: 'Paid' },
    partial: { color: 'yellow', label: 'Partial' },
    none: { color: 'gray', label: 'No Loan' },
  };
  const cfg = map[status] ?? { color: 'gray' as const, label: status };
  return <Badge color={cfg.color}>{cfg.label}</Badge>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-ink-900">{title}</h1>
        {subtitle && <p className="text-sm text-ink-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4">
      <div className="w-14 h-14 rounded-2xl bg-ink-100 flex items-center justify-center mb-3">
        <Icon className="w-7 h-7 text-ink-400" />
      </div>
      <h3 className="text-base font-semibold text-ink-800">{title}</h3>
      {description && <p className="text-sm text-ink-500 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  if (!open) return null;
  const widths = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        className={`relative w-full ${widths[size]} bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl animate-slide-up max-h-[92vh] overflow-hidden flex flex-col`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
          <h2 className="text-lg font-bold text-ink-900">{title}</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-ink-100 flex items-center justify-center text-ink-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
  required,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="label">
        {label} {required && <span className="text-rose-500 normal-case">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-400 mt-1">{hint}</p>}
    </div>
  );
}

export function Select({ children, ...props }: ComponentProps<'select'>) {
  return (
    <select className="input" {...props}>
      {children}
    </select>
  );
}

export function TextArea({ ...props }: ComponentProps<'textarea'>) {
  return <textarea className="input min-h-[90px] resize-y" {...props} />;
}

export function Avatar({
  name,
  src,
  size = 40,
}: {
  name: string;
  src?: string | null;
  size?: number;
}) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-brand-600 text-white flex items-center justify-center font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials || '?'}
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-ink-600">{message}</p>
      <div className="flex justify-end gap-2 mt-5">
        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          className={danger ? 'btn-danger' : 'btn-primary'}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
