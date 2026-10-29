import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, download } from '../api/client';
import { Empty, QueryState, errMsg, useToast } from '../components/ui';
import { useAllCategories } from '../lib/catalog';
import { money, num } from '../lib/format';

// GET /admin/finance/products (super_admin). Delivered orders, by placement date like the P&L.
interface Product {
  item_id: number; name: string; category_id: number; category_name: string;
  units_sold: number; customer_revenue: number; vendor_cost_total: number; gross_profit: number; margin_percent: number | null;
  estimated_units: number; has_estimated_cost: boolean;
  current_price: number | null; current_effective_price: number | null; current_vendor_cost: number | null;
  current_margin: number | null; current_margin_percent: number | null;
}
type SortKey = 'gross_profit' | 'units_sold' | 'customer_revenue' | 'margin_percent';

const pad = (x: number) => String(x).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const pct = (v: number | null | undefined) => (v == null ? '—' : `${Number(v).toFixed(1)}%`);

export default function ProductProfit() {
  const toast = useToast();
  const cats = useAllCategories();
  const [from, setFrom] = useState(ymd(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [to, setTo] = useState(ymd(new Date()));
  const [categoryId, setCategoryId] = useState('');
  const [sort, setSort] = useState<SortKey>('gross_profit');
  const query = { from: from || undefined, to: to || undefined, category_id: categoryId || undefined };
  const q = useQuery({
    queryKey: ['/admin/finance/products', query],
    queryFn: () => api.get<{ products: Product[]; totals: Record<string, number> }>('/admin/finance/products', query),
  });
  const rows = [...(q.data?.products ?? [])].sort((a, b) => Number(b[sort] ?? -Infinity) - Number(a[sort] ?? -Infinity));
  const t = q.data?.totals ?? {};

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Profit per dish</h1>
          <p>For each dish sold: what customers paid, what Fengle paid the kitchen (vendor cost), and the profit in between. Delivered orders, by the day they were placed.</p>
        </div>
        <button className="btn sm" onClick={async () => {
          try { await download('/admin/finance/products.csv', query, `fengle-profit-per-dish-${from || 'all'}-to-${to || 'now'}.csv`); }
          catch (e) { toast(errMsg(e), true); }
        }}>Export CSV</button>
      </div>
      <div className="card">
        <div className="toolbar">
          <label className="row small muted">From <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="row small muted">To <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Category">
            <option value="">All categories</option>
            {(cats.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort by">
            <option value="gross_profit">Most profit</option>
            <option value="units_sold">Most sold</option>
            <option value="customer_revenue">Most revenue</option>
            <option value="margin_percent">Best margin</option>
          </select>
        </div>
        <QueryState isLoading={q.isLoading} error={q.error}>
          <div className="grid-4" style={{ padding: 14 }}>
            <div className="card stat"><div className="label">Dishes sold</div><div className="value">{num(t.units_sold ?? rows.reduce((s, r) => s + r.units_sold, 0))}</div></div>
            <div className="card stat"><div className="label">Customer revenue</div><div className="value">{money(t.customer_revenue ?? 0)}</div></div>
            <div className="card stat"><div className="label">Vendor cost</div><div className="value">{money(t.vendor_cost_total ?? 0)}</div></div>
            <div className="card stat accent"><div className="label">Gross profit</div><div className="value">{money(t.gross_profit ?? 0)}</div><div className="sub">{pct(t.margin_percent)} margin, before delivery, discounts and expenses</div></div>
          </div>
          {rows.length === 0 ? <Empty title="No dishes sold in this period" /> : (
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr>
                  <th>Dish</th><th className="num">Sold</th><th className="num">Customer revenue</th><th className="num">Vendor cost</th>
                  <th className="num">Profit</th><th className="num">Margin</th><th className="num">Now: price / cost</th>
                </tr></thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.item_id}>
                      <td><div className="cell-main">{p.name}</div><div className="cell-sub">{p.category_name}{p.has_estimated_cost && <span style={{ color: 'var(--gold-ink)' }}> · {num(p.estimated_units)} sold without a vendor cost (estimated)</span>}</div></td>
                      <td className="num">{num(p.units_sold)}</td>
                      <td className="num">{money(p.customer_revenue)}</td>
                      <td className="num">{money(p.vendor_cost_total)}</td>
                      <td className="num cell-main" style={{ color: p.gross_profit < 0 ? 'var(--red)' : 'var(--green)' }}>{money(p.gross_profit)}</td>
                      <td className="num">{pct(p.margin_percent)}</td>
                      <td className="num small">
                        {money(p.current_effective_price ?? p.current_price)} / {p.current_vendor_cost != null ? money(p.current_vendor_cost) : <span className="badge gold">No cost set</span>}
                        {p.current_margin_percent != null && <div className="cell-sub">{pct(p.current_margin_percent)} margin</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </QueryState>
      </div>
    </div>
  );
}
