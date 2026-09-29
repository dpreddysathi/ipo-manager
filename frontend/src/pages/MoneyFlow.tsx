import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useDrawer } from '../drawer';
import type { Person, SettleInput, Transaction } from '../types';
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
  SettleChoiceModal,
  TransactionModal,
  type TxnPrefill,
} from '../components/Modals';

export function MoneyFlow() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { openDrawer } = useDrawer();

  const pendingOnly = searchParams.get('filter') === 'pending';

  // Send-back flow: prefilled SENT txn + settle the original on save.
  const [sendBack, setSendBack] = useState<{
    prefill: TxnPrefill;
    settleId: number;
  } | null>(null);

  // "Mark settled" choice: refund (unallocated) vs sold (profit/loss).
  const [settleChoice, setSettleChoice] = useState<Transaction | null>(null);

  // Edit flow: reuse the transaction modal in edit mode.
  const [editTxn, setEditTxn] = useState<Transaction | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.listTransactions(), api.listPeople()])
      .then(([t, p]) => {
        setTxns(t);
        setPeople(p);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Failed to load transactions.'),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, []);

  const personName = useCallback(
    (t: Transaction) =>
      t.personName ??
      people.find((p) => p.id === t.personId)?.name ??
      `Person #${t.personId}`,
    [people],
  );

  /** "Who sent whom": sender → receiver for a transaction. */
  const route = useCallback(
    (t: Transaction) => {
      const from =
        t.sender?.trim() ||
        (t.direction === 'RECEIVED' ? personName(t) : 'Me');
      const to =
        t.receiver?.trim() ||
        (t.direction === 'RECEIVED' ? 'Me' : personName(t));
      return { from, to };
    },
    [personName],
  );

  const rows = useMemo(() => {
    const sorted = [...txns].sort((a, b) => b.date.localeCompare(a.date));
    return pendingOnly
      ? sorted.filter((t) => t.direction === 'RECEIVED' && !t.settled)
      : sorted;
  }, [txns, pendingOnly]);

  const pendingCount = useMemo(
    () => txns.filter((t) => t.direction === 'RECEIVED' && !t.settled).length,
    [txns],
  );

  const openSendBack = (t: Transaction) => {
    setSendBack({
      prefill: {
        personId: t.personId,
        ipoId: t.ipoId,
        direction: 'SENT',
        amount: t.amount,
        mode: 'UPI',
        date: nowLocal(),
        notes: `Sent back (settles txn #${t.id})`,
      },
      settleId: t.id,
    });
  };

  /** Mark a transaction settled — the choice modal decides whether it
   *  was a refund (unallocated) or a post-allocation sale (profit/loss). */
  const markSettled = async (id: number, input: SettleInput) => {
    try {
      await api.settleTransaction(id, input);
      setSettleChoice(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not mark settled.');
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Money Flow</h1>
          <p className="sub">
            Every rupee in and out.{' '}
            {pendingCount > 0 && (
              <span className="pill pill-amber" style={{ marginLeft: 6 }}>
                {pendingCount} pending settlement{pendingCount !== 1 && 's'}
              </span>
            )}
          </p>
        </div>
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
          Pending settlements only
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
                  <th>Person</th>
                  <th>From → To</th>
                  <th>IPO</th>
                  <th>Direction</th>
                  <th className="num">Amount</th>
                  <th>Mode</th>
                  <th>Date</th>
                  <th>Settlement</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <button
                        className="person-link"
                        onClick={() =>
                          openDrawer({ personId: t.personId, ipoId: t.ipoId })
                        }
                      >
                        {personName(t)}
                      </button>
                    </td>
                    <td>
                      {(() => {
                        const r = route(t);
                        return (
                          <span className="route">
                            <span className="route-from">{r.from}</span>
                            <span className="route-arrow"> → </span>
                            <span className="route-to">{r.to}</span>
                          </span>
                        );
                      })()}
                    </td>
                    <td>{t.ipoName ?? `IPO #${t.ipoId}`}</td>
                    <td>
                      <span
                        className={
                          t.direction === 'RECEIVED'
                            ? 'pill pill-green'
                            : 'pill pill-blue'
                        }
                      >
                        {t.direction === 'RECEIVED' ? '↓ Received' : '↑ Sent'}
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
                    <td>
                      {t.direction === 'RECEIVED' && !t.settled && (
                        <>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => openSendBack(t)}
                          >
                            Send Back
                          </button>{' '}
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Mark settled: refund (unallocated) or sold (profit/loss)"
                            onClick={() => setSettleChoice(t)}
                          >
                            Mark settled
                          </button>{' '}
                        </>
                      )}
                      <button
                        className="btn btn-secondary btn-sm"
                        title="Edit this transaction"
                        onClick={() => setEditTxn(t)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="empty">
                      {pendingOnly
                        ? '🎉 Nothing pending — every received amount has been settled.'
                        : 'No transactions recorded yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {settleChoice && (
        <SettleChoiceModal
          txnLabel={`${formatINR(settleChoice.amount)} · ${personName(settleChoice)}`}
          onClose={() => setSettleChoice(null)}
          onChoose={(input) => void markSettled(settleChoice.id, input)}
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

      {sendBack && (
        <TransactionModal
          title={`Send Back — ${formatINR(sendBack.prefill.amount ?? 0)}`}
          prefill={sendBack.prefill}
          settleOriginalId={sendBack.settleId}
          onClose={() => setSendBack(null)}
          onSaved={() => {
            setSendBack(null);
            load();
          }}
        />
      )}
    </div>
  );
}
