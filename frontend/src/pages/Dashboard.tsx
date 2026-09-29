import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type {
  Allotment,
  DashboardStats,
  ProfitLossPeriod,
  ProfitLossReport,
} from '../types';
import { formatDate, formatDateTime, formatINR } from '../utils';

function Stat({
  label,
  value,
  sub,
  to,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  to?: string;
  tone?: 'green' | 'red';
}) {
  const inner = (
    <>
      <div className="stat-accent" />
      <div className="stat-label">{label}</div>
      <div
        className="stat-value"
        style={
          tone
            ? { color: tone === 'green' ? 'var(--green)' : 'var(--red)' }
            : undefined
        }
      >
        {value}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </>
  );
  return to ? (
    <Link className="stat-card" to={to}>
      {inner}
    </Link>
  ) : (
    <div className="stat-card">{inner}</div>
  );
}

const PERIODS: { value: ProfitLossPeriod; label: string }[] = [
  { value: 'MTD', label: 'This month' },
  { value: '1W', label: '1 week' },
  { value: '1M', label: '1 month' },
  { value: '3M', label: '3 months' },
  { value: '6M', label: '6 months' },
  { value: 'ALL', label: 'All time' },
];

function plTone(n: number): 'green' | 'red' | undefined {
  if (n > 0) return 'green';
  if (n < 0) return 'red';
  return undefined;
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [allotments, setAllotments] = useState<Allotment[]>([]);
  const [mtd, setMtd] = useState<ProfitLossReport | null>(null);
  const [period, setPeriod] = useState<ProfitLossPeriod>('MTD');
  const [pl, setPl] = useState<ProfitLossReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([api.getDashboardStats(), api.getAllotments(), api.getProfitLoss('MTD')])
      .then(([s, a, p]) => {
        setStats(s);
        setAllotments(a);
        setMtd(p);
        if (period === 'MTD') setPl(p);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Failed to load stats.'),
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (period === 'MTD' && mtd) {
      setPl(mtd);
      return;
    }
    api
      .getProfitLoss(period)
      .then(setPl)
      .catch(() => setPl(null));
  }, [period, mtd]);

  const periodLabel =
    PERIODS.find((p) => p.value === period)?.label ?? period;

  const copySummary = async () => {
    if (!pl) return;
    const lines = [
      `IPO Manager — P&L (${periodLabel})`,
      `Total: ${formatINR(pl.total)}`,
      ...pl.byIpo.map((b) => `• ${b.name}: ${formatINR(b.total)}`),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="sub">At a glance: money in, money owed, outcomes.</p>
        </div>
      </div>

      {loading && <div className="loading">Loading…</div>}
      {error && <div className="error-box">{error}</div>}

      {stats && (
        <div className="stats-grid">
          <Stat label="Active IPOs" value={String(stats.activeIpos)} to="/ipos" />
          <Stat
            label="Money Received"
            value={formatINR(stats.moneyReceived)}
            to="/money-flow"
          />
          <Stat
            label="People"
            value={String(stats.peopleCount)}
            to="/people"
          />
          <Stat
            label="Pending to Collect"
            value={formatINR(stats.pendingToCollect)}
            sub="Expected but not yet received"
          />
          <Stat
            label="Pending Settlements"
            value={`${stats.pendingSettlements.count} · ${formatINR(
              stats.pendingSettlements.amount,
            )}`}
            sub="Received but not sent back yet"
            to="/money-flow?filter=pending"
          />
          <Stat
            label="Allotment Rate (YTD)"
            value={`${stats.allotmentRateYtd.toFixed(1)}%`}
            sub="Allotted ÷ total applications"
          />
          {mtd && (
            <Stat
              label="P&L — This Month"
              value={formatINR(mtd.total)}
              sub={`${mtd.entries.length} sale${mtd.entries.length !== 1 ? 's' : ''} recorded`}
              tone={plTone(mtd.total)}
            />
          )}
        </div>
      )}

      {/* Allotments — which IPOs got allotment, for whom, when */}
      <div className="drawer-section">
        <h3>Allotments</h3>
        {allotments.length === 0 ? (
          <div className="card empty">
            No allotments yet. Mark an application as Allotted on its IPO page
            and it will appear here.
          </div>
        ) : (
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>IPO</th>
                    <th>Person</th>
                    <th className="num">Applied</th>
                    <th>Allotted on</th>
                  </tr>
                </thead>
                <tbody>
                  {allotments.slice(0, 10).map((a) => (
                    <tr key={a.applicationId}>
                      <td>
                        <Link to={`/ipos/${a.ipoId}`}>{a.ipoName}</Link>
                      </td>
                      <td>{a.personName}</td>
                      <td className="num">
                        {formatINR(a.amount)}
                        {a.lots ? ` · ${a.lots} lot${a.lots !== 1 ? 's' : ''}` : ''}
                      </td>
                      <td>{formatDate(a.allottedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {allotments.length > 10 && (
              <div className="hint" style={{ padding: '8px 16px' }}>
                Showing 10 of {allotments.length} allotments.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Profit & Loss with period filters */}
      <div className="drawer-section">
        <div className="page-head" style={{ marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Profit &amp; Loss</h3>
          <div className="seg">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                className={period === p.value ? 'on' : ''}
                onClick={() => setPeriod(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {!pl ? (
          <div className="card empty">Couldn&apos;t load P&amp;L.</div>
        ) : pl.entries.length === 0 ? (
          <div className="card empty">
            No sales recorded {periodLabel === 'All time' ? 'yet' : `in ${periodLabel.toLowerCase()}`}.
            After selling allotted shares, record the profit/loss on the
            IPO&apos;s Applications tab.
          </div>
        ) : (
          <>
            <div className="stats-grid" style={{ marginBottom: 12 }}>
              <Stat
                label={`Total P&L — ${periodLabel}`}
                value={formatINR(pl.total)}
                sub={`${pl.entries.length} sale${pl.entries.length !== 1 ? 's' : ''}`}
                tone={plTone(pl.total)}
              />
            </div>
            <div className="card" style={{ padding: 0, marginBottom: 12 }}>
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Sold</th>
                      <th>IPO</th>
                      <th>Person</th>
                      <th className="num">Applied</th>
                      <th className="num">P&amp;L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pl.entries.map((e) => (
                      <tr key={e.applicationId}>
                        <td>{formatDateTime(e.soldAt)}</td>
                        <td>{e.ipoName}</td>
                        <td>{e.personName}</td>
                        <td className="num">{formatINR(e.amount)}</td>
                        <td
                          className="num strong"
                          style={{
                            color:
                              e.profitLoss > 0
                                ? 'var(--green)'
                                : e.profitLoss < 0
                                  ? 'var(--red)'
                                  : undefined,
                          }}
                        >
                          {formatINR(e.profitLoss)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={copySummary}
            >
              {copied ? '✓ Copied' : '⧉ Copy summary'}
            </button>
          </>
        )}
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 8px' }}>Getting started</h3>
        <p style={{ color: 'var(--muted)', fontSize: '0.92rem', margin: 0 }}>
          Add an IPO, add the people applying through you, record money as it
          comes in, then mark allotment outcomes on the IPO&apos;s Applications
          tab. The <strong>Pending Settlements</strong> card is your safety
          net — it shows money you received but haven&apos;t sent back yet.
        </p>
      </div>
    </div>
  );
}
