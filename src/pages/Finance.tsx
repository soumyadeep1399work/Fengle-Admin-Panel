import { useState, type FormEvent, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, download } from '../api/client';
import { Confirm, Empty, Field, Modal, Pager, QueryState, Tabs, errMsg, useToast } from '../components/ui';
import { useAction } from '../lib/hooks';
import { date, money, num } from '../lib/format';

// Backend: "Finance: expenses and profit & loss" in fengle-backend/docs/API.md (super_admin only).
type Category = 'marketing' | 'operating' | 'salaries' | 'other';
const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'marketing', label: 'Marketing' },
  { value: 'operating', label: 'Operating' },
  { value: 'salaries', label: 'Salaries' },
  { value: 'other', label: 'Other' },
];
const catLabel = (c: string) => CATEGORIES.find((x) => x.value === c)?.label ?? c;

interface Figures {
  orders_placed: number; gross_order_value: number; delivered_orders: number; delivered_sales: number;
  delivered_item_total: number; delivered_delivery_fees: number; gst_collected: number; commission: number;
  fengle_revenue: number; restaurant_payables_interim: number; rider_payouts: number; rider_payouts_stored: number;
  rider_payouts_estimated: number; rider_payouts_estimated_orders: number; coupon_discounts: number; gateway_charges: number;
  offer_discounts_info: number; refunds_info: number; cancelled_orders: number; cancelled_value: number;
  in_progress_orders: number; in_progress_value: number; expenses: Record<Category, number>; expenses_total: number; net_profit: number;
}
interface Pnl {
  range: { from: string | null; to: string | null };
  group: 'day' | 'month';
  gateway_fee_percent: number;
  formulas: Record<string, string>;
  periods: (Figures & { period: string })[];
  totals: Figures;
}
interface Expense { id: number; date: string; category: Category; amount: number; notes: string | null; created_at: string }
interface ExpenseList { expenses: Expense[]; page: number; limit: number; total: number; total_amount: number; by_category: Record<Category, number> }

const pad = (x: number) => String(x).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const PRESETS: { key: string; label: string; range: () => [string, string] }[] = [
  { key: 'today', label: 'Today', range: () => [ymd(new Date()), ymd(new Date())] },
  { key: 'month', label: 'This month', range: () => { const d = new Date(); return [ymd(new Date(d.getFullYear(), d.getMonth(), 1)), ymd(d)]; } },
  { key: 'last-month', label: 'Last month', range: () => { const d = new Date(); return [ymd(new Date(d.getFullYear(), d.getMonth() - 1, 1)), ymd(new Date(d.getFullYear(), d.getMonth(), 0))]; } },
  { key: '30', label: 'Last 30 days', range: () => [ymd(new Date(Date.now() - 29 * 86400000)), ymd(new Date())] },
];

/** One line of the P&L statement; the formula text shows on hover. */
function Line({ label, value, formula, sign, strong, info, children }: {
  label: ReactNode; value: number; formula?: string; sign?: '+' | '−'; strong?: boolean; info?: boolean; children?: ReactNode;
}) {
  return (
    <div className={`pnl-line ${strong ? 'strong' : ''} ${info ? 'info' : ''}`} title={formula}>
      <div>{label}{children && <div className="cell-sub">{children}</div>}</div>
      <div className="mono" style={{ color: strong ? (value < 0 ? 'var(--red)' : 'var(--green)') : undefined }}>
        {sign && value !== 0 ? `${sign} ` : ''}{money(value)}
      </div>
    </div>
  );
}

