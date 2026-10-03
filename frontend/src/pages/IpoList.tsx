import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Ipo } from '../types';
import { formatDate, formatINR, pillClassForIpoStatus } from '../utils';
import { IpoModal } from '../components/Modals';

type Tab = 'open' | 'upcoming' | 'closed' | 'hidden';

const TABS: { id: Tab; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'closed', label: 'Closed' },
  { id: 'hidden', label: 'Hidden' },
];

/** Which board tab an IPO belongs on. Null = shouldn't be on the board. */
function tabOf(ipo: Ipo): Tab | null {
  if (ipo.boardHidden) return 'hidden';
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
  const [showAdd, setShowAdd] = useState(false);
  const [tab, setTab] = useState<Tab>('open');
  const [query, setQuery] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    api
      .listIpos()
      .then(setIpos)
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Failed to load IPOs.'),
      )
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { open: 0, upcoming: 0, closed: 0, hidden: 0 };
    for (const ipo of ipos) {
      const t = tabOf(ipo);
      if (t) c[t]++;
    }
    return c;
  }, [ipos]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      // Search spans everything — including hidden rows still in the DB.
      return ipos.filter((ipo) => ipo.name.toLowerCase().includes(q));
    }
    return ipos.filter((ipo) => tabOf(ipo) === tab);
  }, [ipos, tab, query]);

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

  const toggleHidden = async (
    e: React.MouseEvent,
    ipo: Ipo,
  ) => {
    e.stopPropagation();
    const hidden = !ipo.boardHidden;
    try {
      await api.setIpoBoardHidden(ipo.id, hidden);
      setIpos((prev) =>
        prev.map((p) => (p.id === ipo.id ? { ...p, boardHidden: hidden } : p)),
      );
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
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary"
            onClick={syncNow}
            disabled={syncing}
          >
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            + Add IPO
          </button>
        </div>
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

          {!query.trim() && (
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
              const hidden = !!ipo.boardHidden;
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
                      {ipo.source === 'AUTO' && (
                        <span className="pill pill-auto">AUTO</span>
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
                  <div style={{ marginTop: 8 }}>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={(e) => toggleHidden(e, ipo)}
                    >
                      {hidden ? 'Restore to board' : 'Remove from board'}
                    </button>
                  </div>
                </div>
              );
            })}
            {visible.length === 0 && (
              <div className="card empty">
                {query.trim()
                  ? `No IPOs matching “${query.trim()}”.`
                  : tab === 'hidden'
                    ? 'Nothing removed from the board.'
                    : `No ${tab} IPOs right now.`}
              </div>
            )}
          </div>
        </>
      )}

      {showAdd && (
        <IpoModal
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            load();
          }}
        />
      )}
    </div>
  );
}
