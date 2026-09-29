import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useDrawer } from '../drawer';
import type { Ipo, Person, PersonKyc, PersonReport, ReportFilters, ReportIpoRow } from '../types';
import {
  MODE_ICONS,
  MODE_LABELS,
  TXN_STATUS_LABELS,
  formatDateTime,
  formatINR,
  formatSignedINR,
  initials,
  pillClassForTxnStatus,
} from '../utils';
import { MaskedField } from './MaskedField';
import { PersonModal } from './Modals';

type VerdictKind = 'green' | 'amber' | 'blue';

function verdictForRow(row: ReportIpoRow, personName: string): {
  kind: VerdictKind;
  text: string;
} {
  const firstName = personName.split(' ')[0];
  const allotted = row.applications.some((a) => a.status === 'ALLOTTED');
  if (allotted) {
    return {
      kind: 'blue',
      text: `Shares allotted — nothing owed in cash.`,
    };
  }
  if (row.held > 0) {
    return {
      kind: 'amber',
      text: `You owe ${firstName} ${formatINR(row.held)}`,
    };
  }
  return { kind: 'green', text: 'Nothing owed — all settled.' };
}

function statusPill(status: string): string {
  const s = status.toUpperCase();
  if (s.includes('ALLOT') && !s.includes('NOT')) return 'pill pill-green';
  if (s.includes('NOT')) return 'pill pill-red';
  if (s.includes('REFUND')) return 'pill pill-blue';
  return 'pill pill-amber';
}

