import React, { useEffect, useState } from 'react';
import { api } from '../api';
import type {
  ApplicationInput,
  Ipo,
  IpoInput,
  IpoStatus,
  Person,
  PersonInput,
  Transaction,
  TransactionInput,
  TxnDirection,
  TxnMode,
  TxnStatus,
} from '../types';
import { TXN_STATUS_LABELS, nowLocal, todayISO } from '../utils';
import { Field, Modal } from './Modal';

function usePeopleAndIpos() {
  const [people, setPeople] = useState<Person[]>([]);
  const [ipos, setIpos] = useState<Ipo[]>([]);
  useEffect(() => {
    api.listPeople().then(setPeople).catch(() => {});
    api.listIpos().then(setIpos).catch(() => {});
  }, []);
  return { people, ipos };
}

function SubmitBar({
  onClose,
  saving,
  label,
}: {
  onClose: () => void;
  saving: boolean;
  label: string;
}) {
  return (
    <div className="form-actions">
      <button className="btn btn-secondary" onClick={onClose} type="button">
        Cancel
      </button>
      <button className="btn btn-primary" type="submit" disabled={saving}>
        {saving ? 'Saving…' : label}
      </button>
    </div>
  );
}

/* ---------------- Add / Edit IPO ---------------- */

export function IpoModal({
  onClose,
  onSaved,
  initial,
}: {
  onClose: () => void;
  onSaved: () => void;
  initial?: Ipo;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [status, setStatus] = useState<IpoStatus>(initial?.status ?? 'UPCOMING');
  const [openDate, setOpenDate] = useState(initial?.openDate ?? '');
  const [closeDate, setCloseDate] = useState(initial?.closeDate ?? '');
  const [price, setPrice] = useState(initial?.price?.toString() ?? '');
  const [lotSize, setLotSize] = useState(initial?.lotSize?.toString() ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('IPO name is required.');
      return;
    }
    setSaving(true);
    setError('');
    const data: IpoInput = {
      name: name.trim(),
      status,
      openDate: openDate || undefined,
      closeDate: closeDate || undefined,
      price: price ? Number(price) : undefined,
      lotSize: lotSize ? Number(lotSize) : undefined,
    };
    try {
      if (initial) await api.updateIpo(initial.id, data);
      else await api.createIpo(data);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={initial ? 'Edit IPO' : 'Add IPO'} onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'contents' }}>
        {error && <div className="form-error">{error}</div>}
        <Field label="IPO / Company name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Tata Capital"
            autoFocus
          />
        </Field>
        <Field label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as IpoStatus)}
          >
            <option value="UPCOMING">Upcoming</option>
            <option value="OPEN">Open</option>
            <option value="CLOSED">Closed</option>
            <option value="LISTED">Listed</option>
          </select>
        </Field>
        <div className="field-row">
          <Field label="Open date">
            <input
              type="date"
              value={openDate}
              onChange={(e) => setOpenDate(e.target.value)}
            />
          </Field>
          <Field label="Close date">
            <input
              type="date"
              value={closeDate}
              onChange={(e) => setCloseDate(e.target.value)}
            />
          </Field>
        </div>
        <div className="field-row">
          <Field label="Price per share (₹)">
            <input
              type="number"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 320"
            />
          </Field>
          <Field label="Lot size (shares)">
            <input
              type="number"
              min="0"
              value={lotSize}
              onChange={(e) => setLotSize(e.target.value)}
              placeholder="e.g. 45"
            />
          </Field>
        </div>
        <SubmitBar
          onClose={onClose}
          saving={saving}
          label={initial ? 'Save changes' : 'Add IPO'}
        />
      </form>
    </Modal>
  );
}

/* ---------------- Add Person ---------------- */

export function PersonModal({
  onClose,
  onSaved,
  initial,
}: {
  onClose: () => void;
  onSaved: () => void;
  /** When set, edits this person instead of creating a new one. */
  initial?: Person;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError('');
    const data: PersonInput = {
      name: name.trim(),
      phone: phone.trim(),
      notes: notes.trim() || undefined,
    };
    try {
      if (initial) {
        await api.updatePerson(initial.id, data);
      } else {
        await api.createPerson(data);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={initial ? 'Edit Person' : 'Add Person'} onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'contents' }}>
        {error && <div className="form-error">{error}</div>}
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Rahul Sharma"
            autoFocus
          />
        </Field>
        <Field label="Phone">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 98765 43210"
          />
        </Field>
        <Field label="Notes (optional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Relationship, remarks…"
          />
        </Field>
        <SubmitBar
          onClose={onClose}
          saving={saving}
          label={initial ? 'Save Changes' : 'Add Person'}
        />
      </form>
    </Modal>
  );
}

