import type { AppStatus, IpoStatus, TxnMode, TxnStatus } from './types';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/** ₹1,50,000 style formatting (en-IN locale, per design language). */
export function formatINR(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '₹0';
  return inr.format(n);
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Today as yyyy-mm-dd for <input type="date"> defaults. */
export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Now as yyyy-mm-ddThh:mm for <input type="datetime-local"> defaults. */
export function nowLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours(),
  )}:${p(d.getMinutes())}`;
}

/** "29 Sep 2026, 10:30 AM" — date plus time for transaction timestamps. */
export function formatDateTime(d: string | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  const date = dt.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const time = dt.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${date}, ${time}`;
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export const MODE_ICONS: Record<TxnMode, string> = {
  UPI: '📲',
  GPAY: '💳',
  CASH: '💵',
  BANK: '🏦',
  SELF: '👤',
};

export const MODE_LABELS: Record<TxnMode, string> = {
  UPI: 'UPI',
  GPAY: 'GPay',
  CASH: 'Cash',
  BANK: 'Bank',
  SELF: 'Self',
};

export function pillClassForAppStatus(s: AppStatus): string {
  switch (s) {
    case 'ALLOTTED':
      return 'pill pill-green';
    case 'NOT_ALLOTTED':
      return 'pill pill-red';
    case 'REFUNDED':
      return 'pill pill-blue';
    case 'APPLIED':
    default:
      return 'pill pill-amber';
  }
}

export function pillClassForIpoStatus(s: IpoStatus): string {
  switch (s) {
    case 'OPEN':
      return 'pill pill-green';
    case 'UPCOMING':
      return 'pill pill-blue';
    case 'CLOSED':
      return 'pill pill-amber';
    case 'LISTED':
      return 'pill pill-green';
    default:
      return 'pill pill-blue';
  }
}

export const APP_STATUS_LABELS: Record<AppStatus, string> = {
  APPLIED: 'Applied',
  ALLOTTED: 'Allotted',
  NOT_ALLOTTED: 'Not Allotted',
  REFUNDED: 'Refunded',
};

export const TXN_STATUS_LABELS: Record<TxnStatus, string> = {
  SENT: 'Sent / Applied',
  UNALLOCATED: 'Unallocated',
  ALLOCATED: 'Allocated',
  SETTLED_UNALLOCATED: 'Settled · refund',
  SETTLED_SOLD: 'Settled · sold',
};

export function pillClassForTxnStatus(s: TxnStatus | undefined): string {
  switch (s) {
    case 'SETTLED_SOLD':
      return 'pill pill-green';
    case 'SETTLED_UNALLOCATED':
      return 'pill pill-gray';
    case 'ALLOCATED':
      return 'pill pill-green';
    case 'UNALLOCATED':
      return 'pill pill-amber';
    case 'SENT':
    default:
      return 'pill pill-blue';
  }
}

/** +₹2,500 for profit, −₹1,200 for loss. */
export function formatSignedINR(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const abs = formatINR(Math.abs(n));
  return n >= 0 ? `+${abs}` : `−${abs}`;
}
