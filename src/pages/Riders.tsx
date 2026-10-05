import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Rider } from '../api/types';
import { SelfieBadge } from '../components/AgreementSelfie';
import SettleRider from '../components/SettleRider';
import { Empty, Pager, QueryState, StatusBadge, Tabs, useDebounced } from '../components/ui';
import { useList } from '../lib/hooks';
import { normalizeRider } from '../api/normalize';
import { ago, money, num } from '../lib/format';

type Filter = '' | 'active' | 'inactive' | 'suspended';
const LIMIT = 50;

export default function Riders() {
  const nav = useNavigate();
  const [status, setStatus] = useState<Filter>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounced(search);
  const [settling, setSettling] = useState<Rider | null>(null);
  const { data, isLoading, error } = useList<Rider>('/admin/riders', 'riders', { status: status || undefined, q: dq || undefined, page, limit: LIMIT }, (r) => normalizeRider(r));

  // Older backend returns every rider unfiltered — filter client-side too so the screen behaves either way.
  const rows = useMemo(() => {
    const s = dq.trim().toLowerCase();
    return (data?.rows ?? []).filter((r) => (!status || r.status === status) &&
      (!s || (r.name ?? '').toLowerCase().includes(s) || r.phone.includes(s) || (r.vehicle_number ?? '').toLowerCase().includes(s)));
  }, [data, status, dq]);

  return (
    <div className="stack">
      <div className="page-head">
        <div><h1>Riders</h1><p>Riders sign up themselves in the Rider app. Suspend anyone who shouldn't be delivering.</p></div>
      </div>
      <div className="card">
        <Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={[
          { value: '', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'suspended', label: 'Suspended' },
        ]} />
        <div className="toolbar">
          <input className="input search" placeholder="Search name, phone or vehicle number" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <QueryState isLoading={isLoading} error={error}>
          {rows.length === 0 ? <Empty title="No riders match" /> : (
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr>
                  <th>Rider</th><th>Status</th><th>Vehicle</th><th className="num">COD held</th><th className="num">Unsettled</th>
                  <th className="num">Wallet</th><th>Selfie</th><th>Last active</th><th />
                </tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="clickable" onClick={() => nav(`/riders/${r.id}`)}>
                      <td><div className="cell-main">{r.name || 'Unnamed rider'}</div><div className="cell-sub">{r.phone}</div></td>
                      <td><StatusBadge status={r.status} /></td>
                      <td>{r.vehicle_type || '—'}<div className="cell-sub">{r.vehicle_number}</div></td>
                      <td className="num">{r.cod_outstanding !== undefined ? money(r.cod_outstanding) : '—'}</td>
                      <td className="num">{r.unsettled_deliveries !== undefined ? num(r.unsettled_deliveries) : '—'}</td>
                      <td className="num" style={{ color: Number(r.wallet_balance) < 0 ? 'var(--red)' : undefined, fontWeight: 700 }}>{money(r.wallet_balance)}</td>
                      <td><SelfieBadge hasSelfie={r.hasAgreementSelfie} /></td>
                      <td className="muted small nowrap">{r.last_active_at ? ago(r.last_active_at) : `Joined ${ago(r.created_at)}`}</td>
                      <td className="right" onClick={(e) => e.stopPropagation()}>
                        <button className="btn sm" onClick={() => setSettling(r)}>Settle</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={page} limit={LIMIT} total={data?.total} count={data?.rows.length ?? 0} onPage={setPage} />
        </QueryState>
      </div>
      <p className="muted small">A negative wallet means the rider holds more COD cash than they've earned; settlement nets the two.</p>
      {settling && <SettleRider rider={settling} onClose={() => setSettling(null)} />}
    </div>
  );
}
