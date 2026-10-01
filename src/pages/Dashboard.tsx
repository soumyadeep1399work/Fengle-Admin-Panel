import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { OrderRow } from '../api/types';
import { normalizeDashboard } from '../api/normalize';
import BarChart from '../components/BarChart';
import OrdersTable from '../components/OrdersTable';
import { QueryState, Tabs } from '../components/ui';
import { money, num, ORDER_STATUSES, STATUS_LABEL, STATUS_TONE } from '../lib/format';

export default function Dashboard() {
  const summary = useQuery({
    queryKey: ['/admin/dashboard'],
    queryFn: async () => normalizeDashboard(await api.get<Record<string, unknown>>('/admin/dashboard')),
    refetchInterval: 30_000,
  });
  const recent = useQuery({
    queryKey: ['/admin/orders', 'recent'],
    queryFn: () => api.get<{ orders: OrderRow[] }>('/admin/orders', { limit: 8, page: 1 }),
    refetchInterval: 30_000,
  });
  const [metric, setMetric] = useState<'orders' | 'gmv'>('orders');
  const d = summary.data;

  const series = (d?.series ?? []).map((p) => {
    const dt = new Date(p.date);
    const value = metric === 'orders' ? Number(p.orders) : Number(p.gmv);
    return {
      label: dt.toLocaleDateString('en-IN', { weekday: 'short' }),
      value,
      title: `${dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}: ${metric === 'orders' ? `${value} orders` : money(value)}`,
    };
  });

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Newtown operations at a glance. Refreshes every 30 seconds.</p>
        </div>
      </div>

      <QueryState isLoading={summary.isLoading} error={summary.error}>
        {d && (
          <>
            <div className="grid-4">
              <div className="card stat accent">
                <div className="label">Live orders</div>
                <div className="value">{num(d.pendingOrders)}</div>
                <div className="sub">Placed, accepted or on the road</div>
              </div>
              <div className="card stat">
                <div className="label">Orders today</div>
                <div className="value">{d.todayOrders !== undefined ? num(d.todayOrders) : '—'}</div>
                <div className="sub">{d.todayGmv !== undefined ? `${money(d.todayGmv)} GMV` : `${num(d.totalOrders)} all time`}</div>
              </div>
              <div className="card stat">
                <div className="label">Active kitchens</div>
                <div className="value">{num(d.activeRestaurants)}</div>
                <div className="sub">{d.restaurantsByStatus?.suspended ? `${d.restaurantsByStatus.suspended} suspended` : 'Taking orders'}</div>
              </div>
              <div className="card stat">
                <div className="label">Active riders</div>
                <div className="value">{num(d.activeRiders)}</div>
                <div className="sub">{d.ridersByStatus?.suspended ? `${d.ridersByStatus.suspended} suspended` : 'Self-registered'}</div>
              </div>
            </div>

            <div className="grid-2">
              <div className="card">
                <div className="card-head">
                  <h3>Last 7 days</h3>
                </div>
                <Tabs value={metric} onChange={setMetric} tabs={[{ value: 'orders', label: 'Orders' }, { value: 'gmv', label: 'GMV' }]} />
                <div className="card-pad">
                  {series.length > 0
                    ? <BarChart data={series} format={(n) => (metric === 'orders' ? String(n) : money(n))} />
                    : <div className="muted">The 7-day trend appears once the extended dashboard endpoint is live.</div>}
                </div>
              </div>
              <div className="card">
                <div className="card-head"><h3>Orders by status</h3><span className="muted small">{num(d.totalOrders)} total</span></div>
                <div className="card-pad stack" style={{ gap: 10 }}>
                  {d.statusCounts ? ORDER_STATUSES.map((s) => {
                    const n = d.statusCounts?.[s] ?? 0;
                    const pct = d.totalOrders ? (n / d.totalOrders) * 100 : 0;
                    return (
                      <Link key={s} to={`/orders?status=${s}`} className="row" style={{ color: 'inherit', textDecoration: 'none', flexWrap: 'nowrap' }}>
                        <span style={{ width: 92 }} className={`badge ${STATUS_TONE[s]}`}>{STATUS_LABEL[s]}</span>
                        <div style={{ flex: 1, height: 8, background: 'var(--grey-tint)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--primary)' }} />
                        </div>
                        <span className="mono" style={{ width: 48, textAlign: 'right', fontWeight: 700 }}>{num(n)}</span>
                      </Link>
                    );
                  }) : <div className="muted">Status breakdown appears once the extended dashboard endpoint is live.</div>}
                </div>
              </div>
            </div>
          </>
        )}
      </QueryState>

      <div className="card">
        <div className="card-head"><h3>Latest orders</h3><Link to="/orders" className="btn sm">All orders</Link></div>
        <QueryState isLoading={recent.isLoading} error={recent.error}>
          <OrdersTable orders={(recent.data?.orders ?? []).slice(0, 8)} hide={['rider']} />
        </QueryState>
      </div>
    </div>
  );
}
