import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { OrderRow } from '../api/types';
import OrdersTable from '../components/OrdersTable';
import { Pager, QueryState, Tabs, useDebounced } from '../components/ui';
import { useList } from '../lib/hooks';
import { ORDER_STATUSES, PAYMENT_LABEL, STATUS_LABEL } from '../lib/format';

const LIMIT = 50;
type Tab = '' | (typeof ORDER_STATUSES)[number];

export default function Orders() {
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') ?? '') as Tab;
  const page = Number(params.get('page') || 1);
  const payment = params.get('payment_method') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const [q, setQ] = useState(params.get('q') ?? '');
  const dq = useDebounced(q);

  function set(patch: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v); else next.delete(k);
    }
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  }

  const { data, isLoading, error, isFetching } = useList<OrderRow>('/admin/orders', 'orders', {
    status: status || undefined,
    q: dq || undefined,
    payment_method: payment || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
    limit: LIMIT,
  });

  const tabs: { value: Tab; label: string }[] = [
    { value: '', label: 'All' },
    ...ORDER_STATUSES.map((s) => ({ value: s as Tab, label: STATUS_LABEL[s] })),
  ];

  return (
    <div className="stack">
      <div className="page-head">
        <div><h1>Orders</h1><p>Every order across all kitchens. Click a row for the full breakdown.</p></div>
        {isFetching && !isLoading && <span className="muted small">Refreshing…</span>}
      </div>
      <div className="card">
        <Tabs value={status} onChange={(v) => set({ status: v })} tabs={tabs} />
        <div className="toolbar">
          <input className="input search" placeholder="Order # or customer phone" value={q}
            onChange={(e) => { setQ(e.target.value); set({ q: e.target.value }); }} />
          <select className="select" value={payment} onChange={(e) => set({ payment_method: e.target.value })} aria-label="Payment method">
            <option value="">All payments</option>
            {Object.entries(PAYMENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <label className="row small muted">From <input className="input" type="date" value={from} onChange={(e) => set({ from: e.target.value })} /></label>
          <label className="row small muted">To <input className="input" type="date" value={to} onChange={(e) => set({ to: e.target.value })} /></label>
          {(q || payment || from || to) && (
            <button className="btn ghost sm" onClick={() => { setQ(''); set({ q: '', payment_method: '', from: '', to: '' }); }}>Clear filters</button>
          )}
        </div>
        <QueryState isLoading={isLoading} error={error}>
          <OrdersTable orders={data?.rows ?? []} />
          <Pager page={page} limit={LIMIT} total={data?.total} count={data?.rows.length ?? 0} onPage={(p) => set({ page: String(p) })} />
        </QueryState>
      </div>
    </div>
  );
}
