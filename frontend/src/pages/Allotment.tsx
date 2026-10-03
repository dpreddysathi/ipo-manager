import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type {
  AllotmentCheckResult,
  AllotmentOutcome,
  Application,
  AppStatus,
  Ipo,
  IpoInput,
  Person,
  RegistrarDetection,
  RegistrarIpo,
} from '../types';
import {
  formatDate,
  pillClassForAppStatus,
  pillClassForIpoStatus,
} from '../utils';
import { Field, Modal } from '../components/Modal';

export interface RegistrarInfo {
  value: string;
  label: string;
  auto: boolean;
  url: string;
}

export const REGISTRARS: RegistrarInfo[] = [
  {
    value: 'KFINTECH',
    label: 'KFintech',
    auto: true,
    url: 'https://ipostatus.kfintech.com/',
  },
  {
    value: 'MUFG',
    label: 'MUFG Intime (Link Intime)',
    auto: true,
    url: 'https://in.mpms.mufg.com/Initial_Offer/IPO.aspx',
  },
  {
    value: 'BIGSHARE',
    label: 'Bigshare',
    auto: false,
    url: 'https://www.bigshareonline.com/ipo_Allotment.html',
  },
  {
    value: 'BSE',
    label: 'BSE',
    auto: false,
    url: 'https://www.bseindia.com/investors/appli_check.aspx',
  },
  {
    value: 'MANUAL',
    label: 'Other / manual',
    auto: false,
    url: 'https://www.bseindia.com/investors/appli_check.aspx',
  },
];

export function registrarOf(ipo: Ipo): RegistrarInfo | undefined {
  return REGISTRARS.find((r) => r.value === ipo.registrar);
}

function toInput(ipo: Ipo): IpoInput {
  return {
    name: ipo.name,
    status: ipo.status,
    openDate: ipo.openDate ?? undefined,
    closeDate: ipo.closeDate ?? undefined,
    listingDate: ipo.listingDate ?? undefined,
    price: ipo.price ?? undefined,
    lotSize: ipo.lotSize ?? undefined,
    notes: ipo.notes ?? undefined,
    registrar: ipo.registrar ?? undefined,
    registrarRef: ipo.registrarRef ?? undefined,
  };
}

export function outcomePill(outcome: AllotmentOutcome): string {
  switch (outcome) {
    case 'ALLOTTED':
      return 'pill pill-green';
    case 'NOT_ALLOTTED':
      return 'pill pill-red';
    case 'NOT_FOUND':
      return 'pill pill-gray';
    case 'NEED_PAN':
      return 'pill pill-amber';
    case 'MANUAL':
      return 'pill pill-blue';
    case 'ERROR':
    default:
      return 'pill pill-red';
  }
}

export function outcomeLabel(r: AllotmentCheckResult): string {
  switch (r.outcome) {
    case 'ALLOTTED':
      return r.allottedShares != null
        ? `Allotted · ${r.allottedShares} shares`
        : 'Allotted';
    case 'NOT_ALLOTTED':
      return 'Not allotted';
    case 'NOT_FOUND':
      return 'Not found';
    case 'NEED_PAN':
      return 'No PAN on file';
    case 'MANUAL':
      return 'Check manually';
    case 'ERROR':
    default:
      return 'Check failed';
  }
}

/* ---------------- Registrar setup modal ---------------- */

