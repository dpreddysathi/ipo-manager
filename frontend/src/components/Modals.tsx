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
  TxnMode,
} from '../types';
import { formatINR, nowLocal, todayISO } from '../utils';
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

const ME_VALUE = 'me';

function partyLabel(id: string, people: Person[]): string {
  if (id === ME_VALUE) return 'Me (you)';
  return people.find((x) => String(x.id) === id)?.name ?? '…';
}

/**
 * Records one money movement between two parties for an IPO — always
 * person-to-person; either side may be you ("Me").
 */
export function TransactionModal({
  onClose,
  onSaved,
  prefill,
  title,
  editTxn,
}: {
  onClose: () => void;
  onSaved: () => void;
  prefill?: TxnPrefill;
  title?: string;
  /** When set, the modal edits this transaction instead of creating one. */
  editTxn?: Transaction;
}) {
  const { people, ipos } = usePeopleAndIpos();
  const [fromId, setFromId] = useState(
    editTxn
      ? (editTxn.senderId != null ? String(editTxn.senderId) : ME_VALUE)
      : (prefill?.senderId != null ? String(prefill.senderId) : ME_VALUE),
  );
  const [toId, setToId] = useState(
    editTxn
      ? (editTxn.receiverId != null ? String(editTxn.receiverId) : ME_VALUE)
      : (prefill?.receiverId != null ? String(prefill.receiverId) : ''),
  );
  const [ipoId, setIpoId] = useState(
    editTxn?.ipoId?.toString() ?? prefill?.ipoId?.toString() ?? '',
  );
  const [amount, setAmount] = useState(
    editTxn?.amount?.toString() ?? prefill?.amount?.toString() ?? '',
  );
  const [mode, setMode] = useState<TxnMode>(editTxn?.mode ?? prefill?.mode ?? 'UPI');
  const [date, setDate] = useState(
    editTxn ? toLocalInput(editTxn.date) : (prefill?.date ?? nowLocal()),
  );
  const [notes, setNotes] = useState(editTxn?.notes ?? prefill?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ipoId || !amount || Number(amount) <= 0) {
      setError('IPO and a positive amount are required.');
      return;
    }
    if (!fromId || !toId) {
      setError('Pick who sent and who received.');
      return;
    }
    if (fromId === ME_VALUE && toId === ME_VALUE) {
      setError('One side must be a person — pick who the money moved to or from.');
      return;
    }
    if (fromId !== ME_VALUE && fromId === toId) {
      setError('Sender and receiver cannot be the same person.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload: TransactionInput = {
        senderId: fromId === ME_VALUE ? null : Number(fromId),
        receiverId: toId === ME_VALUE ? null : Number(toId),
        ipoId: Number(ipoId),
        amount: Number(amount),
        mode,
        date,
        notes: notes.trim() || undefined,
      };
      if (editTxn) {
        await api.updateTransaction(editTxn.id, payload);
      } else {
        await api.createTransaction(payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const partyOptions = (value: string) => (
    <>
      <option value={ME_VALUE}>Me (you)</option>
      {people.map((per) => (
        <option key={per.id} value={per.id}>
          {per.name}
        </option>
      ))}
    </>
  );

  return (
    <Modal
      title={title ?? (editTxn ? 'Edit Transaction' : 'Record Money Movement')}
      onClose={onClose}
    >
      <form onSubmit={submit} style={{ display: 'contents' }}>
        {error && <div className="form-error">{error}</div>}
        <div className="field-row">
          <Field label="From (sender)">
            <select value={fromId} onChange={(e) => setFromId(e.target.value)}>
              {partyOptions(fromId)}
            </select>
          </Field>
          <Field label="To (receiver)">
            <select value={toId} onChange={(e) => setToId(e.target.value)}>
              <option value="">Select…</option>
              {partyOptions(toId)}
            </select>
          </Field>
        </div>
        {(fromId || toId) && (
          <div className="hint" style={{ marginTop: -4 }}>
            {partyLabel(fromId || ME_VALUE, people)} →{' '}
            {toId ? partyLabel(toId, people) : '…'} — the receiver owes the
            sender until it is returned.
          </div>
        )}
        <div className="field-row">
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
        </div>
        <div className="field-row">
          <Field label="Date & time">
            <input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
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
        </div>
        <Field label="Notes (optional)">
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. application money"
          />
        </Field>
        <SubmitBar
          onClose={onClose}
          saving={saving}
          label={editTxn ? 'Save Changes' : 'Save Movement'}
        />
      </form>
    </Modal>
  );
}

/* ---------------- Record Return ---------------- */

/**
 * One-tap return: records the money moving back to the original sender
 * and settles the original. Non-allotted → the exact amount goes back
 * ("Mark paid"). Allotted → enter the profit/loss; the sender receives
 * amount + P&L.
 */
export function ReturnModal({
  txn,
  allotted,
  onClose,
  onDone,
}: {
  txn: Transaction;
  /** Hint for the allotted toggle, e.g. from the receiver's application. */
  allotted?: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [isAllotted, setIsAllotted] = useState(allotted ?? false);
  const [profitLoss, setProfitLoss] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const pl = profitLoss.trim() === '' || Number.isNaN(Number(profitLoss))
    ? null
    : Number(profitLoss);
  const returnAmount = txn.amount + (isAllotted && pl != null ? pl : 0);

  const confirm = async () => {
    if (isAllotted && pl == null) {
      setError('Enter the profit or loss (0 if none, negative for a loss).');
      return;
    }
    if (returnAmount <= 0) {
      setError('The return amount must be positive — check the profit/loss.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.recordReturn(txn.id, isAllotted ? { profitLoss: pl } : {});
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Record return" onClose={onClose}>
      <div style={{ display: 'grid', gap: 12 }}>
        {error && <div className="form-error">{error}</div>}
        <div className="card" style={{ padding: '12px 14px' }}>
          <div className="strong">
            {txn.receiverName} → {txn.senderName}
          </div>
          <div className="sub">
            {formatINR(txn.amount)} · {txn.ipoName ?? ''} · originally{' '}
            {txn.senderName} → {txn.receiverName}
          </div>
        </div>
        <Field label="Was this application allotted?">
          <div className="seg">
            <button
              type="button"
              className={!isAllotted ? 'on' : ''}
              onClick={() => setIsAllotted(false)}
            >
              Not allotted
            </button>
            <button
              type="button"
              className={isAllotted ? 'on' : ''}
              onClick={() => setIsAllotted(true)}
            >
              Allotted
            </button>
          </div>
        </Field>
        {!isAllotted ? (
          <div className="hint">
            The full {formatINR(txn.amount)} goes back to {txn.senderName} —
            one tap, and the original is struck off.
          </div>
        ) : (
          <>
            <Field label="Profit / loss vs sent (₹)">
              <input
                type="number"
                value={profitLoss}
                onChange={(e) => setProfitLoss(e.target.value)}
                placeholder="e.g. 2500 or -800 (0 if none)"
                autoFocus
              />
            </Field>
            <div className="hint">
              {txn.senderName} receives {formatINR(returnAmount)} (
              {formatINR(txn.amount)} + P&amp;L {pl == null ? '…' : formatINR(pl)}
              ). The P&amp;L is also noted on the application.
            </div>
          </>
        )}
        <div className="form-actions">
          <button className="btn btn-secondary" onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={confirm}
            disabled={saving}
          >
            {saving ? 'Saving…' : isAllotted ? 'Record return' : 'Mark paid'}
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
