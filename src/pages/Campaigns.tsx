import { useState } from 'react';
import { download } from '../api/client';
import type { Customer } from '../api/types';
import { Field, QueryState, errMsg, useDebounced, useToast } from '../components/ui';
import { useAllCategories } from '../lib/catalog';
import { useList } from '../lib/hooks';
import { ago, money, num } from '../lib/format';

const PRESETS: { label: string; hint: string; f: Partial<Filters> }[] = [
  { label: 'Never ordered', hint: 'Signed up, no order yet', f: { max_orders: '0', min_orders: '', inactive_days: '' } },
  { label: 'Lapsed regulars', hint: '3+ orders, quiet for 21 days', f: { min_orders: '3', inactive_days: '21', max_orders: '' } },
  { label: 'One-and-done', hint: 'Exactly 1 order, quiet for 14 days', f: { min_orders: '1', max_orders: '1', inactive_days: '14' } },
  { label: 'Everyone', hint: 'All opted-in customers', f: { min_orders: '', max_orders: '', inactive_days: '', ordered_category_id: '' } },
];

interface Filters {
  promo_opt_in: boolean;
  min_orders: string;
  max_orders: string;
  inactive_days: string;
  ordered_category_id: string;
}

export default function Campaigns() {
  const toast = useToast();
  const cats = useAllCategories();
  const [f, setF] = useState<Filters>({ promo_opt_in: true, min_orders: '', max_orders: '', inactive_days: '', ordered_category_id: '' });
  const [busy, setBusy] = useState(false);
  const df = useDebounced(f, 400);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((p) => ({ ...p, [k]: v }));

  const query = {
    status: 'active',
    promo_opt_in: df.promo_opt_in || undefined,
    min_orders: df.min_orders || undefined,
    max_orders: df.max_orders || undefined,
    inactive_days: df.inactive_days || undefined,
    ordered_category_id: df.ordered_category_id || undefined,
  };
  const preview = useList<Customer>('/admin/customers', 'customers', { ...query, limit: 10, page: 1 });

  async function exportCsv() {
    setBusy(true);
    try {
      await download('/admin/customers/export.csv', query, `fengle-audience-${new Date().toISOString().slice(0, 10)}.csv`);
      toast('Audience exported');
    } catch (e) {
      toast(errMsg(e), true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Campaign audience</h1>
          <p>Build a customer list for a promotion and export it as CSV (name, phone, email, orders, spend, last order).</p>
        </div>
        <button className="btn primary" disabled={busy} onClick={exportCsv}>{busy ? 'Exporting…' : 'Export CSV'}</button>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: 'minmax(280px, 360px) 1fr', alignItems: 'start' }}>
        <div className="card card-pad stack">
          <h3>Who to include</h3>
          <div className="chips">
            {PRESETS.map((p) => (
              <button key={p.label} className="chip-toggle" title={p.hint} onClick={() => setF((prev) => ({ ...prev, ...p.f }))}>{p.label}</button>
            ))}
          </div>
          <hr className="sep" />
          <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Field label="Min orders"><input className="input" type="number" min="0" value={f.min_orders} onChange={(e) => set('min_orders', e.target.value)} /></Field>
            <Field label="Max orders"><input className="input" type="number" min="0" value={f.max_orders} onChange={(e) => set('max_orders', e.target.value)} /></Field>
          </div>
          <Field label="No order in the last … days" hint="Blank = any recency">
            <input className="input" type="number" min="1" value={f.inactive_days} onChange={(e) => set('inactive_days', e.target.value)} />
          </Field>
          <Field label="Has ordered from category">
            <select className="select" value={f.ordered_category_id} onChange={(e) => set('ordered_category_id', e.target.value)}>
              <option value="">Any category</option>
              {(cats.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <label className="check">
            <input type="checkbox" checked={f.promo_opt_in} onChange={(e) => set('promo_opt_in', e.target.checked)} />
            Only customers who allow promotions
          </label>
          {!f.promo_opt_in && (
            <div className="alert warn">
              This includes customers who turned promotions off in the app. Only use this list for service messages, not marketing.
            </div>
          )}
          <small className="muted">Blocked customers are always left out. Promotional SMS in India also needs DLT-registered templates once the SMS provider is live.</small>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Preview</h3>
            <span className="badge violet">{preview.data?.total !== undefined ? `${num(preview.data.total)} customers` : '…'}</span>
          </div>
          <QueryState isLoading={preview.isLoading} error={preview.error}>
            {(preview.data?.rows.length ?? 0) === 0 ? <div className="empty"><b>Nobody matches</b>Loosen the filters.</div> : (
              <div className="table-wrap">
                <table className="tbl">
                  <thead><tr><th>Customer</th><th className="num">Orders</th><th className="num">Spent</th><th>Last order</th></tr></thead>
                  <tbody>
                    {preview.data!.rows.map((c) => (
                      <tr key={c.id}>
                        <td><div className="cell-main">{c.name || 'No name'}</div><div className="cell-sub">{c.phone}</div></td>
                        <td className="num">{num(c.order_count)}</td>
                        <td className="num">{money(c.total_spent)}</td>
                        <td className="small">{c.last_order_at ? ago(c.last_order_at) : <span className="muted">Never</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {(preview.data?.total ?? 0) > 10 && <div className="pager"><span className="muted small">Showing 10. The export has everyone.</span></div>}
          </QueryState>
        </div>
      </div>
    </div>
  );
}
