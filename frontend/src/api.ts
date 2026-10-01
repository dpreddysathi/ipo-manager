import type {
  Allotment,
  AllotmentCheckResult,
  Application,
  ApplicationInput,
  AppStatus,
  AuthResponse,
  AuthUser,
  DashboardStats,
  Ipo,
  IpoInput,
  IpoSummary,
  KycInput,
  LoginInput,
  Person,
  PersonInput,
  PersonKyc,
  PersonReport,
  ProfitLossPeriod,
  ProfitLossReport,
  RegistrarDetection,
  RegisterInput,
  RegistrarIpo,
  ReportFilters,
  ReturnInput,
  SaleInput,
  SendReportResponse,
  Transaction,
  TransactionInput,
} from './types';

/**
 * Base URL of the Spring Boot backend.
 * Overridden at build time for production, e.g.:
 *   VITE_API_URL=https://<public-backend-url> npm run build
 */
const BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:8080';

// ---- Auth token ----

const TOKEN_KEY = 'ipo-auth-token';

let authToken: string | null = null;
try {
  authToken = localStorage.getItem(TOKEN_KEY);
} catch {
  /* private mode etc. */
}

export function getAuthToken(): string | null {
  return authToken;
}

export function setAuthToken(token: string | null): void {
  authToken = token;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Called when the backend answers 401 (bad/expired token). The auth
 * provider registers a handler that logs the user out and sends them
 * back to the login page.
 */
let onUnauthorized: () => void = () => {};
export function setOnUnauthorized(fn: () => void): void {
  onUnauthorized = fn;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers ?? {}) },
  });
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    // Token bad/expired on a protected endpoint: drop the session and
    // let the route guard send the user back to the login page.
    // (401s from /api/auth/login|register are real error messages for
    // the form, not session expiry — they flow through below.)
    onUnauthorized();
    throw new Error('Session expired — please log in again.');
  }
  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      /* ignore */
    }
    // Surface the backend's {"error": "..."} message when present.
    try {
      const parsed = JSON.parse(detail) as { error?: string };
      if (parsed?.error) detail = parsed.error;
    } catch {
      /* keep raw text */
    }
    throw new Error(
      `API ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ''}`,
    );
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const get = <T,>(path: string) => request<T>(path);
const post = <T,>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) });
const put = <T,>(path: string, body: unknown) =>
  request<T>(path, { method: 'PUT', body: JSON.stringify(body) });
const patch = <T,>(path: string, body: unknown) =>
  request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
const del = (path: string) => request<void>(path, { method: 'DELETE' });

function query(
  params: Record<string, string | number | boolean | undefined>,
): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : '';
}

