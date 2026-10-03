import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useDrawer } from '../drawer';
import type {
  Application,
  AppStatus,
  Ipo,
  IpoDebt,
  IpoSummary,
  Person,
  Transaction,
} from '../types';
import {
  APP_STATUS_LABELS,
  MODE_ICONS,
  MODE_LABELS,
  TXN_STATUS_LABELS,
  formatDate,
  formatDateTime,
  formatINR,
  formatSignedINR,
  nowLocal,
  pillClassForAppStatus,
  pillClassForIpoStatus,
  pillClassForTxnStatus,
  todayISO,
} from '../utils';
import {
  ApplicationModal,
  IpoModal,
  ReturnModal,
  SaleModal,
  TransactionModal,
  type TxnPrefill,
} from '../components/Modals';

type Tab = 'money' | 'apps';

export function IpoDetail() {
  const { id } = useParams<{ id: string }>();
  const ipoId = Number(id);
  const navigate = useNavigate();
  const { openDrawer } = useDrawer();

  const [ipo, setIpo] = useState<Ipo | null>(null);
  const [summary, setSummary] = useState<IpoSummary | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('money');

  const [showTxn, setShowTxn] = useState(false);
  const [txnPrefill, setTxnPrefill] = useState<TxnPrefill | undefined>();
  const [editTxn, setEditTxn] = useState<Transaction | null>(null);
  const [returnTxn, setReturnTxn] = useState<Transaction | null>(null);
  const [showApp, setShowApp] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  // After marking Not Allotted, offer one-tap returns on that person's
  // still-open legs (money is owed until it is actually returned).
  const [refundApp, setRefundApp] = useState<Application | null>(null);

  // Record-sale modal for allotted applications (profit/loss)
  const [saleFor, setSaleFor] = useState<Application | null>(null);

  const load = useCallback(() => {
    if (!ipoId) return;
    setLoading(true);
    Promise.all([
      api.getIpo(ipoId),
      api.getIpoSummary(ipoId),
      api.listApplications({ ipoId }),
      api.listPeople(),
    ])
      .then(([i, s, a, p]) => {
        setIpo(i);
        setSummary(s);
        setApps(a);
        setPeople(p);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Failed to load IPO.'),
      )
      .finally(() => setLoading(false));
  }, [ipoId]);

  useEffect(load, [load]);

  const partyName = useCallback(
    (pid: number | null, fallback?: string) =>
      pid == null
        ? 'Me'
        : (fallback ??
          people.find((p) => p.id === pid)?.name ??
          `Person #${pid}`),
    [people],
  );

  const openPerson = useCallback(
    (pid: number | null) => {
      if (pid == null) return;
      openDrawer({ personId: pid, ipoId });
    },
    [openDrawer, ipoId],
  );

  const txns: Transaction[] = summary?.transactions ?? [];

  /** Receiver's application status, for the allotted hint in ReturnModal. */
  const allottedHint = useCallback(
    (t: Transaction): boolean | undefined => {
      if (t.receiverId == null) return undefined;
      const app = apps.find(
        (a) => a.personId === t.receiverId && a.ipoId === t.ipoId,
      );
      return app ? app.status === 'ALLOTTED' : undefined;
    },
    [apps],
  );

  const isOpenLeg = (t: Transaction) =>
    (t.outstanding ?? 0) > 0 && !t.settled && t.returnOfId == null;

  const openLegs = useMemo(() => txns.filter(isOpenLeg), [txns]);

  const returnedTotal = useMemo(
    () => txns.filter((t) => t.returnOfId != null).reduce((s, t) => s + t.amount, 0),
    [txns],
  );

  const refundLegs = useMemo(() => {
    if (!refundApp) return [];
    return openLegs.filter((t) => t.receiverId === refundApp.personId);
  }, [refundApp, openLegs]);

  /** Funding info per application, from the summary. */
  const fundingFor = useCallback(
    (appId: number) =>
      summary?.applications.find((x) => x.application.id === appId),
    [summary],
  );

  const changeStatus = async (app: Application, status: AppStatus) => {
    try {
      await api.updateApplicationStatus(app.id, status);
      await load();
      if (status === 'NOT_ALLOTTED') {
        setRefundApp({ ...app, status });
        setTab('money');
      } else {
        setRefundApp(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Status update failed.');
    }
  };

  const deleteIpo = async () => {
    if (!ipo) return;
    if (
      !window.confirm(
        `Delete "${ipo.name}" and all its transactions & applications?`,
      )
    )
      return;
    try {
      await api.deleteIpo(ipo.id);
      navigate('/ipos');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
    }
  };

  const toggleBoardHidden = async () => {
    if (!ipo) return;
    try {
      const updated = await api.setIpoBoardHidden(ipo.id, !ipo.boardHidden);
      setIpo(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed.');
    }
  };

  if (loading) return <div className="loading">Loading IPO…</div>;
  if (error && !ipo) return <div className="error-box">{error}</div>;
  if (!ipo) return <div className="empty">IPO not found.</div>;

  const DebtRow = ({ d }: { d: IpoDebt }) => (
    <div
      className="owes-row"
      key={`${d.senderId ?? 'me'}-${d.receiverId ?? 'me'}`}
    >
      <span>
        <button
          type="button"
          className="party-link"
          onClick={() => openPerson(d.receiverId)}
          disabled={d.receiverId == null}
          style={
            d.receiverId == null
              ? { color: 'inherit', cursor: 'default' }
              : undefined
          }
        >
          {d.receiverName}
        </button>{' '}
        owes{' '}
        <button
          type="button"
          className="party-link"
          onClick={() => openPerson(d.senderId)}
          disabled={d.senderId == null}
          style={
            d.senderId == null
              ? { color: 'inherit', cursor: 'default' }
              : undefined
          }
        >
          {d.senderName}
        </button>
      </span>
      <span className="num strong">{formatINR(d.amount)}</span>
    </div>
  );

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{ipo.name}</h1>
          <p className="sub">
            <span className={pillClassForIpoStatus(ipo.status)}>
              {ipo.status}
            </span>{' '}
            {ipo.source === 'AUTO' && (
              <span className="pill pill-auto">AUTO</span>
            )}{' '}
            {ipo.openDate && <>· opens {formatDate(ipo.openDate)}</>}
            {ipo.closeDate && <> · closes {formatDate(ipo.closeDate)}</>}
            {ipo.allotmentDate && (
              <> · allotment {formatDate(ipo.allotmentDate)}</>
            )}
            {ipo.listingDate && <> · lists {formatDate(ipo.listingDate)}</>}
          </p>
          {(ipo.priceLow != null ||
            ipo.priceHigh != null ||
            ipo.lotSize != null ||
            ipo.issueSize ||
            ipo.leadManager ||
            ipo.listingExchange) && (
            <p className="sub" style={{ marginTop: 4 }}>
              {ipo.priceLow != null && ipo.priceHigh != null && (
                <>Band ₹{formatINR(ipo.priceLow)}–₹{formatINR(ipo.priceHigh)} · </>
              )}
              {ipo.lotSize != null && <>{ipo.lotSize} shares/lot · </>}
              {ipo.issueSize && <>{ipo.issueSize} · </>}
              {ipo.listingExchange && <>{ipo.listingExchange} · </>}
              {ipo.leadManager && <>{ipo.leadManager}</>}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={toggleBoardHidden}
          >
            {ipo.boardHidden ? 'Restore to board' : 'Remove from board'}
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowEdit(true)}
          >
            Edit
          </button>
          <button className="btn btn-secondary btn-sm" onClick={deleteIpo}>
            Delete
          </button>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      {/* Summary cards */}
      {summary && (
        <div
          className="stats-grid"
          style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}
        >
          <div className="stat-card">
            <div className="stat-label">Money moved</div>
            <div className="stat-value">
              {formatINR(summary.receivedTotal)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Returned</div>
            <div className="stat-value">{formatINR(returnedTotal)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Still owed</div>
            <div
              className="stat-value"
              style={{
                color:
                  summary.outstandingTotal > 0 ? 'var(--amber)' : undefined,
              }}
            >
              {formatINR(summary.outstandingTotal)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Allotted</div>
            <div className="stat-value">
              {summary.allottedCount}/{summary.applicationCount}
            </div>
          </div>
        </div>
      )}

      {/* Outstanding debts — the money that still has to come back */}
      {summary && (
        <div className="drawer-section">
          <h3>Outstanding debts</h3>
          {summary.outstanding.length > 0 ? (
            <div
              className="card owes-card"
              style={{ borderLeft: '4px solid var(--amber)' }}
            >
              {summary.outstanding.map((d) => (
                <DebtRow
                  key={`${d.senderId ?? 'me'}-${d.receiverId ?? 'me'}`}
                  d={d}
                />
              ))}
            </div>
          ) : (
            <div className="empty">All settled — nobody owes anything.</div>
          )}
        </div>
      )}

      <div className="tabs">
        <button
          className={tab === 'money' ? 'on' : ''}
          onClick={() => setTab('money')}
        >
          💰 Money ({txns.length})
        </button>
        <button
          className={tab === 'apps' ? 'on' : ''}
          onClick={() => setTab('apps')}
        >
          📝 Applications ({apps.length})
        </button>
      </div>

      {tab === 'money' && (
        <>
          <div className="toolbar">
            <div style={{ marginLeft: 'auto' }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setTxnPrefill({ ipoId, date: nowLocal() });
                  setShowTxn(true);
                }}
              >
                + Record Movement
              </button>
            </div>
          </div>

          {refundApp && (
            <div className="refund-prompt">
              <span>
                ↩ {partyName(refundApp.personId, refundApp.personName)} wasn&apos;t
                allotted — return the money:
              </span>
              {refundLegs.length > 0 ? (
                <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {refundLegs.map((t) => (
                    <button
                      key={t.id}
                      className="btn btn-primary btn-sm"
                      onClick={() => setReturnTxn(t)}
                    >
                      Return {formatINR(t.outstanding ?? t.amount)} to{' '}
                      {partyName(t.senderId, t.senderName)}
                    </button>
                  ))}
                </span>
              ) : (
                <span className="sub">nothing open — already returned.</span>
              )}
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setRefundApp(null)}
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>From → To</th>
                    <th className="num">Amount</th>
                    <th className="num">Outstanding</th>
                    <th>Mode</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {txns.map((t) => {
                    const open = isOpenLeg(t);
                    return (
                      <tr key={t.id} className={t.struck ? 'struck-row' : ''}>
                        <td>
                          <button
                            className="party-link"
                            onClick={() => openPerson(t.senderId)}
                            disabled={t.senderId == null}
                            style={
                              t.senderId == null
                                ? { color: 'inherit', cursor: 'default' }
                                : undefined
                            }
                          >
                            {partyName(t.senderId, t.senderName)}
                          </button>
                          <span aria-hidden> → </span>
                          <button
                            className="party-link"
                            onClick={() => openPerson(t.receiverId)}
                            disabled={t.receiverId == null}
                            style={
                              t.receiverId == null
                                ? { color: 'inherit', cursor: 'default' }
                                : undefined
                            }
                          >
                            {partyName(t.receiverId, t.receiverName)}
                          </button>
                          {t.returnOfId != null && (
                            <span className="sub"> · return</span>
                          )}
                        </td>
                        <td className="num strong">{formatINR(t.amount)}</td>
                        <td className="num">
                          {(t.outstanding ?? 0) > 0 ? (
                            <strong style={{ color: 'var(--amber)' }}>
                              {formatINR(t.outstanding ?? 0)}
                            </strong>
                          ) : (
                            <span className="sub">—</span>
                          )}
                        </td>
                        <td className="mode-cell">
                          <span className="mode-icon">{MODE_ICONS[t.mode]}</span>
                          {MODE_LABELS[t.mode]}
                        </td>
                        <td>{formatDateTime(t.date)}</td>
                        <td>
                          <span className={pillClassForTxnStatus(t.status)}>
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
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {open && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => setReturnTxn(t)}
                              style={{ marginRight: 6 }}
                            >
                              Return
                            </button>
                          )}
                          {t.returnOfId == null && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setEditTxn(t)}
                            >
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {txns.length === 0 && (
                    <tr>
                      <td colSpan={7} className="empty">
                        No money recorded for this IPO yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'apps' && (
        <>
          <div className="toolbar">
            <div style={{ marginLeft: 'auto' }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowApp(true)}
              >
                + Add Application
              </button>
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Person</th>
                    <th className="num">Amount</th>
                    <th>Applied</th>
                    <th>Status</th>
                    <th>Funding</th>
                    <th>Confirmed by</th>
                    <th className="num">P&amp;L</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {apps.map((a) => {
                    const funding = fundingFor(a.id);
                    return (
                      <tr key={a.id}>
                        <td>
                          <button
                            className="person-link"
                            onClick={() =>
                              openDrawer({ personId: a.personId, ipoId })
                            }
                          >
                            {partyName(a.personId, a.personName)}
                          </button>
                        </td>
                        <td className="num strong">{formatINR(a.amount)}</td>
                        <td>{formatDate(a.appliedDate)}</td>
                        <td>
                          <select
                            className="status-select"
                            value={a.status}
                            onChange={(e) =>
                              changeStatus(a, e.target.value as AppStatus)
                            }
                            aria-label={`Status for ${partyName(a.personId, a.personName)}`}
                          >
                            {(Object.keys(APP_STATUS_LABELS) as AppStatus[]).map(
                              (s) => (
                                <option key={s} value={s}>
                                  {APP_STATUS_LABELS[s]}
                                </option>
                              ),
                            )}
                          </select>{' '}
                          <span className={pillClassForAppStatus(a.status)}>
                            {APP_STATUS_LABELS[a.status]}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>
                          {funding && funding.funders.length > 0 ? (
                            funding.funders.map((f) => (
                              <div key={f.funderId ?? 'me'}>
                                {f.funderId != null ? (
                                  <button
                                    type="button"
                                    className="party-link"
                                    onClick={() => openPerson(f.funderId)}
                                  >
                                    {f.funderName}
                                  </button>
                                ) : (
                                  <span>{f.funderName}</span>
                                )}{' '}
                                <span className="num">{formatINR(f.amount)}</span>
                                {f.outstanding > 0 && (
                                  <span
                                    className="sub"
                                    style={{ color: 'var(--amber)' }}
                                  >
                                    {' '}
                                    · owes {formatINR(f.outstanding)}
                                  </span>
                                )}
                              </div>
                            ))
                          ) : (
                            <span className="sub">—</span>
                          )}
                        </td>
                        <td
                          style={{ fontSize: '0.85rem', color: 'var(--muted)' }}
                        >
                          {a.allottedBy
                            ? `${a.allottedBy}${a.allottedAt ? ` · ${formatDate(a.allottedAt)}` : ''}`
                            : '—'}
                        </td>
                        <td
                          className="num strong"
                          style={{
                            color:
                              a.profitLoss != null && a.profitLoss > 0
                                ? 'var(--green)'
                                : a.profitLoss != null && a.profitLoss < 0
                                  ? 'var(--red)'
                                  : undefined,
                          }}
                          title={
                            a.soldAt
                              ? `Sold ${formatDateTime(a.soldAt)}`
                              : undefined
                          }
                        >
                          {a.profitLoss != null ? formatINR(a.profitLoss) : '—'}
                        </td>
                        <td>
                          {a.status === 'ALLOTTED' && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setSaleFor(a)}
                            >
                              {a.profitLoss != null ? 'Edit sale' : 'Record sale'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {apps.length === 0 && (
                    <tr>
                      <td colSpan={8} className="empty">
                        No applications yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showTxn && (
        <TransactionModal
          title="Record Money Movement"
          prefill={txnPrefill}
          onClose={() => {
            setShowTxn(false);
            setTxnPrefill(undefined);
          }}
          onSaved={() => {
            setShowTxn(false);
            setTxnPrefill(undefined);
            load();
          }}
        />
      )}
      {editTxn && (
        <TransactionModal
          editTxn={editTxn}
          onClose={() => setEditTxn(null)}
          onSaved={() => {
            setEditTxn(null);
            load();
          }}
        />
      )}
      {returnTxn && (
        <ReturnModal
          txn={returnTxn}
          allotted={allottedHint(returnTxn)}
          onClose={() => setReturnTxn(null)}
          onDone={() => {
            setReturnTxn(null);
            load();
          }}
        />
      )}
      {saleFor && (
        <SaleModal
          application={{
            id: saleFor.id,
            personName: partyName(saleFor.personId, saleFor.personName),
            ipoName: ipo?.name,
            profitLoss: saleFor.profitLoss,
          }}
          onClose={() => setSaleFor(null)}
          onSaved={() => {
            setSaleFor(null);
            load();
          }}
        />
      )}

      {showApp && (
        <ApplicationModal
          prefill={{ ipoId, appliedDate: todayISO() }}
          onClose={() => setShowApp(false)}
          onSaved={() => {
            setShowApp(false);
            load();
          }}
        />
      )}
      {showEdit && (
        <IpoModal
          initial={ipo}
          onClose={() => setShowEdit(false)}
          onSaved={() => {
            setShowEdit(false);
            load();
          }}
        />
      )}
    </div>
  );
}
