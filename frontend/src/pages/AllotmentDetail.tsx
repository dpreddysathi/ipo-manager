import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import type {
  AllotmentCheckResult,
  Application,
  AppStatus,
  Ipo,
  Person,
  RegistrarDetection,
} from '../types';
import { pillClassForAppStatus } from '../utils';
import {
  REGISTRARS,
  RegistrarModal,
  outcomeLabel,
  outcomePill,
} from './Allotment';

/* ---------------- Per-IPO allotment detail page ---------------- */

export function AllotmentDetail() {
  const { id } = useParams();
  const ipoId = Number(id);
  const navigate = useNavigate();

  const [ipo, setIpo] = useState<Ipo | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detection, setDetection] = useState<RegistrarDetection | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [results, setResults] = useState<
    Record<number, AllotmentCheckResult>
  >({});
  const [checking, setChecking] = useState<Record<number, boolean>>({});
  const [checkingAll, setCheckingAll] = useState(false);
  const [registrarFor, setRegistrarFor] = useState<Ipo | null>(null);
  /** Guards against out-of-order detect responses. */
  const detectToken = useRef(0);

  /** Work out the registrar automatically for this IPO. */
  const detect = (target: Ipo) => {
    const token = ++detectToken.current;
    setDetecting(true);
    setDetection(null);
    api
      .detectRegistrar(target.id)
      .then((d) => {
        if (detectToken.current !== token) return;
        setDetection(d);
        if (d.registrar) {
          setIpo((prev) =>
            prev && prev.id === target.id
              ? {
                  ...prev,
                  registrar: d.registrar,
                  registrarRef: d.registrarRef ?? prev.registrarRef,
                }
              : prev,
          );
        }
      })
      .catch(() => {
        if (detectToken.current !== token) return;
        setDetection({
          registrar: null,
          registrarRef: null,
          registrarName: null,
          confidence: 0,
          message: 'Detection failed — set the registrar manually.',
        });
      })
      .finally(() => {
        if (detectToken.current === token) setDetecting(false);
      });
  };

  useEffect(() => {
    Promise.all([
      api.listIpos(),
      api.listPeople(),
      api.listApplications(),
    ])
      .then(([ipoList, personList, appList]) => {
        const found = ipoList.find((i) => i.id === ipoId) ?? null;
        setIpo(found);
        setPeople(
          [...personList].sort((a, b) => a.name.localeCompare(b.name)),
        );
        setApplications(appList);
        if (found) detect(found);
        else setError('IPO not found.');
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Failed to load.'),
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ipoId]);

  const regValue = detection?.registrar ?? ipo?.registrar ?? null;
  const regInfo = REGISTRARS.find((r) => r.value === regValue);
  const auto = regInfo?.auto ?? false;

  const appFor = (personId: number) =>
    applications.find(
      (a) => a.personId === personId && a.ipoId === ipoId,
    ) ?? null;

  const markChecking = (id: number, on: boolean) =>
    setChecking((m) => {
      const next = { ...m };
      if (on) next[id] = true;
      else delete next[id];
      return next;
    });

  const applyOutcome = (person: Person, r: AllotmentCheckResult) => {
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
    if (!ipo || checking[person.id]) return;
    markChecking(person.id, true);
    try {
      const r = await api.checkAllotment(ipoId, person.id);
      applyOutcome(person, r);
    } catch {
      applyOutcome(person, failedResult(person));
    } finally {
      markChecking(person.id, false);
    }
  };

  /** Checks every person against the IPO, one after another. */
  const checkAll = async () => {
    if (!ipo || checkingAll) return;
    setCheckingAll(true);
    try {
      for (const person of people) {
        markChecking(person.id, true);
        try {
          const r = await api.checkAllotment(ipoId, person.id);
          applyOutcome(person, r);
        } catch {
          applyOutcome(person, failedResult(person));
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
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/allotment')}
          >
            ‹ All IPOs
          </button>
          <h1 style={{ marginTop: 10 }}>
            {ipo ? ipo.name : 'Allotment Check'}
          </h1>
          {ipo && (
            <p className="sub">
              <span
                className={
                  ipo.status === 'OPEN' ? 'pill pill-green' : 'pill pill-gray'
                }
              >
                {ipo.status === 'OPEN' ? 'Open' : 'Closed'}
              </span>
            </p>
          )}
        </div>
      </div>

      {loading && <div className="loading">Loading…</div>}
      {error && <div className="error-box">{error}</div>}

      {!loading && !error && ipo && (
        <>
          <div className="detect-bar">
            {detecting && <span className="muted">Detecting registrar…</span>}
            {!detecting && regInfo && (
              <>
                <span className={auto ? 'pill pill-green' : 'pill pill-blue'}>
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
                  onClick={() => setRegistrarFor(ipo)}
                >
                  Change
                </button>
              </>
            )}
            {!detecting && !regInfo && (
              <>
                <span className="pill pill-amber">Registrar not detected</span>
                <span className="muted">
                  {detection?.message ?? 'Set it manually.'}
                </span>
                <button
                  className="btn btn-secondary"
                  onClick={() => setRegistrarFor(ipo)}
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
                  {isChecking && <span className="muted">Checking…</span>}
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
                        onClick={() => markManual(person, 'NOT_ALLOTTED')}
                      >
                        Missed
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}

      {registrarFor && (
        <RegistrarModal
          ipo={registrarFor}
          onClose={() => setRegistrarFor(null)}
          onSaved={(updated) => {
            setIpo(updated);
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
