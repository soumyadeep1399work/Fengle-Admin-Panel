import { Fragment, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError, download } from '../api/client';
import type { RestaurantSettlementRow, RestaurantStatement, SettlementStatus } from '../api/types';
import { Empty, Field, Modal, Pager, QueryState, Tabs, errMsg, useToast } from '../components/ui';
import { useAction } from '../lib/hooks';
import { date, dateTime, money, num } from '../lib/format';

// Backend: "Vendor cost, restaurant settlement and profit per product" in fengle-backend/docs/API.md.
// Settlement counts by DELIVERY date (when the kitchen earned it). super_admin + ops.

const STATUS: Record<SettlementStatus, { label: string; tone: string }> = {
  settled: { label: 'Settled', tone: 'green' },
  due: { label: 'Due', tone: 'gold' },
  advance: { label: 'Paid in advance', tone: 'blue' },
};

const pad = (x: number) => String(x).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const nowLocal = () => { const d = new Date(); return `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };

function useRange() {
  const [from, setFrom] = useState(ymd(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [to, setTo] = useState(ymd(new Date()));
  const controls = (
    <>
      <label className="row small muted">From <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
      <label className="row small muted">To <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      {(from || to) && <button className="btn ghost sm" onClick={() => { setFrom(''); setTo(''); }}>All time</button>}
    </>
  );
  return { from, to, controls };
}

/** Kitchen-by-kitchen: earned in the period, paid, and what's owed right now. */
export default function RestaurantSettlements() {
  const nav = useNavigate();
  const toast = useToast();
  const { from, to, controls } = useRange();
  const [paying, setPaying] = useState<{ id: number; name: string; outstanding: number } | null>(null);
  const q = useQuery({
    queryKey: ['/admin/restaurant-settlements', from, to],
    queryFn: () => api.get<{ totals: Record<string, number>; restaurants: RestaurantSettlementRow[] }>('/admin/restaurant-settlements', { from: from || undefined, to: to || undefined }),
  });
  const rows = q.data?.restaurants ?? [];
  const owed = rows.reduce((s, r) => s + Math.max(0, Number(r.outstanding)), 0);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Kitchen settlement</h1>
          <p>What Fengle owes each kitchen: vendor cost × quantity on delivered orders, plus adjustments, minus payments. Coupons and dish offers never reduce it.</p>
        </div>
        <button className="btn sm" onClick={async () => {
          try { await download('/admin/restaurant-settlements.csv', { from: from || undefined, to: to || undefined }, `fengle-kitchen-settlement-${from || 'all'}-to-${to || 'now'}.csv`); }
          catch (e) { toast(errMsg(e), true); }
        }}>Export CSV</button>
      </div>
      <div className="card">
        <div className="toolbar">{controls}</div>
        <QueryState isLoading={q.isLoading} error={q.error}>
          <div className="grid-4" style={{ padding: 14 }}>
            <div className={`card stat ${owed > 0 ? '' : 'accent'}`}><div className="label">Owed to kitchens now</div><div className="value" style={owed > 0 ? { color: 'var(--red)' } : undefined}>{money(owed)}</div><div className="sub">{rows.filter((r) => r.status === 'due').length} kitchens due</div></div>
            <div className="card stat"><div className="label">Earned in period</div><div className="value">{money(rows.reduce((s, r) => s + Number(r.payable_earned), 0))}</div><div className="sub">{num(rows.reduce((s, r) => s + r.delivered_orders, 0))} delivered orders</div></div>
            <div className="card stat"><div className="label">Paid in period</div><div className="value">{money(rows.reduce((s, r) => s + Number(r.paid), 0))}</div></div>
            <div className="card stat"><div className="label">Estimated orders</div><div className="value">{num(rows.reduce((s, r) => s + r.estimated_orders, 0))}</div><div className="sub">Dishes without a vendor cost used the old commission %</div></div>
          </div>
          {rows.length === 0 ? <Empty title="No kitchens yet" /> : (
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Kitchen</th><th>Status</th><th className="num">Orders</th><th className="num">Earned</th><th className="num">Adjustments</th><th className="num">Paid</th><th className="num">Owed now</th><th>Last paid</th><th /></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.restaurant_id} className="clickable" onClick={() => nav(`/restaurants/${r.restaurant_id}/settlement`)}>
                      <td><div className="cell-main">{r.restaurant_name}</div>{r.has_estimated_payables && <div className="cell-sub" style={{ color: 'var(--gold-ink)' }}>{num(r.estimated_orders)} estimated orders</div>}</td>
                      <td><span className={`badge ${STATUS[r.status].tone}`}>{STATUS[r.status].label}</span></td>
                      <td className="num">{num(r.delivered_orders)}</td>
                      <td className="num">{money(r.payable_earned)}</td>
                      <td className="num">{Number(r.adjustments) === 0 ? '—' : money(r.adjustments)}</td>
                      <td className="num">{money(r.paid)}</td>
                      <td className="num cell-main" style={{ color: Number(r.outstanding) > 0 ? 'var(--red)' : undefined }}>{money(r.outstanding)}</td>
                      <td className="small nowrap">{r.last_payment_at ? date(r.last_payment_at) : <span className="muted">Never</span>}</td>
                      <td className="right" onClick={(e) => e.stopPropagation()}>
                        {Number(r.outstanding) > 0 && <button className="btn sm" onClick={() => setPaying({ id: r.restaurant_id, name: r.restaurant_name, outstanding: Number(r.outstanding) })}>Record payment</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </QueryState>
        <div className="pager"><span className="muted small">Earned, adjustments and paid are for the chosen period (by delivery date). "Owed now" is the kitchen's balance today.</span></div>
      </div>
      {paying && <PaymentForm restaurant={paying} onClose={() => setPaying(null)} />}
    </div>
  );
}

const METHODS = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
];

function PaymentForm({ restaurant, onClose }: { restaurant: { id: number; name: string; outstanding: number }; onClose: () => void }) {
  const [amount, setAmount] = useState(restaurant.outstanding > 0 ? String(restaurant.outstanding) : '');
  const [paidAt, setPaidAt] = useState(nowLocal());
  const [method, setMethod] = useState('bank_transfer');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [advance, setAdvance] = useState(false);
  const [err, setErr] = useState('');
  const save = useAction(() => api.post(`/admin/restaurants/${restaurant.id}/payments`, {
    amount: Number(amount), paid_at: new Date(paidAt).toISOString(), method,
    reference: reference.trim() || undefined, notes: notes.trim() || undefined, allow_advance: advance || undefined,
  }), { success: `${money(Number(amount))} payment recorded`, invalidate: ['/admin/restaurant-settlements', '/admin/restaurants/', '/admin/restaurant-payments'], onDone: onClose });

  const over = Number(amount) > restaurant.outstanding;
  function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (!(Number(amount) > 0)) return setErr('Enter the amount paid.');
    if (method !== 'cash' && !reference.trim()) return setErr('Enter the UTR / transaction reference.');
    if (over && !advance) return setErr(`That's more than the ${money(restaurant.outstanding)} owed. Tick "Pay in advance" if that's intended.`);
    if (new Date(paidAt).getTime() > Date.now() + 60_000) return setErr('The payment date can’t be in the future.');
    save.mutate(undefined);
  }
  const serverOutstanding = save.error instanceof ApiError ? (save.error.body as { outstanding?: number } | null)?.outstanding : undefined;

  return (
    <Modal title={`Pay ${restaurant.name}`} onClose={onClose} footer={<>
      <button className="btn" type="button" onClick={onClose}>Cancel</button>
      <button className="btn primary" form="pay-form" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Record payment'}</button>
    </>}>
      <form id="pay-form" className="stack" onSubmit={submit}>
        <div className="alert info">Fengle owes this kitchen <b>{money(restaurant.outstanding)}</b> right now. Record a payment after you've actually sent the money.</div>
        <div className="grid-2">
          <Field label="Amount (₹)"><input className="input" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></Field>
          <Field label="Paid on"><input className="input" type="datetime-local" value={paidAt} max={nowLocal()} onChange={(e) => setPaidAt(e.target.value)} /></Field>
          <Field label="Method">
            <select className="select" value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select>
          </Field>
          <Field label={method === 'cash' ? 'Reference (optional)' : 'UTR / reference'}><input className="input mono" value={reference} maxLength={100} onChange={(e) => setReference(e.target.value)} /></Field>
        </div>
        <Field label="Notes (optional)"><input className="input" value={notes} maxLength={255} onChange={(e) => setNotes(e.target.value)} /></Field>
        {over && <label className="check"><input type="checkbox" checked={advance} onChange={(e) => setAdvance(e.target.checked)} /> Pay in advance (more than currently owed)</label>}
        {(err || save.error) && <div className="alert error">{err || errMsg(save.error)}{serverOutstanding !== undefined && <> Owed: {money(serverOutstanding)}.</>}</div>}
      </form>
    </Modal>
  );
}

function AdjustmentForm({ restaurantId, onClose }: { restaurantId: number; onClose: () => void }) {
  const [direction, setDirection] = useState<'owe' | 'deduct'>('deduct');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [orderId, setOrderId] = useState('');
  const [err, setErr] = useState('');
  const save = useAction(() => api.post(`/admin/restaurants/${restaurantId}/adjustments`, {
    amount: (direction === 'deduct' ? -1 : 1) * Number(amount), reason: reason.trim(), related_order_id: orderId ? Number(orderId) : undefined,
  }), { success: 'Adjustment recorded', invalidate: ['/admin/restaurant-settlements', '/admin/restaurants/'], onDone: onClose });
  function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (!(Number(amount) > 0)) return setErr('Enter an amount above zero.');
    if (!reason.trim()) return setErr('Write the reason; it appears on the kitchen’s statement.');
    save.mutate(undefined);
  }
  return (
    <Modal title="Add adjustment" onClose={onClose} footer={<>
      <button className="btn" type="button" onClick={onClose}>Cancel</button>
      <button className="btn primary" form="adj-form" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Add adjustment'}</button>
    </>}>
      <form id="adj-form" className="stack" onSubmit={submit}>
        <p className="muted" style={{ margin: 0 }}>For anything agreed outside the app, e.g. a penalty for a kitchen-caused cancellation, or a goodwill top-up.</p>
        <div className="row">
          <label className="check"><input type="radio" checked={direction === 'deduct'} onChange={() => setDirection('deduct')} /> Deduct from what we owe</label>
          <label className="check"><input type="radio" checked={direction === 'owe'} onChange={() => setDirection('owe')} /> Add to what we owe</label>
        </div>
        <div className="grid-2">
          <Field label="Amount (₹)"><input className="input" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></Field>
          <Field label="Related order # (optional)"><input className="input" inputMode="numeric" value={orderId} onChange={(e) => setOrderId(e.target.value.replace(/\D/g, ''))} /></Field>
        </div>
        <Field label="Reason"><input className="input" value={reason} maxLength={255} onChange={(e) => setReason(e.target.value)} /></Field>
        {(err || save.error) && <div className="alert error">{err || errMsg(save.error)}</div>}
      </form>
    </Modal>
  );
}

/** One kitchen's statement: balance, day-wise and order-wise detail, payments and adjustments. */
export function RestaurantStatementPage() {
  const { id = '' } = useParams();
  const toast = useToast();
  const { from, to, controls } = useRange();
  const [tab, setTab] = useState<'orders' | 'days' | 'payments' | 'adjustments'>('orders');
  const [page, setPage] = useState(1);
  const [paying, setPaying] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const q = useQuery({
    queryKey: ['/admin/restaurants/', id, 'settlement', from, to, page],
    queryFn: () => api.get<RestaurantStatement>(`/admin/restaurants/${id}/settlement`, { from: from || undefined, to: to || undefined, page, limit: 50 }),
  });
  const s = q.data;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <div className="small"><Link to="/restaurant-settlements">← Kitchen settlement</Link> · <Link to={`/restaurants/${id}`}>Kitchen page</Link></div>
          <h1 className="row" style={{ marginTop: 6 }}>{s?.restaurant.name ?? 'Kitchen'} {s && <span className={`badge ${STATUS[s.status].tone}`}>{STATUS[s.status].label}</span>}</h1>
          {s && <p>Owed now: <b style={{ color: Number(s.outstanding_now) > 0 ? 'var(--red)' : undefined }}>{money(s.outstanding_now)}</b></p>}
        </div>
        <div className="row">
          <button className="btn" onClick={() => setAdjusting(true)}>Add adjustment</button>
          <button className="btn primary" onClick={() => setPaying(true)}>Record payment</button>
          <button className="btn sm" onClick={async () => {
            try { await download(`/admin/restaurants/${id}/settlement.csv`, { from: from || undefined, to: to || undefined }, `fengle-kitchen-${id}-statement-${from || 'all'}-to-${to || 'now'}.csv`); }
            catch (e) { toast(errMsg(e), true); }
          }}>Statement CSV</button>
        </div>
      </div>
      <div className="card">
        <div className="toolbar">{controls}</div>
        <QueryState isLoading={q.isLoading} error={q.error}>
          {s && (
            <>
              <div className="grid-4" style={{ padding: 14 }}>
                <div className="card stat"><div className="label">Opening balance</div><div className="value">{money(s.opening_balance)}</div><div className="sub">Owed at the start of the period</div></div>
                <div className="card stat"><div className="label">Earned</div><div className="value">{money(s.payable_earned)}</div><div className="sub">{num(s.total_orders)} delivered orders{s.estimated_orders ? ` · ${s.estimated_orders} estimated` : ''}</div></div>
                <div className="card stat"><div className="label">Paid</div><div className="value">{money(s.paid_total)}</div><div className="sub">Adjustments {Number(s.adjustments_total) > 0 ? '+' : ''}{money(s.adjustments_total)}</div></div>
                <div className="card stat accent"><div className="label">Closing balance</div><div className="value">{money(s.closing_balance)}</div><div className="sub">Owed at the end of the period</div></div>
              </div>
              <Tabs value={tab} onChange={setTab} tabs={[
                { value: 'orders', label: 'Orders', count: s.total_orders },
                { value: 'days', label: 'By day', count: s.days.length },
                { value: 'payments', label: 'Payments', count: s.payments.length },
                { value: 'adjustments', label: 'Adjustments', count: s.adjustments.length },
              ]} />
              {tab === 'orders' && (s.orders.length === 0 ? <Empty title="No delivered orders in this period" /> : (
                <div className="table-wrap">
                  <table className="tbl">
                    <thead><tr><th>Order</th><th>Delivered</th><th className="num">Customer paid (items)</th><th className="num">We owe kitchen</th><th /></tr></thead>
                    <tbody>
                      {s.orders.map((o) => (
                        <Fragment key={o.order_id}>
                          <tr className="clickable" onClick={() => setOpen(open === o.order_id ? null : o.order_id)}>
                            <td><Link className="cell-main" to={`/orders/${o.order_id}`} onClick={(e) => e.stopPropagation()}>#{o.order_id}</Link>{o.estimated && <span className="badge gold" style={{ marginLeft: 6 }}>Estimated</span>}</td>
                            <td className="small nowrap">{dateTime(o.delivered_at)}</td>
                            <td className="num">{money(o.customer_paid_items)}</td>
                            <td className="num cell-main">{money(o.payable)}</td>
                            <td className="right small muted">{open === o.order_id ? 'Hide' : 'Dishes'}</td>
                          </tr>
                          {open === o.order_id && (
                            <tr><td colSpan={5} style={{ background: '#fdfbf8' }}>
                              {o.items.map((l) => (
                                <div key={l.item_id} className="row between small" style={{ padding: '3px 0' }}>
                                  <span>{l.quantity} × {l.name} <span className="muted">(customer {money(l.unit_price)})</span>{l.estimated && <span className="badge gold" style={{ marginLeft: 6 }}>no vendor cost</span>}</span>
                                  <span className="mono">{l.vendor_cost != null ? `${l.quantity} × ${money(l.vendor_cost)} = ` : 'estimated: '}<b>{money(l.line_cost)}</b></span>
                                </div>
                              ))}
                            </td></tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
              {tab === 'orders' && <Pager page={page} limit={50} total={s.total_orders} count={s.orders.length} onPage={setPage} />}
              {tab === 'days' && (s.days.length === 0 ? <Empty title="No deliveries in this period" /> : (
                <table className="tbl">
                  <thead><tr><th>Day</th><th className="num">Orders</th><th className="num">Earned</th></tr></thead>
                  <tbody>{s.days.map((d) => <tr key={d.date}><td>{date(d.date)}</td><td className="num">{num(d.orders)}{d.estimated_orders ? <span className="cell-sub"> ({d.estimated_orders} est.)</span> : ''}</td><td className="num">{money(d.payable)}</td></tr>)}</tbody>
                </table>
              ))}
              {tab === 'payments' && (s.payments.length === 0 ? <Empty title="No payments in this period" /> : (
                <table className="tbl">
                  <thead><tr><th>Paid on</th><th>Method</th><th>Reference</th><th>Notes</th><th>Recorded by</th><th className="num">Amount</th></tr></thead>
                  <tbody>{s.payments.map((p) => (
                    <tr key={p.id}><td className="nowrap">{dateTime(p.paid_at)}</td><td>{METHODS.find((m) => m.value === p.method)?.label ?? p.method ?? '—'}</td><td className="mono small">{p.reference || '—'}</td><td className="small muted">{p.notes || '—'}</td><td className="small">{p.recorded_by_admin_name || (p.recorded_by_admin_id ? `Admin #${p.recorded_by_admin_id}` : '—')}</td><td className="num cell-main">{money(p.amount)}</td></tr>
                  ))}</tbody>
                </table>
              ))}
              {tab === 'adjustments' && (s.adjustments.length === 0 ? <Empty title="No adjustments in this period" /> : (
                <table className="tbl">
                  <thead><tr><th>When</th><th>Reason</th><th>Order</th><th>By</th><th className="num">Amount</th></tr></thead>
                  <tbody>{s.adjustments.map((a) => (
                    <tr key={a.id}><td className="nowrap">{dateTime(a.created_at)}</td><td>{a.reason}</td><td>{a.related_order_id ? <Link to={`/orders/${a.related_order_id}`}>#{a.related_order_id}</Link> : '—'}</td><td className="small">{a.created_by_admin_name || (a.created_by_admin_id ? `Admin #${a.created_by_admin_id}` : '—')}</td>
                      <td className="num cell-main" style={{ color: Number(a.amount) < 0 ? 'var(--red)' : 'var(--green)' }}>{Number(a.amount) > 0 ? '+' : ''}{money(a.amount)}</td></tr>
                  ))}</tbody>
                </table>
              ))}
            </>
          )}
        </QueryState>
      </div>
      {paying && s && <PaymentForm restaurant={{ id: s.restaurant.id, name: s.restaurant.name, outstanding: Number(s.outstanding_now) }} onClose={() => setPaying(false)} />}
      {adjusting && <AdjustmentForm restaurantId={Number(id)} onClose={() => setAdjusting(false)} />}
    </div>
  );
}