export default function Finance() {
  const [tab, setTab] = useState<'pnl' | 'periods' | 'expenses'>('pnl');
  const [preset, setPreset] = useState('month');
  const [[from, to], setRange] = useState<[string, string]>(PRESETS[1].range());
  const [group, setGroup] = useState<'day' | 'month'>('day');
  const toast = useToast();

  const pnl = useQuery({
    queryKey: ['/admin/finance/pnl', from, to, group],
    queryFn: () => api.get<Pnl>('/admin/finance/pnl', { from: from || undefined, to: to || undefined, group }),
  });
  const t = pnl.data?.totals;
  const f = pnl.data?.formulas ?? {};

  async function csv(path: string, name: string) {
    try {
      await download(path, { from: from || undefined, to: to || undefined, group }, `fengle-${name}-${from}-to-${to}.csv`);
    } catch (e) {
      toast(errMsg(e), true);
    }
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Profit &amp; loss</h1>
          <p>Fengle's earnings, costs and net result. Orders count in the period they were placed (India time); expenses by their own date.</p>
        </div>
        <div className="row">
          <button className="btn sm" onClick={() => csv('/admin/finance/pnl.csv', 'pnl')}>P&amp;L CSV</button>
          <button className="btn sm" onClick={() => csv('/admin/finance/orders.csv', 'orders')}>Orders CSV</button>
        </div>
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="chips">
            {PRESETS.map((p) => (
              <button key={p.key} className={`chip-toggle ${preset === p.key ? 'on' : ''}`} onClick={() => { setPreset(p.key); setRange(p.range()); }}>{p.label}</button>
            ))}
          </div>
          <label className="row small muted">From <input className="input" type="date" value={from} onChange={(e) => { setPreset(''); setRange([e.target.value, to]); }} /></label>
          <label className="row small muted">To <input className="input" type="date" value={to} onChange={(e) => { setPreset(''); setRange([from, e.target.value]); }} /></label>
        </div>
        <Tabs value={tab} onChange={setTab} tabs={[
          { value: 'pnl', label: 'Summary' },
          { value: 'periods', label: group === 'day' ? 'Day by day' : 'Month by month' },
          { value: 'expenses', label: 'Expenses' },
        ]} />

        {tab !== 'expenses' && (
          <QueryState isLoading={pnl.isLoading} error={pnl.error}>
            {t && pnl.data && tab === 'pnl' && (
              <div className="stack" style={{ padding: 14 }}>
                <div className="grid-4">
                  <div className="card stat"><div className="label">Delivered sales</div><div className="value">{money(t.delivered_sales)}</div><div className="sub">{num(t.delivered_orders)} of {num(t.orders_placed)} orders delivered</div></div>
                  <div className="card stat"><div className="label">Fengle revenue</div><div className="value">{money(t.fengle_revenue)}</div><div className="sub">Commission + delivery fees</div></div>
                  <div className="card stat"><div className="label">Costs</div><div className="value">{money(t.rider_payouts + t.coupon_discounts + t.gateway_charges + t.expenses_total)}</div><div className="sub">Riders, discounts, gateway, expenses</div></div>
                  <div className={`card stat ${t.net_profit >= 0 ? 'accent' : ''}`}>
                    <div className="label">Net {t.net_profit >= 0 ? 'profit' : 'loss'}</div>
                    <div className="value" style={t.net_profit < 0 ? { color: 'var(--red)' } : undefined}>{money(t.net_profit)}</div>
                    <div className="sub">{pnl.data.range.from ? `${date(pnl.data.range.from)} – ${date(pnl.data.range.to)}` : 'All time'}</div>
                  </div>
                </div>

                <div className="grid-2" style={{ alignItems: 'start' }}>
                  <div className="card card-pad">
                    <h3 style={{ marginBottom: 8 }}>Statement</h3>
                    <Line label="Commission from kitchens" value={t.commission} formula={f.fengle_revenue} />
                    <Line label="Delivery fees" value={t.delivered_delivery_fees} formula={f.fengle_revenue} />
                    <Line label="Fengle revenue" value={t.fengle_revenue} formula={f.fengle_revenue} strong />
                    <Line label="Rider payouts" value={t.rider_payouts} formula={f.rider_payouts} sign="−">
                      {t.rider_payouts_estimated_orders > 0 && `${num(t.rider_payouts_estimated_orders)} older deliveries estimated with today's rates (${money(t.rider_payouts_estimated)})`}
                    </Line>
                    <Line label="Coupon discounts" value={t.coupon_discounts} formula={f.coupon_discounts} sign="−">Fengle-funded</Line>
                    <Line label={`Payment gateway charges (${pnl.data.gateway_fee_percent}%)`} value={t.gateway_charges} formula={f.gateway_charges} sign="−">On online payments only</Line>
                    {CATEGORIES.map((c) => (
                      <Line key={c.value} label={`${c.label} expenses`} value={t.expenses[c.value] ?? 0} sign="−" formula={f.expenses} />
                    ))}
                    <Line label={`Net ${t.net_profit >= 0 ? 'profit' : 'loss'}`} value={t.net_profit} formula={f.net_profit} strong />
                  </div>

                  <div className="card card-pad">
                    <h3 style={{ marginBottom: 8 }}>Not part of Fengle's profit</h3>
                    <Line label={<>Restaurant payables <span className="badge gold">Interim</span></>} value={t.restaurant_payables_interim} formula={f.restaurant_payables_interim} info>
                      Item total minus commission, until the kitchen settlement model is decided
                    </Line>
                    <Line label="GST collected" value={t.gst_collected} formula={f.gst_collected ?? 'GST charged to customers on delivered orders; collected for the government, never revenue'} info>Passed on to the government</Line>
                    <Line label="Dish offer discounts" value={t.offer_discounts_info} formula={f.offer_discounts_info} info>For information: already reflected in lower sales</Line>
                    <Line label="Refunds" value={t.refunds_info} formula={f.refunds_info} info>For information: already reflected in delivered totals</Line>
                    <hr className="sep" />
                    <Line label={`Cancelled orders (${num(t.cancelled_orders)})`} value={t.cancelled_value} formula={f.cancelled_value} info />
                    <Line label={`Still in progress (${num(t.in_progress_orders)})`} value={t.in_progress_value} formula={f.in_progress_value} info>Counted once delivered</Line>
                    <Line label={`Gross order value (${num(t.orders_placed)} placed)`} value={t.gross_order_value} formula={f.gross_order_value} info />
                    <small className="muted">Hover a line to see exactly how it's calculated.{f.basis ? ` ${f.basis}` : ''}</small>
                  </div>
                </div>
              </div>
            )}

            {pnl.data && tab === 'periods' && (
              <>
                <div className="toolbar">
                  <select className="select" value={group} onChange={(e) => setGroup(e.target.value as 'day' | 'month')} aria-label="Group by">
                    <option value="day">Day by day</option>
                    <option value="month">Month by month</option>
                  </select>
                  <span className="muted small">Only {group === 'day' ? 'days' : 'months'} with activity are listed.</span>
                </div>
                {pnl.data.periods.length === 0 ? <Empty title="No activity in this period" /> : (
                  <div className="table-wrap">
                    <table className="tbl">
                      <thead><tr>
                        <th>{group === 'day' ? 'Day' : 'Month'}</th><th className="num">Orders</th><th className="num">Delivered sales</th><th className="num">Revenue</th>
                        <th className="num">Rider payouts</th><th className="num">Discounts + gateway</th><th className="num">Expenses</th><th className="num">Net</th>
                      </tr></thead>
                      <tbody>
                        {pnl.data.periods.map((p) => (
                          <tr key={p.period}>
                            <td className="nowrap">{group === 'day' ? date(p.period) : new Date(`${p.period}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</td>
                            <td className="num">{num(p.delivered_orders)}/{num(p.orders_placed)}</td>
                            <td className="num">{money(p.delivered_sales)}</td>
                            <td className="num">{money(p.fengle_revenue)}</td>
                            <td className="num">{money(p.rider_payouts)}</td>
                            <td className="num">{money(p.coupon_discounts + p.gateway_charges)}</td>
                            <td className="num">{money(p.expenses_total)}</td>
                            <td className="num cell-main" style={{ color: p.net_profit < 0 ? 'var(--red)' : 'var(--green)' }}>{money(p.net_profit)}</td>
                          </tr>
                        ))}
                        <tr className="total-row">
                          <td>Total</td>
                          <td className="num">{num(pnl.data.totals.delivered_orders)}/{num(pnl.data.totals.orders_placed)}</td>
                          <td className="num">{money(pnl.data.totals.delivered_sales)}</td>
                          <td className="num">{money(pnl.data.totals.fengle_revenue)}</td>
                          <td className="num">{money(pnl.data.totals.rider_payouts)}</td>
                          <td className="num">{money(pnl.data.totals.coupon_discounts + pnl.data.totals.gateway_charges)}</td>
                          <td className="num">{money(pnl.data.totals.expenses_total)}</td>
                          <td className="num" style={{ color: pnl.data.totals.net_profit < 0 ? 'var(--red)' : 'var(--green)' }}>{money(pnl.data.totals.net_profit)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </QueryState>
        )}

        {tab === 'expenses' && <Expenses from={from} to={to} />}
      </div>
    </div>
  );
}

function Expenses({ from, to }: { from: string; to: string }) {
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Expense | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const q = useQuery({
    queryKey: ['/admin/expenses', from, to, category, page],
    queryFn: () => api.get<ExpenseList>('/admin/expenses', { from: from || undefined, to: to || undefined, category: category || undefined, page, limit: 50 }),
  });
  const del = useAction((e: Expense) => api.del(`/admin/expenses/${e.id}`), {
    success: 'Expense deleted', invalidate: ['/admin/expenses', '/admin/finance'], onDone: () => setDeleting(null),
  });

  return (
    <>
      <div className="toolbar">
        <select className="select" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} aria-label="Category">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        {q.data && <span className="small">Total: <b>{money(q.data.total_amount)}</b>{!category && <span className="muted"> · {CATEGORIES.map((c) => `${c.label} ${money(q.data!.by_category[c.value] ?? 0)}`).join(' · ')}</span>}</span>}
        <button className="btn primary sm" style={{ marginLeft: 'auto' }} onClick={() => setEditing('new')}>+ Add expense</button>
      </div>
      <QueryState isLoading={q.isLoading} error={q.error}>
        {(q.data?.expenses.length ?? 0) === 0 ? <Empty title="No expenses in this period">Add marketing, operating, salary or other costs so they count in the profit &amp; loss.</Empty> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Date</th><th>Category</th><th>Notes</th><th className="num">Amount</th><th /></tr></thead>
              <tbody>
                {q.data!.expenses.map((e) => (
                  <tr key={e.id}>
                    <td className="nowrap">{date(e.date)}</td>
                    <td><span className="badge">{catLabel(e.category)}</span></td>
                    <td className="small muted">{e.notes || '—'}</td>
                    <td className="num cell-main">{money(e.amount)}</td>
                    <td className="right nowrap">
                      <button className="btn sm ghost" onClick={() => setEditing(e)}>Edit</button>
                      <button className="btn sm ghost" onClick={() => setDeleting(e)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} limit={50} total={q.data?.total} count={q.data?.expenses.length ?? 0} onPage={setPage} />
      </QueryState>
      {editing && <ExpenseForm expense={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <Confirm title="Delete this expense?" danger confirmLabel="Delete" busy={del.isPending} error={del.error}
          message={<>{catLabel(deleting.category)}, {money(deleting.amount)} on {date(deleting.date)}. The profit &amp; loss updates straight away.</>}
          onConfirm={() => del.mutate(deleting)} onClose={() => setDeleting(null)} />
      )}
    </>
  );
}

function ExpenseForm({ expense, onClose }: { expense?: Expense; onClose: () => void }) {
  const [f, setF] = useState({
    date: expense?.date?.slice(0, 10) ?? ymd(new Date()),
    category: (expense?.category ?? 'operating') as Category,
    amount: expense ? String(expense.amount) : '',
    notes: expense?.notes ?? '',
  });
  const [err, setErr] = useState('');
  const save = useAction(async () => {
    const body = { date: f.date, category: f.category, amount: Number(f.amount), notes: f.notes.trim() || null };
    if (expense) await api.patch(`/admin/expenses/${expense.id}`, body);
    else await api.post('/admin/expenses', body);
  }, { success: expense ? 'Expense saved' : 'Expense added', invalidate: ['/admin/expenses', '/admin/finance'], onDone: onClose });

  function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (!f.date) return setErr('Pick the date of the expense.');
    if (!(Number(f.amount) > 0)) return setErr('Enter an amount above zero.');
    save.mutate(undefined);
  }

  return (
    <Modal title={expense ? 'Edit expense' : 'Add expense'} onClose={onClose} footer={<>
      <button className="btn" type="button" onClick={onClose}>Cancel</button>
      <button className="btn primary" form="expense-form" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</button>
    </>}>
      <form id="expense-form" className="stack" onSubmit={submit}>
        <div className="grid-2">
          <Field label="Date"><input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} required /></Field>
          <Field label="Amount (₹)"><input className="input" type="number" min="0.01" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required autoFocus /></Field>
        </div>
        <Field label="Category">
          <select className="select" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as Category })}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Notes (optional)" hint="e.g. Instagram ads, office rent, October salaries."><input className="input" value={f.notes} maxLength={255} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        {(err || save.error) && <div className="alert error">{err || errMsg(save.error)}</div>}
      </form>
    </Modal>
  );
}
