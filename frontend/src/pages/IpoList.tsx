import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Ipo } from '../types';
import { formatDate, formatINR, pillClassForIpoStatus } from '../utils';

type Tab = 'open' | 'upcoming' | 'closed';

const TABS: { id: Tab; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'closed', label: 'Closed' },
];

/** Which board tab an IPO belongs on. Null = off the board (hidden). */
function tabOf(ipo: Ipo): Tab | null {
  if (ipo.boardHidden) return null;
  switch (ipo.status) {
    case 'OPEN':
      return 'open';
    case 'UPCOMING':
      return 'upcoming';
    case 'CLOSED':
    case 'LISTED':
      // CLOSED = allotment awaited; LISTED but still visible = you got an
      // allotment and it stays until sold + noted.
      return 'closed';
    default:
      return null;
  }
}

/** Fresh AUTO rows you haven't triaged yet — these get Apply/Avoid buttons. */
function isUndecided(ipo: Ipo): boolean {
  return ipo.source === 'AUTO' && ipo.decision == null;
}

function priceLabel(ipo: Ipo): string | null {
  if (ipo.priceLow != null && ipo.priceHigh != null) {
    return `₹${formatINR(ipo.priceLow)}–₹${formatINR(ipo.priceHigh)}`;
  }
  if (ipo.priceHigh != null) return `₹${formatINR(ipo.priceHigh)}`;
  if (ipo.price != null) return `₹${formatINR(ipo.price)}`;
  return null;
}

export function IpoList() {
  const [ipos, setIpos] = useState<Ipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('open');
  const [query, setQuery] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const navigate = useNavigate();

  const load = (quiet = false) => {
    if (!quiet) setLoading(true);
    api
      .listIpos()
      .then(setIpos)
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Failed to load IPOs.'),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // The board fills itself: if the last background sync is stale, refresh
    // quietly so the data is already here when the user opens the page.
    try {
      const last = Number(localStorage.getItem('ipo-auto-sync-at') || 0);
      if (Date.now() - last > 30 * 60 * 1000) {
        localStorage.setItem('ipo-auto-sync-at', String(Date.now()));
        api
          .syncIpos()
          .then(() => load(true))
          .catch(() => {});
      }
    } catch {
      // private-mode storage — the manual Sync button still works
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { open: 0, upcoming: 0, closed: 0 };
    for (const ipo of ipos) {
      const t = tabOf(ipo);
      if (t) c[t]++;
    }
    return c;
  }, [ipos]);

  const searching = query.trim().length > 0;

  const visible = useMemo(() => {
    if (searching) {
      // Search spans everything — including rows off the board.
      const q = query.trim().toLowerCase();
      return ipos.filter((ipo) => ipo.name.toLowerCase().includes(q));
    }
    return ipos.filter((ipo) => tabOf(ipo) === tab);
  }, [ipos, tab, query, searching]);

  const syncNow = async () => {
    setSyncing(true);
    setSyncMsg('');
    try {
      const r = await api.syncIpos();
      setSyncMsg(
        `Sync done — ${r.added} new, ${r.updated} refreshed, ${r.hidden} moved off the board.`,
      );
      load();
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  /** Triage an IPO: APPLY keeps it on the board, AVOID hides it (DB keeps it). */
  const decide = async (
    e: React.MouseEvent,
    ipo: Ipo,
    decision: 'APPLY' | 'AVOID',
  ) => {
    e.stopPropagation();
    try {
      const updated = await api.setIpoBoard(ipo.id, {
        hidden: decision === 'AVOID',
        decision,
      });
      setIpos((prev) => prev.map((p) => (p.id === ipo.id ? updated : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update.');
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>IPOs</h1>
          <p className="sub">Open and upcoming mainboard IPOs.</p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={syncNow}
          disabled={syncing}
        >
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
      </div>

      {loading && <div className="loading">Loading…</div>}
      {error && <div className="error-box">{error}</div>}
      {syncMsg && !loading && <div className="info-box">{syncMsg}</div>}

      {!loading && !error && (
        <>
          <div className="toolbar" style={{ marginBottom: 12 }}>
            <input
              className="input"
              style={{ maxWidth: 260 }}
              placeholder="Search all IPOs…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {!searching && (
            <div className="tabs" style={{ marginBottom: 12 }}>
              {TABS.map((t) => (
                <button
                  key={t.id}
                  className={tab === t.id ? 'on' : ''}
                  onClick={() => setTab(t.id)}
                >
                  {t.label} ({counts[t.id]})
                </button>
              ))}
            </div>
          )}

          <div className="list-grid">
            {visible.map((ipo) => {
              const undecided = isUndecided(ipo);
              const showApply =
                undecided &&
                !searching &&
                (ipo.status === 'OPEN' || ipo.status === 'UPCOMING');
              const showAvoid = undecided && !searching;
              return (
                <div
                  key={ipo.id}
                  className="card ipo-card"
                  onClick={() => navigate(`/ipos/${ipo.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') navigate(`/ipos/${ipo.id}`);
                  }}
                >
                  <div className="card-top">
                    <h3>{ipo.name}</h3>
                    <span style={{ display: 'flex', gap: 6 }}>
                      {ipo.boardHidden && (
                        <span className="pill pill-gray">OFF BOARD</span>
                      )}
                      <span className={pillClassForIpoStatus(ipo.status)}>
                        {ipo.status}
                      </span>
                    </span>
                  </div>
                  <div className="meta">
                    {ipo.openDate && <>Opens {formatDate(ipo.openDate)} · </>}
                    {ipo.closeDate && <>Closes {formatDate(ipo.closeDate)}</>}
                    {priceLabel(ipo) && <> · {priceLabel(ipo)}</>}
                    {ipo.lotSize ? <> · {ipo.lotSize} shares/lot</> : null}
                    {ipo.issueSize ? <> · {ipo.issueSize}</> : null}
                  </div>
                  {(showApply || showAvoid) && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                      {showApply && (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={(e) => decide(e, ipo, 'APPLY')}
                        >
                          Apply
                        </button>
                      )}
                      {showAvoid && (
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={(e) => decide(e, ipo, 'AVOID')}
                        >
                          Avoid
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {visible.length === 0 && (
              <div className="card empty">
                {searching
                  ? `No IPOs matching “${query.trim()}”.`
                  : `No ${tab} IPOs right now.`}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
