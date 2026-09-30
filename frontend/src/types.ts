// Domain types mirroring the backend API (IPO_MANAGER_SPEC.md §3 + §6).

export type IpoStatus = 'UPCOMING' | 'OPEN' | 'CLOSED' | 'LISTED';

export interface Ipo {
  id: number;
  name: string;
  status: IpoStatus;
  openDate?: string | null;
  closeDate?: string | null;
  listingDate?: string | null;
  price?: number | null;
  lotSize?: number | null;
  notes?: string | null;
}

export interface Person {
  id: number;
  name: string;
  phone: string;
  notes?: string | null;
  createdAt?: string | null;
}

export type TxnDirection = 'RECEIVED' | 'SENT';
export type TxnMode = 'UPI' | 'GPAY' | 'CASH' | 'BANK' | 'SELF';

/**
 * Money lifecycle for an IPO: sent/applied → unallocated/allocated →
 * settled (refund after non-allocation, or sold after allocation with
 * profit/loss noted on the transaction).
 */
export type TxnStatus =
  | 'SENT'
  | 'UNALLOCATED'
  | 'ALLOCATED'
  | 'SETTLED_UNALLOCATED'
  | 'SETTLED_SOLD';

export interface Transaction {
  id: number;
  personId: number;
  personName?: string;
  ipoId: number;
  ipoName?: string;
  direction: TxnDirection;
  amount: number;
  mode: TxnMode;
  date: string;
  settled: boolean;
  settledAt?: string | null;
  notes?: string | null;
  /** Who the money came from (source account / person). */
  sender?: string | null;
  /** Who the money went to (destination account / person). */
  receiver?: string | null;
  /** Lifecycle status — SENT is the default. */
  status: TxnStatus;
  /** Realized profit (+) / loss (−) vs the sent amount, set when the
   *  transaction is settled after the allotted shares are sold. */
  profitLoss?: number | null;
}

export type AppStatus = 'APPLIED' | 'ALLOTTED' | 'NOT_ALLOTTED' | 'REFUNDED';

export interface Application {
  id: number;
  personId: number;
  personName?: string;
  ipoId: number;
  ipoName?: string;
  amount: number;
  status: AppStatus;
  appliedDate?: string | null;
  allottedBy?: string | null;
  allottedAt?: string | null;
  refund?: number | null;
  profitLoss?: number | null;
  /** When the allotted shares were sold (set with the profit/loss record). */
  soldAt?: string | null;
  remarks?: string | null;
}

/** Masked by default; ?reveal=true returns full values (spec §6). */
export interface PersonKyc {
  personId: number;
  panNumber?: string | null;
  email?: string | null;
  dematBroker?: string | null;
  accountLoginId?: string | null;
  /** opt-in, off by default — spec §2 recommends leaving unset */
  accountPassword?: string | null;
  /** opt-in, off by default — spec §2 recommends leaving unset */
  mpin?: string | null;
  updatedAt?: string | null;
}

export interface ReportIpoRow {
  ipoId: number;
  ipoName: string;
  applied: number;
  received: number;
  sentBack: number;
  held: number;
  status: string;
  applications: Application[];
  /** The transactions behind this row (same filters applied), newest first. */
  transactions: Transaction[];
}

export interface PersonReport {
  person: Person;
  kyc?: PersonKyc | null;
  ipos: ReportIpoRow[];
  totals: {
    applied: number;
    received: number;
    sentBack: number;
    held: number;
  };
}

export interface SendReportResponse {
  status: string;
  /** wa.me fallback link — open in a new tab when present (spec §4.4) */
  waLink?: string;
  message?: string;
}

export interface Allotment {
  applicationId: number;
  ipoId: number;
  ipoName: string;
  personId: number;
  personName: string;
  amount: number;
  lots?: number | null;
  allottedAt?: string | null;
}

export interface ProfitLossEntry {
  applicationId: number;
  ipoId: number;
  ipoName: string;
  personId: number;
  personName: string;
  amount: number;
  profitLoss: number;
  soldAt?: string | null;
}

export interface ProfitLossBucket {
  name: string;
  total: number;
  count: number;
}

export interface ProfitLossReport {
  total: number;
  entries: ProfitLossEntry[];
  byIpo: ProfitLossBucket[];
  byPerson: ProfitLossBucket[];
}

export type ProfitLossPeriod = 'MTD' | '1W' | '1M' | '3M' | '6M' | 'ALL';

export interface SaleInput {
  profitLoss: number;
  soldAt?: string;
}

export interface DashboardStats {
  activeIpos: number;
  moneyReceived: number;
  peopleCount: number;
  pendingToCollect: number;
  pendingSettlements: {
    count: number;
    amount: number;
  };
  /** allotted applications ÷ total applications, YTD (0–100) */
  allotmentRateYtd: number;
}

// ---- Create / update payloads (never include settled / allottedBy — the
// app sets those automatically, spec §4.7) ----

export interface PersonInput {
  name: string;
  phone: string;
  notes?: string;
}

export interface IpoInput {
  name: string;
  status: IpoStatus;
  openDate?: string;
  closeDate?: string;
  listingDate?: string;
  price?: number;
  lotSize?: number;
  notes?: string;
}

export interface TransactionInput {
  personId: number;
  ipoId: number;
  direction: TxnDirection;
  amount: number;
  mode: TxnMode;
  date: string;
  notes?: string;
  /** Who the money came from, e.g. "HDFC pool". Optional — RECEIVED
   *  defaults to the person's name server-side. */
  sender?: string;
  /** Who the money went to, e.g. "HDFC pool". Optional — SENT
   *  defaults to the person's name server-side. */
  receiver?: string;
  /** Lifecycle status. Optional — defaults to SENT. */
  status?: TxnStatus;
  /** Realized profit (+) / loss (−) vs the sent amount. Only meaningful
   *  with status SETTLED_SOLD. */
  profitLoss?: number;
}

/** Body for PATCH /api/transactions/{id}/settle — which kind of
 *  settlement closed the money loop. */
export interface SettleInput {
  /** UNALLOCATED = refunded after non-allocation; SOLD = settled after
   *  the allotted shares were sold. */
  type: 'UNALLOCATED' | 'SOLD';
  /** Realized profit (+) / loss (−) vs the sent amount (SOLD only). */
  profitLoss?: number;
}

/** Filters for the person report drawer and the WhatsApp send, so the
 *  message always matches what the drawer previewed. */
export interface ReportFilters {
  ipoId?: number;
  /** false = only unsettled rows (held ≠ 0). Default true. */
  includeSettled?: boolean;
  /** true = only IPOs with no allotted application. Default false. */
  onlyUnallotted?: boolean;
  fromDate?: string;
  toDate?: string;
}

export interface ApplicationInput {
  personId: number;
  ipoId: number;
  amount: number;
  appliedDate?: string;
  remarks?: string;
}

export interface KycInput {
  panNumber?: string;
  email?: string;
  dematBroker?: string;
  accountLoginId?: string;
  accountPassword?: string;
  mpin?: string;
}

/** The logged-in user (from /api/auth/me or login/register responses). */
export interface AuthUser {
  id: number;
  name: string;
  email: string;
}

/** What register/login return: token + who it belongs to. */
export interface AuthResponse extends AuthUser {
  token: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}
