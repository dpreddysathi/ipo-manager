import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useDrawer } from '../drawer';
import type { Ipo, Person, PersonKyc, PersonReport, PartyOwed, ReportFilters, ReportIpoRow, Transaction } from '../types';
import {
  APP_STATUS_LABELS,
  MODE_ICONS,
  MODE_LABELS,
  TXN_STATUS_LABELS,
  formatDateTime,
  formatINR,
  formatSignedINR,
  initials,
  pillClassForAppStatus,
  pillClassForTxnStatus,
} from '../utils';
import { MaskedField } from './MaskedField';
import { PersonModal, ReturnModal } from './Modals';

type VerdictKind = 'green' | 'amber' | 'blue';

function verdictForRow(row: ReportIpoRow, personName: string): {
  kind: VerdictKind;
  text: string;
} {
  const firstName = personName.split(' ')[0];
  if (row.owes.length > 0) {
    const parts = row.owes
      .map((o) => `${o.partyName} ${formatINR(o.amount)}`)
      .join(', ');
    return { kind: 'amber', text: `${firstName} owes ${parts}` };
  }
  const allotted = row.applications.some((a) => a.status === 'ALLOTTED');
  if (allotted) {
    return {
      kind: 'blue',
      text: `Shares allotted — cash debt clears only when money is returned.`,
    };
  }
  return { kind: 'green', text: 'No outstanding cash obligation in this ledger.' };
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


/** Tappable counterparty name — opens their report. "Me" is plain text. */
function PartyName({
  id,
  name,
  ipoId,
  onOpen,
}: {
  id: number | null;
  name: string;
  ipoId?: number;
  onOpen: (partyId: number | null, ipoId?: number) => void;
}) {
  if (id == null) return <span>{name}</span>;
  return (
    <button
      type="button"
      className="party-link"
      onClick={() => onOpen(id, ipoId)}
      title={`Open ${name}'s report`}
    >
      {name}
    </button>
  );
}

function TxnRow({
  t,
  ipoId,
  onOpenParty,
  onReturn,
}: {
  t: Transaction;
  ipoId: number;
  onOpenParty: (partyId: number | null, ipoId?: number) => void;
  onReturn: (t: Transaction) => void;
}) {
  const open = (t.outstanding ?? 0) > 0 && !t.settled && t.returnOfId == null;
  return (
    <div className={`txn-row${t.struck ? ' struck' : ''}`}>
      <div className="txn-main">
        <PartyName id={t.senderId} name={t.senderName} ipoId={ipoId} onOpen={onOpenParty} />
        <span aria-hidden>→</span>
        <PartyName id={t.receiverId} name={t.receiverName} ipoId={ipoId} onOpen={onOpenParty} />
        <span className="num strong">{formatINR(t.amount)}</span>
      </div>
      <div className="txn-sub">
        <span>{formatDateTime(t.date)}</span>
        <span>· {MODE_LABELS[t.mode]}</span>
        <span className={pillClassForTxnStatus(t.status)}>
          {TXN_STATUS_LABELS[t.status] ?? t.status}
        </span>
        {t.returnOfId != null && <span>· return</span>}
        {t.status === 'SETTLED_SOLD' && t.profitLoss != null && (
          <span
            style={{
              color: t.profitLoss >= 0 ? 'var(--green)' : 'var(--red)',
              fontWeight: 600,
            }}
          >
            P&L {formatSignedINR(t.profitLoss)}
          </span>
        )}
      </div>
      {open && (
        <div style={{ marginTop: 6 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onReturn(t)}
          >
            Record return
          </button>
        </div>
      )}
    </div>
  );
}

function OwesCard({
  title,
  rows,
  personName,
  ipoId,
  onOpenParty,
  tone,
}: {
  title: string;
  rows: PartyOwed[];
  personName: string;
  ipoId: number;
  onOpenParty: (partyId: number | null, ipoId?: number) => void;
  tone: 'amber' | 'green';
}) {
  if (rows.length === 0) return null;
  const firstName = personName.split(' ')[0];
  return (
    <div
      className="card owes-card"
      style={{
        borderLeft: `4px solid var(--${tone})`,
      }}
    >
      <div className="strong" style={{ marginBottom: 2 }}>{title}</div>
      {rows.map((o, i) => (
        <div className="owes-row" key={`${o.partyId}-${i}`}>
          <span>
            {tone === 'amber' ? `${firstName} owes ` : `${firstName} is owed by `}
            <PartyName id={o.partyId} name={o.partyName} ipoId={ipoId} onOpen={onOpenParty} />
          </span>
          <span className="num strong">{formatINR(o.amount)}</span>
        </div>
      ))}
    </div>
  );
}

export function PersonDrawer() {
  const { selection, visible, closeDrawer, openDrawer } = useDrawer();
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
  /** One-tap return on an open leg from this person's report. */
  const [returnTxn, setReturnTxn] = useState<{
    txn: Transaction;
    row: ReportIpoRow;
  } | null>(null);

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

  const openParty = useCallback(
    (partyId: number | null, ipoId?: number) => {
      if (partyId == null) return;
      openDrawer({ personId: partyId, ipoId });
    },
    [openDrawer],
  );

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
              {/* Verdict — largest text in the drawer */}
            {scoped && scopedRow && scopedVerdict ? (
              <div className={`verdict verdict-${scopedVerdict.kind}`}>
                {scopedVerdict.text}
              </div>
            ) : (
              <div
                className="stats-grid"
                style={{ gridTemplateColumns: '1fr 1fr 1fr' }}
              >
                <div className="stat-card">
                  <div className="stat-label">Received</div>
                  <div className="stat-value">
                    {formatINR(report.totals.received)}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Sent</div>
                  <div className="stat-value">
                    {formatINR(report.totals.sent)}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Owes</div>
                  <div className="stat-value">
                    {formatINR(report.totals.outstanding)}
                  </div>
                </div>
              </div>
            )}

            {/* Per-IPO ledger */}
            {(scoped && scopedRow ? [scopedRow] : report.ipos).map((row) => (
              <div className="drawer-section" key={row.ipoId}>
                <h3>
                  {row.ipoName}{' '}
                  {!scoped && (
                    <button
                      type="button"
                      className="party-link"
                      onClick={() => applyFilters({ ipoId: row.ipoId })}
                    >
                      view →
                    </button>
                  )}
                </h3>
                <OwesCard
                  title="Owes"
                  rows={row.owes}
                  personName={report.person.name}
                  ipoId={row.ipoId}
                  onOpenParty={openParty}
                  tone="amber"
                />
                <OwesCard
                  title="Owed to them"
                  rows={row.owedBy}
                  personName={report.person.name}
                  ipoId={row.ipoId}
                  onOpenParty={openParty}
                  tone="green"
                />
                {row.transactions.length > 0 ? (
                  <div className="card" style={{ padding: 0, marginBottom: 8 }}>
                    {row.transactions.map((t) => (
                      <TxnRow
                        key={t.id}
                        t={t}
                        ipoId={row.ipoId}
                        onOpenParty={openParty}
                        onReturn={(txn) => setReturnTxn({ txn, row })}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="empty">
                    No money movements match the filters.
                  </div>
                )}
                {row.applications.length > 0 && (
                  <div className="card" style={{ padding: '10px 14px' }}>
                    <div className="strong" style={{ marginBottom: 6 }}>
                      Applications
                    </div>
                    {row.applications.map((a) => (
                      <div
                        key={a.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '4px 0',
                          fontSize: '0.9rem',
                        }}
                      >
                        <span className="num">{formatINR(a.amount)}</span>
                        <span className={pillClassForAppStatus(a.status)}>
                          {APP_STATUS_LABELS[a.status] ?? a.status}
                        </span>
                        {a.profitLoss != null && (
                          <span
                            style={{
                              color:
                                a.profitLoss >= 0
                                  ? 'var(--green)'
                                  : 'var(--red)',
                              fontWeight: 600,
                            }}
                          >
                            P&L {formatSignedINR(a.profitLoss)}
                          </span>
                        )}
                        <span className="sub">
                          {a.appliedDate ?? ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

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
      {returnTxn && report && (
        <ReturnModal
          txn={returnTxn.txn}
          allotted={
            returnTxn.txn.receiverId === report.person.id
              ? returnTxn.row.applications.some((a) => a.status === 'ALLOTTED')
              : undefined
          }
          onClose={() => setReturnTxn(null)}
          onDone={() => {
            setReturnTxn(null);
            if (selection) loadReport(selection.personId, filters);
          }}
        />
      )}
    </>
  );
}