export function RegistrarModal({
  ipo,
  onClose,
  onSaved,
}: {
  ipo: Ipo;
  onClose: () => void;
  onSaved: (updated: Ipo) => void;
}) {
  const [registrar, setRegistrar] = useState(ipo.registrar ?? '');
  const [ref, setRef] = useState(ipo.registrarRef ?? '');
  const [options, setOptions] = useState<RegistrarIpo[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const info = REGISTRARS.find((r) => r.value === registrar);

  useEffect(() => {
    if (!info?.auto) {
      setOptions([]);
      return;
    }
    setLoadingList(true);
    setError('');
    api
      .getRegistrarIpos(info.value)
      .then(setOptions)
      .catch(() =>
        setError('Could not reach the registrar — try again in a bit.'),
      )
      .finally(() => setLoadingList(false));
  }, [registrar]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options.slice(0, 60);
    return options
      .filter((o) => o.name.toLowerCase().includes(q))
      .slice(0, 60);
  }, [options, search]);

  const selectedName = options.find((o) => o.id === ref)?.name;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!registrar) {
      setError('Pick a registrar first.');
      return;
    }
    if (info?.auto && !ref) {
      setError('Pick the matching entry from the registrar list.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const updated = await api.updateIpo(ipo.id, {
        ...toInput(ipo),
        registrar,
        registrarRef: info?.auto ? ref : undefined,
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Registrar — ${ipo.name}`} onClose={onClose}>
      <form onSubmit={save}>
        <Field label="Registrar">
          <select
            value={registrar}
            onChange={(e) => {
              setRegistrar(e.target.value);
              setRef('');
              setSearch('');
            }}
          >
            <option value="">— Select —</option>
            {REGISTRARS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
                {r.auto ? '' : ' (manual check)'}
              </option>
            ))}
          </select>
        </Field>

        {info?.auto && (
          <Field
            label={`Match on ${info.label}'s site`}
            hint="Names differ from yours — pick the registrar's exact entry."
          >
            {loadingList ? (
              <div className="loading">Loading registrar list…</div>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Type to filter…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div className="picker-list">
                  {filtered.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      className={`picker-item${o.id === ref ? ' selected' : ''}`}
                      onClick={() => setRef(o.id)}
                    >
                      {o.name}
                    </button>
                  ))}
                  {filtered.length === 0 && (
                    <div className="muted">No matches.</div>
                  )}
                </div>
                {selectedName && (
                  <div className="muted" style={{ marginTop: 6 }}>
                    Selected: {selectedName}
                  </div>
                )}
              </>
            )}
          </Field>
        )}

        {info && !info.auto && (
          <p className="muted">
            {info.label} needs a captcha, so checks stay manual — the page
            will give you a direct link instead.
          </p>
        )}

        {error && <div className="error-box">{error}</div>}

        <div className="form-actions">
          <button
            className="btn btn-secondary"
            type="button"
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save registrar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------- Main page: IPO cards ---------------- */

export function Allotment() {
  const navigate = useNavigate();
  const [ipos, setIpos] = useState<Ipo[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.listIpos(), api.listApplications()])
      .then(([ipoList, appList]) => {
        // Only IPOs you're actually involved in — with ~200 auto-loaded IPOs
        // on the board, listing every open/closed one here would be noise.
        // And only OPEN + CLOSED: registrars publish allotment after close,
        // so upcoming/listed rows can never return a real result; hidden rows
        // stay off this page entirely.
        const withApps = new Set(appList.map((a) => a.ipoId));
        setIpos(
          ipoList
            .filter(
              (i) =>
                withApps.has(i.id) &&
                !i.boardHidden &&
                (i.status === 'OPEN' || i.status === 'CLOSED'),
            )
            .sort((a, b) =>
              a.status === b.status
                ? a.name.localeCompare(b.name)
                : a.status === 'OPEN'
                  ? -1
                  : 1,
            ),
        );
        setApplications(appList);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Failed to load.'),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Allotment Check</h1>
          <p className="sub">
            Tap an IPO to check allotment for everyone in it.
          </p>
        </div>
      </div>

      {loading && <div className="loading">Loading…</div>}
      {error && <div className="error-box">{error}</div>}

      {!loading && !error && ipos.length === 0 && (
        <div className="card">
          <p className="muted">
            No open or closed IPOs yet — add one first, then come back here
            to check allotment.
          </p>
        </div>
      )}

      {!loading && !error && ipos.length > 0 && (
        <div className="list-grid">
          {ipos.map((ipo) => {
            const savedReg = registrarOf(ipo);
            const appCount = applications.filter(
              (a) => a.ipoId === ipo.id,
            ).length;
            return (
              <div
                key={ipo.id}
                className="card ipo-card"
                onClick={() => navigate(`/allotment/${ipo.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(`/allotment/${ipo.id}`);
                }}
              >
                <div className="card-top">
                  <h3>{ipo.name}</h3>
                  <span className={pillClassForIpoStatus(ipo.status)}>
                    {ipo.status}
                  </span>
                </div>
                <div className="meta">
                  {savedReg ? (
                    <>{savedReg.label} · </>
                  ) : (
                    <>No registrar · </>
                  )}
                  {appCount} application{appCount === 1 ? '' : 's'}
                  {ipo.closeDate && (
                    <> · Closes {formatDate(ipo.closeDate)}</>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
