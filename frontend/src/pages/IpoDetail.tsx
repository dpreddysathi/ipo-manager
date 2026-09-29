import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useDrawer } from '../drawer';
import type {
  Application,
  AppStatus,
  Ipo,
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
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('money');
  const [groupByPerson, setGroupByPerson] = useState(false);

  const [showTxn, setShowTxn] = useState(false);
  const [txnPrefill, setTxnPrefill] = useState<TxnPrefill | undefined>();
  const [editTxn, setEditTxn] = useState<Transaction | null>(null);
  const [showApp, setShowApp] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  // Inline "Refund amount?" prompt after marking Not Allotted (spec §4.2)
  const [refundFor, setRefundFor] = useState<Application | null>(null);
  const [refundAmt, setRefundAmt] = useState('');

  // Record-sale modal for allotted applications (profit/loss)
  const [saleFor, setSaleFor] = useState<Application | null>(null);

  const load = useCallback(() => {
    if (!ipoId) return;
    setLoading(true);
    Promise.all([
      api.getIpo(ipoId),
      api.listTransactions({ ipoId }),
      api.listApplications({ ipoId }),
      api.listPeople(),
    ])
      .then(([i, t, a, p]) => {
        setIpo(i);
        setTxns(t);
        setApps(a);
        setPeople(p);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Failed to load IPO.'),
      )
      .finally(() => setLoading(false));
  }, [ipoId]);

  useEffect(load, [load]);

  const personName = useCallback(
    (pid: number, fallback?: string) =>
      fallback ??
      people.find((p) => p.id === pid)?.name ??
      `Person #${pid}`,
    [people],
  );

  const received = useMemo(
    () => txns.filter((t) => t.direction === 'RECEIVED'),
    [txns],
  );

  const grouped = useMemo(() => {
    const map = new Map<number, { name: string; rows: Transaction[]; total: number }>();
    for (const t of received) {
      const g = map.get(t.personId) ?? {
        name: personName(t.personId, t.personName),
        rows: [],
        total: 0,
      };
      g.rows.push(t);
      g.total += t.amount;
      map.set(t.personId, g);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [received, personName]);

  const totalReceived = useMemo(
    () => received.reduce((s, t) => s + t.amount, 0),
    [received],
  );

  const changeStatus = async (app: Application, status: AppStatus) => {
    try {
      await api.updateApplicationStatus(app.id, status);
      setApps((prev) =>
        prev.map((a) => (a.id === app.id ? { ...a, status } : a)),
      );
      if (status === 'NOT_ALLOTTED') {
        setRefundFor({ ...app, status });
        setRefundAmt(String(app.amount));
      } else {
        setRefundFor(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Status update failed.');
    }
  };

  const openRefundForm = () => {
    if (!refundFor) return;
    setTxnPrefill({
      personId: refundFor.personId,
      ipoId,
      direction: 'SENT',
      amount: Number(refundAmt) || refundFor.amount,
      mode: 'UPI',
      date: nowLocal(),
      notes: 'Refund — not allotted',
    });
    setRefundFor(null);
    setShowTxn(true);
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

  if (loading) return <div className="loading">Loading IPO…</div>;
  if (error && !ipo) return <div className="error-box">{error}</div>;
  if (!ipo) return <div className="empty">IPO not found.</div>;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{ipo.name}</h1>
          <p className="sub">
            <span className={pillClassForIpoStatus(ipo.status)}>
              {ipo.status}
            </span>{' '}
            {ipo.openDate && <>· opens {formatDate(ipo.openDate)}</>}
            {ipo.closeDate && <> · closes {formatDate(ipo.closeDate)}</>} ·{' '}
            received <strong>{formatINR(totalReceived)}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
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

      <div className="tabs">
        <button
          className={tab === 'money' ? 'on' : ''}
          onClick={() => setTab('money')}
        >
          💰 Money Received ({received.length})
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
            <label className="toggle">
              <input
                type="checkbox"
                checked={groupByPerson}
                onChange={(e) => setGroupByPerson(e.target.checked)}
              />
              Group by person
            </label>
            <div style={{ marginLeft: 'auto' }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setTxnPrefill({ ipoId, direction: 'RECEIVED', date: nowLocal() });
                  setShowTxn(true);
                }}
              >
                + Record Money Received
              </button>
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Person</th>
                    <th>From → To</th>
                    <th className="num">Amount</th>
                    <th>Mode</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {!groupByPerson &&
                    received.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <button
                            className="person-link"
                            onClick={() =>
                              openDrawer({ personId: t.personId, ipoId })
                            }
                          >
                            {personName(t.personId, t.personName)}
                          </button>
                        </td>
                        <td>
                          <span className="route">
                            <span className="route-from">
                              {t.sender?.trim() ||
                                personName(t.personId, t.personName)}
                            </span>
                            <span className="route-arrow"> → </span>
                            <span className="route-to">
                              {t.receiver?.trim() || 'Me'}
                            </span>
                          </span>
                        </td>
                        <td className="num strong">{formatINR(t.amount)}</td>
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
                        <td>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setEditTxn(t)}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  {groupByPerson &&
                    grouped.map((g) => (
                      <Fragment key={g.name}>
                        <tr className="group-header">
                          <td colSpan={7}>
                            {g.name} — {g.rows.length} payment
                            {g.rows.length !== 1 && 's'}
                          </td>
                        </tr>
                        {g.rows.map((t) => (
                          <tr key={t.id}>
                            <td style={{ paddingLeft: 28 }}>
                              <button
                                className="person-link"
                                onClick={() =>
                                  openDrawer({ personId: t.personId, ipoId })
                                }
                              >
                                {personName(t.personId, t.personName)}
                              </button>
                            </td>
                            <td>
                          <span className="route">
                            <span className="route-from">
                              {t.sender?.trim() ||
                                personName(t.personId, t.personName)}
                            </span>
                            <span className="route-arrow"> → </span>
                            <span className="route-to">
                              {t.receiver?.trim() || 'Me'}
                            </span>
                          </span>
                        </td>
                            <td className="num">{formatINR(t.amount)}</td>
                            <td className="mode-cell">
                              <span className="mode-icon">
                                {MODE_ICONS[t.mode]}
                              </span>
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
                            <td>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setEditTxn(t)}
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                        <tr className="group-subtotal">
                          <td>Subtotal</td>
                          <td />
                          <td className="num">{formatINR(g.total)}</td>
                          <td colSpan={4} />
                        </tr>
                      </Fragment>
                    ))}
                  {received.length === 0 && (
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
                    <th>Confirmed by</th>
                    <th className="num">P&amp;L</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {apps.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <button
                          className="person-link"
                          onClick={() =>
                            openDrawer({ personId: a.personId, ipoId })
                          }
                        >
                          {personName(a.personId, a.personName)}
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
                          aria-label={`Status for ${personName(a.personId, a.personName)}`}
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
                      <td style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
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
                          a.soldAt ? `Sold ${formatDateTime(a.soldAt)}` : undefined
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
                  ))}
                  {apps.length === 0 && (
                    <tr>
                      <td colSpan={7} className="empty">
                        No applications yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {refundFor && (
            <div className="refund-prompt">
              <span>
                ↩ Refund {formatINR(Number(refundAmt) || refundFor.amount)} to{' '}
                {personName(refundFor.personId, refundFor.personName)}?
              </span>
              <input
                type="number"
                min="0"
                value={refundAmt}
                onChange={(e) => setRefundAmt(e.target.value)}
                aria-label="Refund amount"
              />
              <button className="btn btn-primary btn-sm" onClick={openRefundForm}>
                Record Money Sent
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setRefundFor(null)}
              >
                Dismiss
              </button>
            </div>
          )}
        </>
      )}

      {showTxn && (
        <TransactionModal
          title="Record Transaction"
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
      {saleFor && (
        <SaleModal
          application={{
            id: saleFor.id,
            personName: personName(saleFor.personId, saleFor.personName),
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
