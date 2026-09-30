import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useDrawer } from '../drawer';
import type { Application, Person, Transaction } from '../types';
import {
  MODE_ICONS,
  MODE_LABELS,
  TXN_STATUS_LABELS,
  formatDateTime,
  formatINR,
  formatSignedINR,
  nowLocal,
  pillClassForTxnStatus,
} from '../utils';
import {
  ReturnModal,
  TransactionModal,
  type TxnPrefill,
} from '../components/Modals';

export function MoneyFlow() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { openDrawer } = useDrawer();

  const pendingOnly = searchParams.get('filter') === 'pending';

  // One-tap return on an open leg.
  const [returnTxn, setReturnTxn] = useState<Transaction | null>(null);

  // Plain record-money flow.
  const [showTxn, setShowTxn] = useState(false);
  const [txnPrefill, setTxnPrefill] = useState<TxnPrefill | undefined>();

  // Edit flow: reuse the transaction modal in edit mode.
  const [editTxn, setEditTxn] = useState<Transaction | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.listTransactions(),
      api.listApplications(),
      api.listPeople(),
    ])
      .then(([t, a, p]) => {
        setTxns(t);
        setApps(a);
        setPeople(p);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Failed to load transactions.'),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, []);

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
    (pid: number | null, ipoId?: number) => {
      if (pid == null) return;
      openDrawer({ personId: pid, ipoId });
    },
    [openDrawer],
  );

  const isOpen = useCallback(
    (t: Transaction) =>
      (t.outstanding ?? 0) > 0 && !t.settled && t.returnOfId == null,
    [],
  );

  const rows = useMemo(() => {
    const sorted = [...txns].sort((a, b) => b.date.localeCompare(a.date));
    return pendingOnly ? sorted.filter(isOpen) : sorted;
  }, [txns, pendingOnly, isOpen]);

  const pendingCount = useMemo(() => txns.filter(isOpen).length, [txns, isOpen]);

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

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Money Flow</h1>
          <p className="sub">
            Every rupee, sender → receiver.{' '}
            {pendingCount > 0 && (
              <span className="pill pill-amber" style={{ marginLeft: 6 }}>
                {pendingCount} open leg{pendingCount !== 1 && 's'}
              </span>
            )}
          </p>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            setTxnPrefill({ date: nowLocal() });
            setShowTxn(true);
          }}
        >
          + Record Movement
        </button>
      </div>

      <div className="toolbar">
        <label className="toggle">
          <input
            type="checkbox"
            checked={pendingOnly}
            onChange={(e) =>
              setSearchParams(e.target.checked ? { filter: 'pending' } : {})
            }
          />
          Open legs only
        </label>
      </div>

      {loading && <div className="loading">Loading…</div>}
      {error && <div className="error-box">{error}</div>}

      {!loading && !error && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>From → To</th>
                  <th>IPO</th>
                  <th className="num">Amount</th>
                  <th className="num">Outstanding</th>
                  <th>Mode</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className={t.struck ? 'struck-row' : ''}>
                    <td>
                      <button
                        className="party-link"
                        onClick={() => openPerson(t.senderId, t.ipoId)}
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
                        onClick={() => openPerson(t.receiverId, t.ipoId)}
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
                    <td>{t.ipoName ?? `IPO #${t.ipoId}`}</td>
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
                      {t.status === 'SETTLED_SOLD' && t.profitLoss != null && (
                        <div
                          className="sub"
                          style={{
                            color:
                              t.profitLoss >= 0 ? 'var(--green)' : 'var(--red)',
                            fontWeight: 600,
                          }}
                        >
                          P&L {formatSignedINR(t.profitLoss)}
                        </div>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {isOpen(t) && (
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
                          title="Edit this movement"
                          onClick={() => setEditTxn(t)}
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="empty">
                      {pendingOnly
                        ? '🎉 Nothing open — every leg has been returned.'
                        : 'No movements recorded yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
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
    </div>
  );
}
