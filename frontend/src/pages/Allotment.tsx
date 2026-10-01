import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
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
  const [people, setPeople] = useState<Person[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detection, setDetection] = useState<RegistrarDetection | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [results, setResults] = useState<
    Record<number, AllotmentCheckResult>
  >({});
  const [checking, setChecking] = useState<Record<number, boolean>>({});
  const [checkingAll, setCheckingAll] = useState(false);
  const [registrarFor, setRegistrarFor] = useState<Ipo | null>(null);
  /** Guards against out-of-order detect responses when tapping fast. */
  const selectToken = useRef(0);

  /** Tap an IPO: expand it and work out its registrar automatically. */
  const expandIpo = (ipo: Ipo) => {
    const token = ++selectToken.current;
    setExpandedId(ipo.id);
    setResults({});
    const regVal = ipo.registrar ?? '';
    const already = REGISTRARS.find((r) => r.value === regVal);
    if (already?.auto && ipo.registrarRef && ipo.registrar) {
      setDetecting(false);
      setDetection({
        registrar: ipo.registrar,
        registrarRef: ipo.registrarRef,
        registrarName: null,
        confidence: 1,
        message: 'Already set.',
      });
      return;
    }
    setDetecting(true);
    setDetection(null);
    api
      .detectRegistrar(ipo.id)
      .then((d) => {
        if (selectToken.current !== token) return;
        setDetection(d);
        if (d.registrar && d.registrarRef) {
          setIpos((list) =>
            list.map((i) =>
              i.id === ipo.id
                ? {
                    ...i,
                    registrar: d.registrar,
                    registrarRef: d.registrarRef,
                  }
                : i,
            ),
          );
        }
      })
      .catch(() => {
        if (selectToken.current !== token) return;
        setDetection({
          registrar: null,
          registrarRef: null,
          registrarName: null,
          confidence: 0,
          message: 'Detection failed — set the registrar manually.',
        });
      })
      .finally(() => {
        if (selectToken.current === token) setDetecting(false);
      });
  };

  /** Collapse the open card, or expand a different IPO. */
  const toggleIpo = (ipo: Ipo) => {
    if (ipo.id === expandedId) {
      selectToken.current++;
      setExpandedId(null);
      setDetection(null);
      setDetecting(false);
      setResults({});
      return;
    }
    expandIpo(ipo);
  };

  useEffect(() => {
    Promise.all([
      api.listIpos(),
      api.listPeople(),
      api.listApplications(),
    ])
      .then(([ipoList, personList, appList]) => {
        const open = ipoList
          .filter((i) => i.status === 'OPEN' || i.status === 'CLOSED')
          .sort((a, b) =>
            a.status === b.status
              ? a.name.localeCompare(b.name)
              : a.status === 'OPEN'
                ? -1
                : 1,
          );
        setIpos(open);
        setPeople(
          [...personList].sort((a, b) => a.name.localeCompare(b.name)),
        );
        setApplications(appList);
        if (open.length > 0) expandIpo(open[0]);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Failed to load.'),
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const expanded = useMemo(
    () => ipos.find((i) => i.id === expandedId) ?? null,
    [ipos, expandedId],
  );
  const regValue = detection?.registrar ?? expanded?.registrar ?? null;
  const regInfo = REGISTRARS.find((r) => r.value === regValue);
  const auto = regInfo?.auto ?? false;

  const appFor = (personId: number) =>
    applications.find(
      (a) => a.personId === personId && a.ipoId === expandedId,
    ) ?? null;

  const markChecking = (id: number, on: boolean) =>
    setChecking((m) => {
      const next = { ...m };
      if (on) next[id] = true;
      else delete next[id];
      return next;
    });

  const applyOutcome = (
    person: Person,
    ipoId: number,
    r: AllotmentCheckResult,
  ) => {
    setResults((m) => ({ ...m, [person.id]: r }));
    if (r.outcome === 'ALLOTTED' || r.outcome === 'NOT_ALLOTTED') {
      const status = r.outcome as AppStatus;
      setApplications((list) =>
        list.map((a) =>
          a.personId === person.id && a.ipoId === ipoId
            ? { ...a, status, allottedBy: 'Auto-check' }
            : a,
        ),
      );
    }
  };

  const failedResult = (person: Person): AllotmentCheckResult => ({
    applicationId: null,
    personId: person.id,
    outcome: 'ERROR',
    message: 'Request failed — try again.',
  });

  const checkOne = async (person: Person) => {
    if (!expanded || checking[person.id]) return;
    const ipoId = expanded.id;
    markChecking(person.id, true);
    try {
      const r = await api.checkAllotment(ipoId, person.id);
      applyOutcome(person, ipoId, r);
    } catch {
      applyOutcome(person, ipoId, failedResult(person));
    } finally {
      markChecking(person.id, false);
    }
  };

  /** Checks every person against the IPO, one after another. */
  const checkAll = async () => {
    if (!expanded || checkingAll) return;
    const ipoId = expanded.id;
    setCheckingAll(true);
    try {
      for (const person of people) {
        markChecking(person.id, true);
        try {
          const r = await api.checkAllotment(ipoId, person.id);
          applyOutcome(person, ipoId, r);
        } catch {
          applyOutcome(person, ipoId, failedResult(person));
        } finally {
          markChecking(person.id, false);
        }
        // Be gentle with the registrar between lookups.
        await new Promise((res) => setTimeout(res, 1200));
      }
    } finally {
      setCheckingAll(false);
    }
  };

  /** Manual fallback: record the outcome yourself after checking the site. */
  const markManual = async (person: Person, status: AppStatus) => {
    const app = appFor(person.id);
    if (!app) return;
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

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Allotment Check</h1>
          <p className="sub">
            Tap an IPO — its registrar is detected automatically, then
            check everyone inside, one by one.
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
        <div className="ipo-accordion">
          {ipos.map((ipo) => {
            const isOpen = ipo.id === expandedId;
            const savedReg = registrarOf(ipo);
            const appCount = applications.filter(
              (a) => a.ipoId === ipo.id,
            ).length;
            return (
              <div
                key={ipo.id}
                className={`ipo-card${isOpen ? ' expanded' : ''}`}
              >
                <button
                  type="button"
                  className="ipo-card-head"
                  onClick={() => toggleIpo(ipo)}
                >
                  <span className="ipo-card-title">
                    <strong>{ipo.name}</strong>
                    <span
                      className={
                        ipo.status === 'OPEN'
                          ? 'pill pill-green'
                          : 'pill pill-gray'
                      }
                    >
                      {ipo.status === 'OPEN' ? 'Open' : 'Closed'}
                    </span>
                    {savedReg ? (
                      <span className="pill pill-blue">
                        {savedReg.label}
                      </span>
                    ) : (
                      <span className="pill pill-amber">No registrar</span>
                    )}
                    {appCount > 0 && (
                      <span className="muted ipo-card-count">
                        {appCount} application{appCount === 1 ? '' : 's'}
                      </span>
                    )}
                  </span>
                  <span className="muted">{isOpen ? '▾' : '▸'}</span>
                </button>

                {isOpen && (
                  <div className="ipo-card-body">
                    <div className="detect-bar">
                {detecting && (
                  <span className="muted">Detecting registrar…</span>
                )}
                {!detecting && regInfo && (
                  <>
                    <span
                      className={
                        auto ? 'pill pill-green' : 'pill pill-blue'
                      }
                    >
                      {regInfo.label}
                    </span>
                    {detection?.registrarName && (
                      <span className="muted">
                        Matched: {detection.registrarName}
                      </span>
                    )}
                    {auto && detection?.message && (
                      <span className="muted">· {detection.message}</span>
                    )}
                    <button
                      className="btn btn-secondary"
                      onClick={() => setRegistrarFor(expanded)}
                    >
                      Change
                    </button>
                  </>
                )}
                {!detecting && !regInfo && (
                  <>
                    <span className="pill pill-amber">
                      Registrar not detected
                    </span>
                    <span className="muted">
                      {detection?.message ?? 'Set it manually.'}
                    </span>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setRegistrarFor(expanded)}
                    >
                      Set manually
                    </button>
                  </>
                )}
              </div>

              <div className="toolbar" style={{ marginBottom: 6 }}>
                {auto && (
                  <button
                    className="btn btn-primary"
                    disabled={checkingAll}
                    onClick={checkAll}
                  >
                    {checkingAll ? 'Checking…' : '✓ Check all'}
                  </button>
                )}
                {!auto && regInfo && (
                  <a
                    className="btn btn-secondary"
                    href={regInfo.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open {regInfo.label} ↗
                  </a>
                )}
              </div>

              {people.length === 0 && (
                <p className="muted">
                  No people yet — add people first, then check them here.
                </p>
              )}

              {people.map((person) => {
                const app = appFor(person.id);
                const r = results[person.id];
                const isChecking = !!checking[person.id];
                return (
                  <div key={person.id} className="allot-row">
                    <div className="allot-who">
                      <strong>{person.name}</strong>
                      {app ? (
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
                      ) : (
                        <span
                          className="muted"
                          style={{ marginLeft: 8, fontSize: '0.85rem' }}
                        >
                          No application
                        </span>
                      )}
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
                      {auto && (
                        <button
                          className="btn btn-secondary"
                          disabled={isChecking || checkingAll}
                          onClick={() => checkOne(person)}
                        >
                          {isChecking ? '…' : 'Check'}
                        </button>
                      )}
                      {!auto && regInfo && app && (
                        <>
                          <button
                            className="btn btn-secondary"
                            onClick={() => markManual(person, 'ALLOTTED')}
                          >
                            Got it
                          </button>
                          <button
                            className="btn btn-secondary"
                            onClick={() =>
                              markManual(person, 'NOT_ALLOTTED')
                            }
                          >
                            Missed
                          </button>
                        </>
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
        </div>
      )}

      {registrarFor && (
        <RegistrarModal
          ipo={registrarFor}
          onClose={() => setRegistrarFor(null)}
          onSaved={(updated) => {
            setIpos((list) =>
              list.map((i) => (i.id === updated.id ? updated : i)),
            );
            const inf = REGISTRARS.find(
              (x) => x.value === updated.registrar,
            );
            if (inf?.auto && updated.registrarRef && updated.registrar) {
              setDetection({
                registrar: updated.registrar,
                registrarRef: updated.registrarRef,
                registrarName: null,
                confidence: 1,
                message: 'Set manually.',
              });
            } else {
              setDetection(null);
            }
          }}
        />
      )}
    </div>
  );
}
