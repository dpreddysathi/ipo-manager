import type {
  Allotment,
  Application,
  ApplicationInput,
  AppStatus,
  DashboardStats,
  Ipo,
  IpoInput,
  KycInput,
  Person,
  PersonInput,
  PersonKyc,
  PersonReport,
  ProfitLossPeriod,
  ProfitLossReport,
  ReportFilters,
  SaleInput,
  SendReportResponse,
  SettleInput,
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      /* ignore */
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
  createIpo: (data: IpoInput) => post<Ipo>('/api/ipos', data),
  updateIpo: (id: number, data: IpoInput) =>
    put<Ipo>(`/api/ipos/${id}`, data),
  deleteIpo: (id: number) => del(`/api/ipos/${id}`),

  // ---- Transactions ----
  listTransactions: (params?: {
    ipoId?: number;
    personId?: number;
    direction?: 'RECEIVED' | 'SENT';
    pendingOnly?: boolean;
  }) => get<Transaction[]>(`/api/transactions${query(params ?? {})}`),
  createTransaction: (data: TransactionInput) =>
    post<Transaction>('/api/transactions', data),
  updateTransaction: (id: number, data: TransactionInput) =>
    put<Transaction>(`/api/transactions/${id}`, data),
  /**
   * Marks a transaction settled: UNALLOCATED = refunded after
   * non-allocation; SOLD = settled after the allotted shares were sold
   * (optionally with the realized profit/loss vs the sent amount).
   */
  settleTransaction: (id: number, input?: SettleInput) =>
    patch<Transaction>(`/api/transactions/${id}/settle`, input ?? {}),

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

  // ---- Dashboard ----
  getDashboardStats: () => get<DashboardStats>('/api/dashboard/stats'),
  getAllotments: () => get<Allotment[]>('/api/dashboard/allotments'),
  getProfitLoss: (period: ProfitLossPeriod) =>
    get<ProfitLossReport>(`/api/dashboard/profit-loss${query({ period })}`),
};

export { BASE_URL };
