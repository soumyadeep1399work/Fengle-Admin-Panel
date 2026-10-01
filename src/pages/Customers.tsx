import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Customer } from '../api/types';
import { Empty, Pager, QueryState, StatusBadge, Tabs, useDebounced } from '../components/ui';
import { useList } from '../lib/hooks';
import { ago, bool, date, money, num } from '../lib/format';

const LIMIT = 50;

export default function Customers() {
  const nav = useNavigate();
  const [status, setStatus] = useState<'' | 'active' | 'blocked'>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounced(search);
  const { data, isLoading, error } = useList<Customer>('/admin/customers', 'customers', { status: status || undefined, q: dq || undefined, page, limit: LIMIT });

  return (
    <div className="stack">
      <div className="page-head">
        <div><h1>Customers</h1><p>Everyone who has signed in to the Fengle app.</p></div>
      </div>
      <div className="card">
        <Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={[
          { value: '', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'blocked', label: 'Blocked' },
        ]} />
        <div className="toolbar">
          <input className="input search" placeholder="Search name, phone or email" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <QueryState isLoading={isLoading} error={error}>
          {(data?.rows.length ?? 0) === 0 ? <Empty title="No customers match" /> : (
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr>
                  <th>Customer</th><th>Status</th><th className="num">Orders</th><th className="num">Spent</th>
                  <th>Last order</th><th className="num">Wallet</th><th>Promos</th><th>Joined</th>
                </tr></thead>
                <tbody>
                  {data!.rows.map((c) => (
                    <tr key={c.id} className="clickable" onClick={() => nav(`/customers/${c.id}`)}>
                      <td><div className="cell-main">{c.name || 'No name yet'}</div><div className="cell-sub">{c.phone}{c.email ? ` · ${c.email}` : ''}</div></td>
                      <td><StatusBadge status={c.status} /></td>
                      <td className="num">{num(c.order_count)}</td>
                      <td className="num">{money(c.total_spent)}</td>
                      <td className="small nowrap">{c.last_order_at ? ago(c.last_order_at) : <span className="muted">Never</span>}</td>
                      <td className="num">{money(c.wallet_balance)}</td>
                      <td>{c.promo_opt_in === undefined ? '—' : bool(c.promo_opt_in) ? <span className="badge green">Opted in</span> : <span className="badge">Opted out</span>}</td>
                      <td className="small muted nowrap">{date(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={page} limit={LIMIT} total={data?.total} count={data?.rows.length ?? 0} onPage={setPage} />
        </QueryState>
      </div>
    </div>
  );
}
