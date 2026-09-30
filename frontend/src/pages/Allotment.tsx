import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import type {
  AllotmentCheckResult,
  AllotmentOutcome,
  Application,
  AppStatus,
  Ipo,
  IpoInput,
  RegistrarIpo,
} from '../types';
import { pillClassForAppStatus } from '../utils';
import { Field, Modal } from '../components/Modal';

interface RegistrarInfo {
  value: string;
  label: string;
  auto: boolean;
  url: string;
}

const REGISTRARS: RegistrarInfo[] = [
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

function registrarOf(ipo: Ipo): RegistrarInfo | undefined {
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

function outcomePill(outcome: AllotmentOutcome): string {
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

function outcomeLabel(r: AllotmentCheckResult): string {
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

function RegistrarModal({
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

/* ---------------- Main page ---------------- */

export function Allotment() {
  const [ipos, setIpos] = useState<Ipo[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [results, setResults] = useState<
    Record<number, AllotmentCheckResult>
  >({});
  const [checking, setChecking] = useState<Record<number, boolean>>({});
  const [checkingAll, setCheckingAll] = useState<number | null>(null);
  const [registrarFor, setRegistrarFor] = useState<Ipo | null>(null);

  useEffect(() => {
    Promise.all([api.listIpos(), api.listApplications()])
      .then(([ipoList, appList]) => {
        setIpos(ipoList);
        setApplications(appList);
        // Expand the first IPO with applications by default.
        const withApps = ipoList.find((i) =>
          appList.some((a) => a.ipoId === i.id),
        );
        if (withApps) setExpanded({ [withApps.id]: true });
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Failed to load.'),
      )
      .finally(() => setLoading(false));
  }, []);

  const iposWithApps = useMemo(
    () =>
      ipos
        .filter((i) => applications.some((a) => a.ipoId === i.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [ipos, applications],
  );

  const appsFor = (ipoId: number) =>
    applications
      .filter((a) => a.ipoId === ipoId)
      .sort((a, b) => (a.personName ?? '').localeCompare(b.personName ?? ''));

  const markChecking = (id: number, on: boolean) =>
    setChecking((m) => {
      const next = { ...m };
      if (on) next[id] = true;
      else delete next[id];
      return next;
    });

  const applyOutcome = (app: Application, r: AllotmentCheckResult) => {
    setResults((m) => ({ ...m, [app.id]: r }));
    if (r.outcome === 'ALLOTTED' || r.outcome === 'NOT_ALLOTTED') {
      const status = r.outcome as AppStatus;
      setApplications((list) =>
        list.map((a) =>
          a.id === app.id
            ? { ...a, status, allottedBy: 'Auto-check' }
            : a,
        ),
      );
    }
  };

  const checkOne = async (app: Application) => {
    if (checking[app.id]) return;
    markChecking(app.id, true);
    try {
      const r = await api.checkAllotment(app.id);
      applyOutcome(app, r);
    } catch {
      applyOutcome(app, {
        applicationId: app.id,
        outcome: 'ERROR',
        message: 'Request failed — try again.',
      });
    } finally {
      markChecking(app.id, false);
    }
  };

  /** Checks every application of the IPO one after another. */
  const checkAll = async (ipo: Ipo) => {
    if (checkingAll !== null) return;
    setCheckingAll(ipo.id);
    try {
      for (const app of appsFor(ipo.id)) {
        markChecking(app.id, true);
        try {
          const r = await api.checkAllotment(app.id);
          applyOutcome(app, r);
        } catch {
          applyOutcome(app, {
            applicationId: app.id,
            outcome: 'ERROR',
            message: 'Request failed — try again.',
          });
        } finally {
          markChecking(app.id, false);
        }
        // Be gentle with the registrar between lookups.
        await new Promise((res) => setTimeout(res, 1200));
      }
    } finally {
      setCheckingAll(null);
    }
  };

  /** Manual fallback: record the outcome yourself after checking the site. */
  const markManual = async (app: Application, status: AppStatus) => {
    try {
      await api.updateApplicationStatus(app.id, status);
      setApplications((list) =>
        list.map((a) =>
          a.id === app.id ? { ...a, status, allottedBy: 'You' } : a,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed.');
    }
  };

  const toggle = (id: number) =>
    setExpanded((m) => ({ ...m, [id]: !m[id] }));

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Allotment Check</h1>
          <p className="sub">
            Live allotment lookup against the registrar, one person at a
            time. Results are saved back to the application.
          </p>
        </div>
      </div>

      {loading && <div className="loading">Loading…</div>}
      {error && <div className="error-box">{error}</div>}

      {!loading && !error && iposWithApps.length === 0 && (
        <div className="card">
          <p className="muted">
            No IPO applications yet — add people to an IPO first, then come
            back here to check allotment.
          </p>
        </div>
      )}

      {!loading &&
        iposWithApps.map((ipo) => {
          const info = registrarOf(ipo);
          const auto = info?.auto ?? false;
          const apps = appsFor(ipo.id);
          const isOpen = !!expanded[ipo.id];
          const busy = checkingAll === ipo.id;
          return (
            <div key={ipo.id} className="card" style={{ marginBottom: 14 }}>
              <div
                className="allot-ipo-head"
                role="button"
                tabIndex={0}
                onClick={() => toggle(ipo.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') toggle(ipo.id);
                }}
              >
                <div>
                  <strong>{ipo.name}</strong>
                  <div className="muted">
                    {apps.length} application{apps.length === 1 ? '' : 's'}
                    {' · '}
                    {info ? (
                      <span className={auto ? 'pill pill-green' : 'pill pill-blue'}>
                        {info.label}
                      </span>
                    ) : (
                      <span className="pill pill-amber">
                        Registrar not set
                      </span>
                    )}
                  </div>
                </div>
                <span className="muted">{isOpen ? '▾' : '▸'}</span>
              </div>

              {isOpen && (
                <div style={{ marginTop: 12 }}>
                  <div className="toolbar" style={{ marginBottom: 10 }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setRegistrarFor(ipo)}
                    >
                      {info ? 'Change registrar' : 'Set registrar'}
                    </button>
                    {auto && (
                      <button
                        className="btn btn-primary"
                        disabled={busy}
                        onClick={() => checkAll(ipo)}
                      >
                        {busy ? 'Checking…' : '✓ Check all'}
                      </button>
                    )}
                    {!auto && info && (
                      <a
                        className="btn btn-secondary"
                        href={info.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Open {info.label} ↗
                      </a>
                    )}
                  </div>

                  {!info && (
                    <p className="muted">
                      Set this IPO&apos;s registrar first — automatic
                      checks work with KFintech and MUFG Intime.
                    </p>
                  )}

                  {apps.map((app) => {
                    const r = results[app.id];
                    const isChecking = !!checking[app.id];
                    return (
                      <div key={app.id} className="allot-row">
                        <div className="allot-who">
                          <strong>{app.personName ?? '—'}</strong>
                          <span
                            className={pillClassForAppStatus(app.status)}
                            style={{ marginLeft: 8 }}
                          >
                            {app.status === 'ALLOTTED'
                              ? 'Allotted'
                              : app.status === 'NOT_ALLOTTED'
                                ? 'Not allotted'
                                : app.status === 'REFUNDED'
                                  ? 'Refunded'
                                  : 'Applied'}
                          </span>
                        </div>

                        <div className="allot-result">
                          {isChecking && (
                            <span className="muted">Checking…</span>
                          )}
                          {!isChecking && r && (
                            <span
                              className={outcomePill(r.outcome)}
                              title={r.message ?? undefined}
                            >
                              {outcomeLabel(r)}
                            </span>
                          )}
                          {!isChecking && !r && (
                            <span className="muted">Not checked yet</span>
                          )}
                        </div>

                        <div className="allot-actions">
                          {auto ? (
                            <button
                              className="btn btn-secondary"
                              disabled={isChecking || busy}
                              onClick={() => checkOne(app)}
                            >
                              {isChecking ? '…' : 'Check'}
                            </button>
                          ) : (
                            info && (
                              <>
                                <a
                                  className="btn btn-secondary"
                                  href={info.url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Check on {info.label} ↗
                                </a>
                                <button
                                  className="btn btn-secondary"
                                  onClick={() => markManual(app, 'ALLOTTED')}
                                >
                                  Got it
                                </button>
                                <button
                                  className="btn btn-secondary"
                                  onClick={() => markManual(app, 'NOT_ALLOTTED')}
                                >
                                  Missed
                                </button>
                              </>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

      {registrarFor && (
        <RegistrarModal
          ipo={registrarFor}
          onClose={() => setRegistrarFor(null)}
          onSaved={(updated) =>
            setIpos((list) =>
              list.map((i) => (i.id === updated.id ? updated : i)),
            )
          }
        />
      )}
    </div>
  );
}
