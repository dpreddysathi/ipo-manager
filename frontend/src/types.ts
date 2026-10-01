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
  /** Allotment registrar: KFINTECH, MUFG, BIGSHARE, BSE, MANUAL. */
  registrar?: string | null;
  /** The IPO's key on the registrar's site (KFintech clientId / MUFG company_id). */
  registrarRef?: string | null;
}

export interface Person {
  id: number;
  name: string;
  phone: string;
  notes?: string | null;
  createdAt?: string | null;
}

export type TxnMode = 'UPI' | 'GPAY' | 'CASH' | 'BANK' | 'SELF';

/** Display name used when one side of a money movement is you, not a person. */
export const SELF_NAME = 'Me';

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

/**
 * One money movement between two parties for an IPO — always
 * person-to-person. A null party id means you ("Me").
 * The receiver owes the sender until a return leg moves it back.
 */
export interface Transaction {
  id: number;
  /** Null when the sender is you. */
  senderId: number | null;
  senderName: string;
  /** Null when the receiver is you. */
  receiverId: number | null;
  receiverName: string;
  ipoId: number;
  ipoName?: string;
  amount: number;
  mode: TxnMode;
  date: string;
  settled: boolean;
  settledAt?: string | null;
  notes?: string | null;
  /** Set when this leg is a return of another transaction. */
  returnOfId?: number | null;
  /** Lifecycle status — SENT is the default. */
  status: TxnStatus;
  /** Realized profit (+) / loss (−) vs the sent amount, set when the
   *  transaction is settled after the allotted shares are sold. */
  profitLoss?: number | null;
  /** Amount of this debt leg still owed (0 when settled/returned). */
  outstanding?: number;
  /** True when the leg is struck off (settled or fully returned). */
  struck?: boolean;
}

export type AppStatus = 'APPLIED' | 'ALLOTTED' | 'NOT_ALLOTTED' | 'REFUNDED' | 'NOT_FOUND' | 'NO_PAN' | 'CHECK_FAILED';

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

/** One outstanding debt with a counterparty for an IPO. */
export interface PartyOwed {
  /** Null when the counterparty is you. */
  partyId: number | null;
  partyName: string;
  amount: number;
}

export interface ReportIpoRow {
  ipoId: number;
  ipoName: string;
  applied: number;
  status: string;
  applications: Application[];
  /** The person's movements for this IPO (same filters applied), newest first. */
  transactions: Transaction[];
  /** Counterparties this person still owes, with amounts. */
  owes: PartyOwed[];
  /** Counterparties that still owe this person, with amounts. */
  owedBy: PartyOwed[];
  /** Total received (as receiver) under the active filters. */
  received: number;
  /** Total sent (as sender, including returns) under the active filters. */
  sent: number;
  /** Total still owed by this person under the active filters. */
  outstanding: number;
}

export interface PersonReport {
  person: Person;
  kyc?: PersonKyc | null;
  ipos: ReportIpoRow[];
  totals: {
    applied: number;
    received: number;
    sent: number;
    outstanding: number;
  };
}

/** The complete picture of one IPO (GET /api/ipos/{id}/summary). */
export interface IpoDebt {
  senderId: number | null;
  senderName: string;
  receiverId: number | null;
  receiverName: string;
  /** Amount the receiver still owes the sender. */
  amount: number;
}

export interface IpoFunder {
  funderId: number | null;
  funderName: string;
  amount: number;
  outstanding: number;
}

export interface IpoApplicationFunding {
  application: Application;
  funders: IpoFunder[];
  fundedTotal: number;
  outstandingTotal: number;
}

export interface IpoSummary {
  ipoId: number;
  ipoName: string;
  status?: string | null;
  applicationCount: number;
  allottedCount: number;
  notAllottedCount: number;
  appliedTotal: number;
  transactions: Transaction[];
  outstanding: IpoDebt[];
  applications: IpoApplicationFunding[];
  receivedTotal: number;
  outstandingTotal: number;
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
  /** Outstanding: you still owe other people. */
  youOwe: number;
  /** Outstanding: other people still owe you. */
  owedToYou: number;
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

export interface RegistrarIpo {
  id: string;
  name: string;
}

export type AllotmentOutcome =
  | 'ALLOTTED'
  | 'NOT_ALLOTTED'
  | 'NOT_FOUND'
  | 'NEED_PAN'
  | 'MANUAL'
  | 'ERROR';

export interface AllotmentCheckResult {
  /** Set when the person has an application for this IPO; null otherwise. */
  applicationId: number | null;
  personId: number | null;
  outcome: AllotmentOutcome;
  allottedShares?: number | null;
  message?: string | null;
}

/** Best-guess registrar match for an IPO (POST /api/allotment/detect). */
export interface RegistrarDetection {
  /** KFINTECH / MUFG when matched confidently, else null. */
  registrar: string | null;
  registrarRef: string | null;
  registrarName: string | null;
  confidence: number;
  message?: string | null;
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
  registrar?: string;
  registrarRef?: string;
}

export interface TransactionInput {
  /** Who sends the money — a person id, or null for you ("Me"). */
  senderId: number | null;
  /** Who receives the money — a person id, or null for you ("Me"). */
  receiverId: number | null;
  ipoId: number;
  amount: number;
  mode: TxnMode;
  date: string;
  notes?: string;
}

/** Body for POST /api/transactions/{id}/return — records the money
 *  moving back to the original sender and settles the original in one
 *  tap. profitLoss null = plain return (exact amount back);
 *  set = allotted settlement (sender gets amount + P&L). */
export interface ReturnInput {
  profitLoss?: number | null;
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