export const api = {
  // ---- Auth (public — no token needed) ----
  register: (data: RegisterInput) =>
    post<AuthResponse>('/api/auth/register', data),
  login: (data: LoginInput) => post<AuthResponse>('/api/auth/login', data),
  me: () => get<AuthUser>('/api/auth/me'),

  // ---- People ----
  listPeople: () => get<Person[]>('/api/people'),
  getPerson: (id: number) => get<Person>(`/api/people/${id}`),
  createPerson: (data: PersonInput) => post<Person>('/api/people', data),
  updatePerson: (id: number, data: PersonInput) =>
    put<Person>(`/api/people/${id}`, data),
  deletePerson: (id: number) => del(`/api/people/${id}`),

  // ---- IPOs ----
  listIpos: () => get<Ipo[]>('/api/ipos'),
  getIpo: (id: number) => get<Ipo>(`/api/ipos/${id}`),
  /** Complete picture: applications + funders, allotment counts, money ledger. */
  getIpoSummary: (id: number) => get<IpoSummary>(`/api/ipos/${id}/summary`),
  createIpo: (data: IpoInput) => post<Ipo>('/api/ipos', data),
  updateIpo: (id: number, data: IpoInput) =>
    put<Ipo>(`/api/ipos/${id}`, data),
  deleteIpo: (id: number) => del(`/api/ipos/${id}`),

  // ---- Transactions ----
  listTransactions: (params?: {
    ipoId?: number;
    partyId?: number;
    pendingOnly?: boolean;
  }) => get<Transaction[]>(`/api/transactions${query(params ?? {})}`),
  createTransaction: (data: TransactionInput) =>
    post<Transaction>('/api/transactions', data),
  updateTransaction: (id: number, data: TransactionInput) =>
    put<Transaction>(`/api/transactions/${id}`, data),
  /**
   * One-tap return: records the money moving back to the original
   * sender and settles the original. profitLoss null = plain return
   * (exact amount back); set = allotted settlement (sender gets
   * amount + P&L, noted on the receiver's application too).
   */
  recordReturn: (id: number, input?: ReturnInput) =>
    post<Transaction>(`/api/transactions/${id}/return`, input ?? {}),
  deleteTransaction: (id: number) => del(`/api/transactions/${id}`),

  // ---- Applications ----
  listApplications: (params?: { ipoId?: number; personId?: number }) =>
    get<Application[]>(`/api/applications${query(params ?? {})}`),
  createApplication: (data: ApplicationInput) =>
    post<Application>('/api/applications', data),
  /** Also sets allottedBy/allottedAt server-side (spec §3.2). */
  updateApplicationStatus: (id: number, status: AppStatus) =>
    patch<Application>(`/api/applications/${id}/status`, { status }),
  /** Records the sale of allotted shares: realized profit (+) or loss (−). */
  recordSale: (id: number, data: SaleInput) =>
    patch<Application>(`/api/applications/${id}/sale`, data),

  // ---- KYC (masked by default; reveal=true returns full values) ----
  getKyc: (personId: number, reveal = false) =>
    get<PersonKyc>(
      `/api/people/${personId}/kyc${reveal ? '?reveal=true' : ''}`,
    ),
  updateKyc: (personId: number, data: KycInput) =>
    put<PersonKyc>(`/api/people/${personId}/kyc`, data),

  // ---- Reports ----
  getPersonReport: (personId: number, filters?: ReportFilters) =>
    get<PersonReport>(
      `/api/people/${personId}/report${query({
        ipoId: filters?.ipoId,
        includeSettled: filters?.includeSettled,
        onlyUnallotted: filters?.onlyUnallotted,
        fromDate: filters?.fromDate,
        toDate: filters?.toDate,
      })}`,
    ),
  /** Backend builds the message server-side, writes a ReportLog row,
   *  and returns { status, waLink } (spec §4.4). Filters match the
   *  drawer preview. */
  sendReport: (personId: number, filters?: ReportFilters) =>
    post<SendReportResponse>('/api/reports/send', {
      personId,
      ipoId: filters?.ipoId,
      includeSettled: filters?.includeSettled,
      onlyUnallotted: filters?.onlyUnallotted,
      fromDate: filters?.fromDate,
      toDate: filters?.toDate,
    }),

  // ---- Allotment checking ----
  /** Live IPO list from a registrar (KFINTECH / MUFG) for registrar setup. */
  getRegistrarIpos: (registrar: string) =>
    get<RegistrarIpo[]>(`/api/allotment/registrar-ipos${query({ registrar })}`),
  /** Detects the IPO's registrar automatically (fuzzy name match, saved on hit). */
  detectRegistrar: (ipoId: number) =>
    post<RegistrarDetection>('/api/allotment/detect', { ipoId }),
  /** One PAN lookup against the IPO's registrar; records decisive outcomes. */
  checkAllotment: (ipoId: number, personId: number) =>
    post<AllotmentCheckResult>('/api/allotment/check', { ipoId, personId }),

  // ---- Dashboard ----
  getDashboardStats: () => get<DashboardStats>('/api/dashboard/stats'),
  getAllotments: () => get<Allotment[]>('/api/dashboard/allotments'),
  getProfitLoss: (period: ProfitLossPeriod) =>
    get<ProfitLossReport>(`/api/dashboard/profit-loss${query({ period })}`),
};

export { BASE_URL };