/* ---------------- Record Transaction ---------------- */

export interface TxnPrefill extends Partial<TransactionInput> {}

/** ISO datetime → "yyyy-MM-ddTHH:mm" for <input type="datetime-local">. */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return nowLocal();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return nowLocal();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours(),
  )}:${p(d.getMinutes())}`;
}

export function TransactionModal({
  onClose,
  onSaved,
  prefill,
  settleOriginalId,
  title,
  editTxn,
}: {
  onClose: () => void;
  onSaved: () => void;
  prefill?: TxnPrefill;
  /**
   * When set, PATCH /api/transactions/{settleOriginalId}/settle is called
   * after the new SENT txn is created (spec §4.5 settlement workflow).
   */
  settleOriginalId?: number;
  title?: string;
  /** When set, the modal edits this transaction instead of creating one. */
  editTxn?: Transaction;
}) {
  const { people, ipos } = usePeopleAndIpos();
  const [personId, setPersonId] = useState(
    editTxn?.personId?.toString() ?? prefill?.personId?.toString() ?? '',
  );
  const [ipoId, setIpoId] = useState(
    editTxn?.ipoId?.toString() ?? prefill?.ipoId?.toString() ?? '',
  );
  const [direction, setDirection] = useState<TxnDirection>(
    editTxn?.direction ?? prefill?.direction ?? 'RECEIVED',
  );
  const [amount, setAmount] = useState(
    editTxn?.amount?.toString() ?? prefill?.amount?.toString() ?? '',
  );
  const [mode, setMode] = useState<TxnMode>(editTxn?.mode ?? prefill?.mode ?? 'UPI');
  const [date, setDate] = useState(
    editTxn ? toLocalInput(editTxn.date) : (prefill?.date ?? nowLocal()),
  );
  const [notes, setNotes] = useState(editTxn?.notes ?? prefill?.notes ?? '');
  const [from, setFrom] = useState(editTxn?.sender ?? prefill?.sender ?? '');
  const [to, setTo] = useState(editTxn?.receiver ?? prefill?.receiver ?? '');
  const [status, setStatus] = useState<TxnStatus>(
    editTxn?.status ?? prefill?.status ?? 'SENT',
  );
  const [profitLoss, setProfitLoss] = useState(
    editTxn?.profitLoss != null ? String(editTxn.profitLoss) : '',
  );
  // Tracks whether the user typed their own From/To, so auto-defaults
  // don't clobber manual entries when person/direction changes.
  const fromTouched = React.useRef(!!(editTxn?.sender ?? prefill?.sender));
  const toTouched = React.useRef(!!(editTxn?.receiver ?? prefill?.receiver));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  /** Previously used parties (people names + your accounts/pools),
   *  remembered locally for quick picking. */
  const [partyHints] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('ipo-manager-parties');
      const arr = raw ? (JSON.parse(raw) as unknown) : [];
      const remembered = Array.isArray(arr)
        ? arr.filter((x) => typeof x === 'string')
        : [];
      const seeds = ['HDFC pool', 'Cash'];
      return [...seeds, ...remembered.filter((x) => !seeds.includes(x))];
    } catch {
      return ['HDFC pool', 'Cash'];
    }
  });

  /** Smart defaults: RECEIVED comes from the person, goes to your account;
   *  SENT comes from your account, goes to the person. */
  React.useEffect(() => {
    const person = people.find((x) => String(x.id) === personId);
    if (direction === 'RECEIVED' && !fromTouched.current) {
      setFrom(person?.name ?? '');
    }
    if (direction === 'SENT' && !toTouched.current) {
      setTo(person?.name ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId, direction, people]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personId || !ipoId || !amount || Number(amount) <= 0) {
      setError('Person, IPO and a positive amount are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const trimmedFrom = from.trim();
      const trimmedTo = to.trim();
      const payload: TransactionInput = {
        personId: Number(personId),
        ipoId: Number(ipoId),
        direction,
        amount: Number(amount),
        mode,
        date,
        notes: notes.trim() || undefined,
        sender: trimmedFrom || undefined,
        receiver: trimmedTo || undefined,
        status,
        profitLoss:
          status === 'SETTLED_SOLD' && profitLoss !== ''
            ? Number(profitLoss)
            : undefined,
      };
      if (editTxn) {
        await api.updateTransaction(editTxn.id, payload);
      } else {
        await api.createTransaction(payload);
      }
      // Remember both ends for next time's suggestions.
      for (const party of [trimmedFrom, trimmedTo]) {
        if (!party) continue;
        try {
          const raw = localStorage.getItem('ipo-manager-parties');
          const arr: string[] = raw ? (JSON.parse(raw) as string[]) : [];
          const next = [party, ...arr.filter((x) => x !== party)].slice(0, 16);
          localStorage.setItem('ipo-manager-parties', JSON.stringify(next));
        } catch {
          /* suggestions are best-effort */
        }
      }
      // Settlement workflow: the money was sent back, so mark the
      // original RECEIVED transaction as settled (spec §4.5).
      if (settleOriginalId) {
        await api.settleTransaction(settleOriginalId);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={title ?? (editTxn ? 'Edit Transaction' : 'Record Transaction')}
      onClose={onClose}
    >
      <form onSubmit={submit} style={{ display: 'contents' }}>
        {error && <div className="form-error">{error}</div>}
        {error && <div className="form-error">{error}</div>}
        <Field label="Direction">
          <div className="seg">
            <button
              type="button"
              className={direction === 'RECEIVED' ? 'on' : ''}
              onClick={() => setDirection('RECEIVED')}
            >
              ↓ Received
            </button>
            <button
              type="button"
              className={direction === 'SENT' ? 'on' : ''}
              onClick={() => setDirection('SENT')}
            >
              ↑ Sent back
            </button>
          </div>
        </Field>
        <div className="field-row">
          <Field label="Person">
            <select
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
            >
              <option value="">Select…</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="IPO">
            <select value={ipoId} onChange={(e) => setIpoId(e.target.value)}>
              <option value="">Select…</option>
              {ipos.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="field-row">
          <Field label="Amount (₹)">
            <input
              type="number"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 15000"
              autoFocus
            />
          </Field>
          <Field label="Date & time">
            <input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Mode">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as TxnMode)}
          >
            <option value="UPI">UPI</option>
            <option value="GPAY">GPay</option>
            <option value="CASH">Cash</option>
            <option value="BANK">Bank transfer</option>
            <option value="SELF">Self (own money)</option>
          </select>
        </Field>
        <div className="field-row">
          <Field label="From">
            <input
              list="txn-party-hints"
              value={from}
              onChange={(e) => {
                fromTouched.current = true;
                setFrom(e.target.value);
              }}
              placeholder={
                direction === 'RECEIVED'
                  ? 'Who sent it? (defaults to person)'
                  : 'Which account sent it? e.g. HDFC pool'
              }
            />
          </Field>
          <Field label="To">
            <input
              list="txn-party-hints"
              value={to}
              onChange={(e) => {
                toTouched.current = true;
                setTo(e.target.value);
              }}
              placeholder={
                direction === 'SENT'
                  ? 'Who received it? (defaults to person)'
                  : 'Which account received it? e.g. HDFC pool'
              }
            />
          </Field>
        </div>
        <datalist id="txn-party-hints">
          {people.map((x) => (
            <option key={`p-${x.id}`} value={x.name} />
          ))}
          {partyHints.map((x) => (
            <option key={`h-${x}`} value={x} />
          ))}
        </datalist>
        <div className="field-row">
          <Field label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TxnStatus)}
            >
              {(Object.keys(TXN_STATUS_LABELS) as TxnStatus[]).map((s) => (
                <option key={s} value={s}>
                  {TXN_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
          {status === 'SETTLED_SOLD' && (
            <Field label="Profit / Loss vs sent (₹)">
              <input
                type="number"
                value={profitLoss}
                onChange={(e) => setProfitLoss(e.target.value)}
                placeholder="e.g. 2500 or -800"
              />
            </Field>
          )}
        </div>
        <Field label="Notes (optional)">
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. refund from exchange"
          />
        </Field>
        <SubmitBar
          onClose={onClose}
          saving={saving}
          label={editTxn ? 'Save Changes' : 'Save Transaction'}
        />
      </form>
    </Modal>
  );
}

/* ---------------- Settle Choice ---------------- */

/**
 * Asks which kind of settlement closed the money loop: a refund after
 * non-allocation, or a post-allocation sale with profit/loss noted.
 */
export function SettleChoiceModal({
  txnLabel,
  onClose,
  onChoose,
}: {
  txnLabel: string;
  onClose: () => void;
  onChoose: (input: { type: 'UNALLOCATED' | 'SOLD'; profitLoss?: number }) => void;
}) {
  const [kind, setKind] = useState<'UNALLOCATED' | 'SOLD'>('UNALLOCATED');
  const [profitLoss, setProfitLoss] = useState('');

  return (
    <Modal title={`Mark settled — ${txnLabel}`} onClose={onClose}>
      <div style={{ display: 'grid', gap: 12 }}>
        <label className="radio-card">
          <input
            type="radio"
            checked={kind === 'UNALLOCATED'}
            onChange={() => setKind('UNALLOCATED')}
          />
          <span>
            <span className="strong">Refund — unallocated</span>
            <br />
            <span className="sub">
              The IPO didn't allot; the money came back.
            </span>
          </span>
        </label>
        <label className="radio-card">
          <input
            type="radio"
            checked={kind === 'SOLD'}
            onChange={() => setKind('SOLD')}
          />
          <span>
            <span className="strong">Sold — after allocation</span>
            <br />
            <span className="sub">
              Allotted shares were sold; note the profit/loss vs what was
              sent.
            </span>
          </span>
        </label>
        {kind === 'SOLD' && (
          <Field label="Profit / Loss vs sent (₹)">
            <input
              type="number"
              value={profitLoss}
              onChange={(e) => setProfitLoss(e.target.value)}
              placeholder="e.g. 2500 or -800"
              autoFocus
            />
          </Field>
        )}
        <div className="form-actions">
          <button className="btn btn-secondary" onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() =>
              onChoose({
                type: kind,
                profitLoss:
                  kind === 'SOLD' && profitLoss !== ''
                    ? Number(profitLoss)
                    : undefined,
              })
            }
          >
            Mark settled
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- Add Application ---------------- */

export function ApplicationModal({
  onClose,
  onSaved,
  prefill,
}: {
  onClose: () => void;
  onSaved: () => void;
  prefill?: Partial<ApplicationInput>;
}) {
  const { people, ipos } = usePeopleAndIpos();
  const [personId, setPersonId] = useState(prefill?.personId?.toString() ?? '');
  const [ipoId, setIpoId] = useState(prefill?.ipoId?.toString() ?? '');
  const [amount, setAmount] = useState(prefill?.amount?.toString() ?? '');
  const [appliedDate, setAppliedDate] = useState(
    prefill?.appliedDate ?? todayISO(),
  );
  const [remarks, setRemarks] = useState(prefill?.remarks ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personId || !ipoId || !amount || Number(amount) <= 0) {
      setError('Person, IPO and a positive amount are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      // Status starts as APPLIED; allottedBy/allottedAt are set by the
      // backend when the status changes (spec §3.2) — never asked here.
      await api.createApplication({
        personId: Number(personId),
        ipoId: Number(ipoId),
        amount: Number(amount),
        appliedDate,
        remarks: remarks.trim() || undefined,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Add Application" onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'contents' }}>
        {error && <div className="form-error">{error}</div>}
        <div className="field-row">
          <Field label="Person">
            <select
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
            >
              <option value="">Select…</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="IPO">
            <select value={ipoId} onChange={(e) => setIpoId(e.target.value)}>
              <option value="">Select…</option>
              {ipos.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="field-row">
          <Field label="Applied amount (₹)">
            <input
              type="number"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 15000"
              autoFocus
            />
          </Field>
          <Field label="Applied date">
            <input
              type="date"
              value={appliedDate}
              onChange={(e) => setAppliedDate(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Remarks (optional)">
          <input
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="e.g. 1 lot via Zerodha"
          />
        </Field>
        <SubmitBar onClose={onClose} saving={saving} label="Add Application" />
      </form>
    </Modal>
  );
}

/* ---------------- Record Sale (profit/loss) ---------------- */

export function SaleModal({
  application,
  onClose,
  onSaved,
}: {
  application: { id: number; personName?: string; ipoName?: string; profitLoss?: number | null };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [profitLoss, setProfitLoss] = useState(
    application.profitLoss != null ? String(application.profitLoss) : '',
  );
  const [soldAt, setSoldAt] = useState(nowLocal());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profitLoss.trim() === '' || Number.isNaN(Number(profitLoss))) {
      setError('Enter the realized profit or loss (negative for a loss).');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.recordSale(application.id, {
        profitLoss: Number(profitLoss),
        soldAt,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Record sale — ${application.personName ?? '…'} · ${application.ipoName ?? ''}`}
      onClose={onClose}
    >
      <form onSubmit={submit} style={{ display: 'contents' }}>
        {error && <div className="form-error">{error}</div>}
        <div className="field-row">
          <Field label="Profit / loss (₹)">
            <input
              type="number"
              value={profitLoss}
              onChange={(e) => setProfitLoss(e.target.value)}
              placeholder="e.g. 3200 or -1200"
              autoFocus
            />
          </Field>
          <Field label="Sold on">
            <input
              type="datetime-local"
              value={soldAt}
              onChange={(e) => setSoldAt(e.target.value)}
            />
          </Field>
        </div>
        <div className="hint">
          Positive = profit, negative = loss. This feeds the dashboard&apos;s
          P&amp;L and the period reports.
        </div>
        <SubmitBar onClose={onClose} saving={saving} label="Save Sale" />
      </form>
    </Modal>
  );
}
