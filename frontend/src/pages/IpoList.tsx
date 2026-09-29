import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Ipo } from '../types';
import { formatDate, pillClassForIpoStatus } from '../utils';
import { IpoModal } from '../components/Modals';

/** True when the IPO belongs in the default "last 30 days" view:
 *  open/upcoming IPOs always, otherwise opened within the last 30 days. */
function isRecent(ipo: Ipo): boolean {
  if (ipo.status === 'OPEN' || ipo.status === 'UPCOMING') return true;
  if (!ipo.openDate) return true;
  const open = new Date(ipo.openDate).getTime();
  if (Number.isNaN(open)) return true;
  return Date.now() - open <= 30 * 24 * 60 * 60 * 1000;
}

export function IpoList() {
  const [ipos, setIpos] = useState<Ipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  /** Default view: only IPOs from the last 30 days (plus open/upcoming). */
  const [recentOnly, setRecentOnly] = useState(true);
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

  const visible = useMemo(
    () => (recentOnly ? ipos.filter(isRecent) : ipos),
    [ipos, recentOnly],
  );

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>IPOs</h1>
          <p className="sub">Every IPO you&apos;re tracking.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          + Add IPO
        </button>
      </div>

      {loading && <div className="loading">Loading…</div>}
      {error && <div className="error-box">{error}</div>}

      {!loading && !error && (
        <>
          <div className="toolbar" style={{ marginBottom: 12 }}>
            <label className="toggle">
              <input
                type="checkbox"
                checked={recentOnly}
                onChange={(e) => setRecentOnly(e.target.checked)}
              />
              Last 30 days only
            </label>
          </div>
          <div className="list-grid">
            {visible.map((ipo) => (
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
                  <span className={pillClassForIpoStatus(ipo.status)}>
                    {ipo.status}
                  </span>
                </div>
                <div className="meta">
                  {ipo.openDate && <>Opens {formatDate(ipo.openDate)} · </>}
                  {ipo.closeDate && <>Closes {formatDate(ipo.closeDate)}</>}
                  {ipo.price != null && (
                    <> · ₹{ipo.price}{ipo.lotSize ? ` × ${ipo.lotSize}` : ''}</>
                  )}
                </div>
              </div>
            ))}
            {visible.length === 0 && (
              <div className="card empty">
                {recentOnly
                  ? 'No IPOs in the last 30 days. Uncheck the filter above to see all IPOs.'
                  : 'No IPOs yet. Click + Add IPO to track your first one.'}
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