function KycSection({ personId }: { personId: number }) {
  const [kyc, setKyc] = useState<PersonKyc | null>(null);
  const [revealed, setRevealed] = useState<PersonKyc | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    panNumber: '',
    email: '',
    dematBroker: '',
    accountLoginId: '',
  });
  const [showRiskFields, setShowRiskFields] = useState(false);
  const [riskForm, setRiskForm] = useState({ accountPassword: '', mpin: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api
      .getKyc(personId)
      .then(setKyc)
      .catch(() => setKyc(null));
  }, [personId]);

  useEffect(() => {
    load();
    setRevealed(null);
    setEditing(false);
  }, [personId, load]);

  const handleReveal = async () => {
    if (revealed || revealing) return;
    setRevealing(true);
    try {
      const full = await api.getKyc(personId, true);
      setRevealed(full);
    } catch {
      /* keep masked on failure */
    } finally {
      setRevealing(false);
    }
  };

  const startEdit = () => {
    const src = revealed ?? kyc;
    setForm({
      panNumber: src?.panNumber ?? '',
      email: src?.email ?? '',
      dematBroker: src?.dematBroker ?? '',
      accountLoginId: src?.accountLoginId ?? '',
    });
    setRiskForm({ accountPassword: '', mpin: '' });
    setShowRiskFields(false);
    setEditing(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      if (form.panNumber.trim()) payload.panNumber = form.panNumber.trim();
      if (form.email.trim()) payload.email = form.email.trim();
      if (form.dematBroker.trim()) payload.dematBroker = form.dematBroker.trim();
      if (form.accountLoginId.trim())
        payload.accountLoginId = form.accountLoginId.trim();
      if (showRiskFields) {
        if (riskForm.accountPassword)
          payload.accountPassword = riskForm.accountPassword;
        if (riskForm.mpin) payload.mpin = riskForm.mpin;
      }
      await api.updateKyc(personId, payload);
      setRevealed(null);
      setEditing(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const masked = kyc;
  const shown = revealed ?? masked;

  return (
    <div className="drawer-section">
      <h3>KYC &amp; account details</h3>
      <div className="card" style={{ padding: '6px 16px' }}>
        <MaskedField
          label="PAN"
          masked={masked?.panNumber || '—'}
          revealed={revealed?.panNumber ?? null}
          onReveal={handleReveal}
          onHide={() => setRevealed(null)}
        />
        <MaskedField
          label="Email"
          masked={masked?.email || '—'}
          revealed={revealed?.email ?? null}
          onReveal={handleReveal}
          onHide={() => setRevealed(null)}
        />
        <div className="masked-field">
          <span className="k">Demat broker</span>
          <span className="v" style={{ fontFamily: 'inherit' }}>
            {shown?.dematBroker || '—'}
          </span>
        </div>
        <MaskedField
          label="Login ID"
          masked={masked?.accountLoginId || '—'}
          revealed={revealed?.accountLoginId ?? null}
          onReveal={handleReveal}
          onHide={() => setRevealed(null)}
        />
      </div>
      {revealing && (
        <div className="hint" style={{ marginTop: 6 }}>
          Revealing…
        </div>
      )}

      {!editing ? (
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 8 }}
          onClick={startEdit}
        >
          ✎ Update KYC
        </button>
      ) : (
        <form onSubmit={save} style={{ marginTop: 12 }}>
          <div className="card" style={{ display: 'grid', gap: 10 }}>
            <div className="field">
              <label>PAN</label>
              <input
                value={form.panNumber}
                onChange={(e) =>
                  setForm({ ...form, panNumber: e.target.value })
                }
                placeholder="ABCDE1234F"
              />
            </div>
            <div className="field">
              <label>Email</label>
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="name@gmail.com"
              />
            </div>
            <div className="field">
              <label>Demat broker</label>
              <input
                value={form.dematBroker}
                onChange={(e) =>
                  setForm({ ...form, dematBroker: e.target.value })
                }
                placeholder="Zerodha / Groww / …"
              />
            </div>
            <div className="field">
              <label>Account login ID</label>
              <input
                value={form.accountLoginId}
                onChange={(e) =>
                  setForm({ ...form, accountLoginId: e.target.value })
                }
              />
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={showRiskFields}
                onChange={(e) => setShowRiskFields(e.target.checked)}
              />
              I understand the risk — store broker password / MPIN
            </label>
            {showRiskFields && (
              <>
                <div className="kyc-note">
                  ⚠️ These are the keys to this person&apos;s brokerage
                  account. The spec strongly recommends leaving them empty and
                  using a password manager instead.
                </div>
                <div className="field">
                  <label>Account password</label>
                  <input
                    type="password"
                    value={riskForm.accountPassword}
                    onChange={(e) =>
                      setRiskForm({
                        ...riskForm,
                        accountPassword: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="field">
                  <label>MPIN</label>
                  <input
                    type="password"
                    value={riskForm.mpin}
                    onChange={(e) =>
                      setRiskForm({ ...riskForm, mpin: e.target.value })
                    }
                  />
                </div>
              </>
            )}
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save KYC'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

export function PersonDrawer() {
  const { selection, visible, closeDrawer } = useDrawer();
  const [report, setReport] = useState<PersonReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState('');
  const [ipos, setIpos] = useState<Ipo[]>([]);
  /** Report options — the drawer preview and the sent message always
   *  use the same filters. */
  const [filters, setFilters] = useState<ReportFilters>({});
  /** Edit-person modal (name/phone/notes) from the drawer header. */
  const [editPerson, setEditPerson] = useState<Person | null>(null);

  const loadReport = (personId: number, f: ReportFilters) => {
    setLoading(true);
    setError('');
    setSendMsg('');
    api
      .getPersonReport(personId, f)
      .then(setReport)
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Failed to load report.'),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!selection) {
      setReport(null);
      return;
    }
    const initial: ReportFilters = {
      ipoId: selection.ipoId,
      includeSettled: false,
      onlyUnallotted: false,
    };
    setFilters(initial);
    loadReport(selection.personId, initial);
    api
      .listIpos()
      .then(setIpos)
      .catch(() => {});
  }, [selection]);

  /** Apply a filter change and reload the preview with it. */
  const applyFilters = (patch: Partial<ReportFilters>) => {
    if (!selection) return;
    const next: ReportFilters = { ...filters, ...patch };
    // Normalize empty dates to undefined so they are omitted.
    if (!next.fromDate) delete next.fromDate;
    if (!next.toDate) delete next.toDate;
    if (next.ipoId === undefined) delete next.ipoId;
    setFilters(next);
    loadReport(selection.personId, next);
  };

  const resetFilters = () => {
    if (!selection) return;
    const initial: ReportFilters = { includeSettled: false };
    setFilters(initial);
    loadReport(selection.personId, initial);
  };

  const filtersActive =
    filters.ipoId !== undefined ||
    filters.includeSettled === true ||
    !!filters.onlyUnallotted ||
    !!filters.fromDate ||
    !!filters.toDate;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeDrawer]);

  if (!selection) return null;

  const scoped = filters.ipoId !== undefined;
  const personName = report?.person.name ?? '…';

  const sendReport = async () => {
    if (!selection) return;
    setSending(true);
    setSendMsg('');
    try {
      const res = await api.sendReport(selection.personId, filters);
      if (res.waLink) {
        window.open(res.waLink, '_blank', 'noopener');
        setSendMsg('Opening WhatsApp with the pre-filled report…');
      } else {
        setSendMsg(`Report sent (${res.status}).`);
      }
    } catch (e) {
      setSendMsg(e instanceof Error ? e.message : 'Failed to send report.');
    } finally {
      setSending(false);
    }
  };

  const scopedRow: ReportIpoRow | undefined = scoped
    ? report?.ipos[0]
    : undefined;
  const scopedVerdict =
    scopedRow && report ? verdictForRow(scopedRow, report.person.name) : null;

  return (
    <>
      <div className="overlay" onClick={closeDrawer} />
      <aside
        className={`drawer${visible ? ' open' : ''}`}
        role="dialog"
        aria-label={`Report for ${personName}`}
      >
        <div className="drawer-head">
          <div className="avatar">{initials(personName)}</div>
          <div>
            <h2>{personName}</h2>
            <div className="phone">{report?.person.phone ?? ''}</div>
            {report?.person.notes && (
              <div className="sub" style={{ marginTop: 4 }}>
                {report.person.notes}
              </div>
            )}
          </div>
          {report && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginLeft: 'auto' }}
              title={`Edit ${report.person.name}'s details`}
              onClick={() => setEditPerson(report.person)}
            >
              ✏️ Edit
            </button>
          )}
          <button
            className="drawer-close"
            onClick={closeDrawer}
            aria-label="Close report"
          >
            ×
          </button>
        </div>

        <div className="drawer-body">
          {loading && <div className="loading">Loading report…</div>}
          {error && <div className="error-box">{error}</div>}

          {report && (
            <>
              {/* Verdict — largest text in the drawer (spec §5) */}
              {scoped && scopedVerdict && scopedRow ? (
                <div
                  className={`verdict verdict-${scopedVerdict.kind}`}
                >
                  Applied {formatINR(scopedRow.applied)} ·{' '}
                  {scopedRow.status} · {scopedVerdict.text}
                </div>
              ) : (
                <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                  <div className="card" style={{ padding: 12 }}>
                    <div className="stat-label">Received</div>
                    <div className="stat-value" style={{ fontSize: '1.15rem' }}>
                      {formatINR(report.totals.received)}
                    </div>
                  </div>
                  <div className="card" style={{ padding: 12 }}>
                    <div className="stat-label">Sent back</div>
                    <div className="stat-value" style={{ fontSize: '1.15rem' }}>
                      {formatINR(report.totals.sentBack)}
                    </div>
                  </div>
                  <div className="card" style={{ padding: 12 }}>
                    <div className="stat-label">Held / owed</div>
                    <div
                      className="stat-value"
                      style={{
                        fontSize: '1.15rem',
                        color:
                          report.totals.held > 0
                            ? 'var(--amber)'
                            : 'var(--green)',
                      }}
                    >
                      {formatINR(report.totals.held)}
                    </div>
                  </div>
                </div>
              )}

              <div className="drawer-section">
                <h3>{scoped ? 'This IPO' : 'IPOs'}</h3>
                <div className="card" style={{ padding: 0 }}>
                  <div className="table-wrap">
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>IPO</th>
                          <th className="num">Applied</th>
                          <th className="num">Received</th>
                          <th className="num">Sent back</th>
                          <th className="num">Held / owed</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.ipos.map((row) => {
                          const v = verdictForRow(row, report.person.name);
                          return (
                            <tr key={row.ipoId}>
                              <td>
                                <div className="strong">{row.ipoName}</div>
                                {!scoped && (
                                  <div
                                    style={{
                                      fontSize: '0.8rem',
                                      marginTop: 4,
                                      color: `var(--${v.kind === 'green' ? 'green' : v.kind === 'amber' ? 'amber' : 'blue'})`,
                                      fontWeight: 600,
                                    }}
                                  >
                                    {v.text}
                                  </div>
                                )}
                              </td>
                              <td className="num">{formatINR(row.applied)}</td>
                              <td className="num">{formatINR(row.received)}</td>
                              <td className="num">{formatINR(row.sentBack)}</td>
                              <td className="num strong">
                                {formatINR(row.held)}
                              </td>
                              <td>
                                <span className={statusPill(row.status)}>
                                  {row.status.replace(/_/g, ' ')}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                        {report.ipos.length === 0 && (
                          <tr>
                            <td colSpan={6} className="empty">
                              No IPO activity for this person yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="drawer-section">
                <h3>Transactions</h3>
                {report.ipos.every((r) => (r.transactions ?? []).length === 0) ? (
                  <div className="card empty">
                    No transactions match the current filters.
                  </div>
                ) : (
                  report.ipos
                    .filter((r) => (r.transactions ?? []).length > 0)
                    .map((row) => (
                      <div key={row.ipoId} style={{ marginBottom: 12 }}>
                        <div className="strong" style={{ marginBottom: 6 }}>
                          {row.ipoName}
                        </div>
                        <div className="card" style={{ padding: 0 }}>
                          <div className="table-wrap">
                            <table className="tbl">
                              <tbody>
                                {(row.transactions ?? []).map((t) => (
                                  <tr key={t.id}>
                                    <td>{formatDateTime(t.date)}</td>
                                    <td>
                                      <span
                                        className={
                                          t.direction === 'RECEIVED'
                                            ? 'pill pill-green'
                                            : 'pill pill-blue'
                                        }
                                      >
                                        {t.direction === 'RECEIVED'
                                          ? '↓ Received'
                                          : '↑ Sent back'}
                                      </span>
                                    </td>
                                    <td className="num strong">
                                      {formatINR(t.amount)}
                                    </td>
                                    <td className="mode-cell">
                                      <span className="mode-icon">
                                        {MODE_ICONS[t.mode]}
                                      </span>
                                      {MODE_LABELS[t.mode]}
                                    </td>
                                    <td>
                                      <span
                                        className={pillClassForTxnStatus(
                                          t.status,
                                        )}
                                      >
                                        {TXN_STATUS_LABELS[t.status] ?? t.status}
                                      </span>
                                      {t.status === 'SETTLED_SOLD' &&
                                        t.profitLoss != null && (
                                          <div
                                            className="sub"
                                            style={{
                                              color:
                                                t.profitLoss >= 0
                                                  ? 'var(--green)'
                                                  : 'var(--red)',
                                              fontWeight: 600,
                                            }}
                                          >
                                            P&L {formatSignedINR(t.profitLoss)}
                                          </div>
                                        )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>

              <KycSection personId={report.person.id} />

              <div className="drawer-section">
                <h3>Report options</h3>
                <div className="card" style={{ display: 'grid', gap: 12 }}>
                  <div className="field">
                    <label>IPO</label>
                    <select
                      value={filters.ipoId ?? ''}
                      onChange={(e) =>
                        applyFilters({
                          ipoId: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        })
                      }
                    >
                      <option value="">All IPOs</option>
                      {ipos.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Amounts</label>
                    <div className="seg">
                      <button
                        type="button"
                        className={filters.includeSettled !== false ? 'on' : ''}
                        onClick={() => applyFilters({ includeSettled: true })}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        className={filters.includeSettled === false ? 'on' : ''}
                        onClick={() => applyFilters({ includeSettled: false })}
                      >
                        Only unsettled
                      </button>
                    </div>
                  </div>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={!!filters.onlyUnallotted}
                      onChange={(e) =>
                        applyFilters({ onlyUnallotted: e.target.checked })
                      }
                    />
                    Only IPOs with no allotment yet
                  </label>
                  <div className="field-row">
                    <div className="field">
                      <label>From date</label>
                      <input
                        type="date"
                        value={filters.fromDate ?? ''}
                        onChange={(e) =>
                          applyFilters({ fromDate: e.target.value || undefined })
                        }
                      />
                    </div>
                    <div className="field">
                      <label>To date</label>
                      <input
                        type="date"
                        value={filters.toDate ?? ''}
                        onChange={(e) =>
                          applyFilters({ toDate: e.target.value || undefined })
                        }
                      />
                    </div>
                  </div>
                  {filtersActive && (
                    <div>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={resetFilters}
                      >
                        Clear filters
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="drawer-actions">
                <button
                  className="btn btn-primary"
                  onClick={sendReport}
                  disabled={sending}
                >
                  {sending ? 'Preparing…' : '📩 Send Report'}
                </button>
              </div>
              {sendMsg && (
                <div className="hint" style={{ marginTop: 8 }}>
                  {sendMsg}
                </div>
              )}
              <div className="kyc-note">
                Sends this person&apos;s summary to their phone number via
                WhatsApp (opens a pre-filled chat — you hit send). The
                message reflects the report options above.
              </div>
            </>
          )}
        </div>
      </aside>
      {editPerson && (
        <PersonModal
          initial={editPerson}
          onClose={() => setEditPerson(null)}
          onSaved={() => {
            setEditPerson(null);
            if (selection) loadReport(selection.personId, filters);
          }}
        />
      )}
    </>
  );
}
