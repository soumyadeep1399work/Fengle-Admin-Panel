import { useCan } from '../auth';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import type { OrderDetail as Order, OrderItem, Rider } from '../api/types';
import { normalizeOrder } from '../api/normalize';
import { Confirm, Field, Modal, QueryState, StatusBadge } from '../components/ui';
import LedgerTable from '../components/LedgerTable';
import { useAction } from '../lib/hooks';
import { dateTime, money, PAYMENT_LABEL } from '../lib/format';

async function fetchOrder(id: string): Promise<Order> {
  try {
    return normalizeOrder(await api.get<Record<string, unknown>>(`/admin/orders/${id}`));
  } catch (e) {
    // Until the admin detail route ships, fall back to the shared order endpoint (admins are allowed on it).
    if (!(e instanceof ApiError && e.notBuilt)) throw e;
    const res = await api.get<{ order: Order; items: OrderItem[] }>(`/orders/${id}`);
    return { ...res.order, items: res.items };
  }
}

const STEPS: { key: keyof Order; label: string }[] = [
  { key: 'created_at', label: 'Placed' },
  { key: 'accepted_at', label: 'Accepted by kitchen' },
  { key: 'preparation_started_at', label: 'Preparing' },
  { key: 'ready_at', label: 'Ready for pickup' },
  { key: 'picked_up_at', label: 'Picked up' },
  { key: 'delivered_at', label: 'Delivered' },
];

export default function OrderDetail() {
  const { id = '' } = useParams();
  const q = useQuery({ queryKey: ['/admin/orders/', id], queryFn: () => fetchOrder(id), refetchInterval: 20_000 });
  const o = q.data;
  const can = useCan();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);

  const cancel = useAction((reason: string) => api.post(`/admin/orders/${id}/cancel`, { reason }), {
    success: `Order #${id} cancelled`, invalidate: ['/admin/orders', '/admin/dashboard'], onDone: () => setCancelOpen(false),
  });

  const open = o && o.status !== 'delivered' && o.status !== 'cancelled';
  const items = o?.items ?? [];
  const dropped = items.filter((i) => i.status === 'dropped_unavailable');

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <div className="small"><Link to="/orders">← Orders</Link></div>
          <h1 className="row" style={{ marginTop: 6 }}>Order #{id} {o && <StatusBadge status={o.status} />}
            {o && (o.is_clubbed === true || o.is_clubbed === 1) && <span className="badge gold">Clubbed</span>}
          </h1>
          {o && <p>Placed {dateTime(o.created_at)}</p>}
        </div>
        {open && (
          <div className="row">
            {o.status !== 'placed' && can('manage') && <button className="btn" onClick={() => setReassignOpen(true)}>Reassign rider</button>}
            {can('cancel_order') && <button className="btn danger" onClick={() => setCancelOpen(true)}>Cancel order</button>}
          </div>
        )}
      </div>

      <QueryState isLoading={q.isLoading} error={q.error}>
        {o && (
          <>
            <div className="grid-3">
              <div className="card card-pad stack" style={{ gap: 8 }}>
                <h3>Customer</h3>
                {o.customer ? (
                  <>
                    <Link to={`/customers/${o.customer.id}`} className="cell-main">{o.customer.name || 'Unnamed customer'}</Link>
                    <div>{o.customer.phone}</div>
                  </>
                ) : <Link to={`/customers/${o.customer_id}`}>Customer #{o.customer_id}</Link>}
                <div className="muted small">{o.delivery_address}</div>
              </div>
              <div className="card card-pad stack" style={{ gap: 8 }}>
                <h3>Kitchen</h3>
                {o.restaurant_id ? (
                  <>
                    <Link to={`/restaurants/${o.restaurant_id}`} className="cell-main">{o.restaurant?.name || o.restaurant_name || `Restaurant #${o.restaurant_id}`}</Link>
                    {o.restaurant?.phone && <div>{o.restaurant.phone}</div>}
                    {o.restaurant?.address && <div className="muted small">{o.restaurant.address}</div>}
                  </>
                ) : <div className="muted">Not routed yet</div>}
                {!!o.cascade_attempts && o.cascade_attempts > 1 && <div className="badge gold">Cascaded {o.cascade_attempts}×</div>}
              </div>
              <div className="card card-pad stack" style={{ gap: 8 }}>
                <h3>Rider</h3>
                {o.rider_id ? (
                  <>
                    <Link to={`/riders/${o.rider_id}`} className="cell-main">{o.rider?.name || o.rider_name || `Rider #${o.rider_id}`}</Link>
                    {o.rider?.phone && <div>{o.rider.phone}</div>}
                    {o.eta_minutes != null && <div className="muted small">ETA set at pickup: {o.eta_minutes} min</div>}
                  </>
                ) : <div className="muted">No rider assigned</div>}
              </div>
            </div>

            <div className="grid-2" style={{ alignItems: 'start' }}>
              <div className="card">
                <div className="card-head"><h3>Items</h3>{dropped.length > 0 && <span className="badge red">{dropped.length} dropped</span>}</div>
                <div className="table-wrap">
                  <table className="tbl">
                    <thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Price</th><th className="num">Subtotal</th></tr></thead>
                    <tbody>
                      {items.map((it) => (
                        <tr key={it.id} style={it.status === 'dropped_unavailable' ? { opacity: 0.55 } : undefined}>
                          <td>
                            <div className="cell-main" style={it.status === 'dropped_unavailable' ? { textDecoration: 'line-through' } : undefined}>{it.item_name || it.name}</div>
                            <div className="cell-sub">{it.category_name}{it.portion_label && ` · ${it.portion_label}`}{it.status === 'dropped_unavailable' && ' · unavailable, refunded'}</div>
                          </td>
                          <td className="num">{it.quantity}</td>
                          <td className="num">{money(it.unit_price)}</td>
                          <td className="num">{money(it.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="card-pad">
                  <dl className="kv">
                    <dt>Item total</dt><dd className="mono">{money(o.item_total)}</dd>
                    {o.cgst_amount !== undefined && <><dt>CGST + SGST</dt><dd className="mono">{money(Number(o.cgst_amount) + Number(o.sgst_amount ?? 0))}</dd></>}
                    <dt>Delivery fee</dt><dd className="mono">{money(o.delivery_fee)}</dd>
                    {o.wallet_used !== undefined && Number(o.wallet_used) > 0 && <><dt>Wallet used</dt><dd className="mono">−{money(o.wallet_used)}</dd></>}
                    <dt><b>Grand total</b></dt><dd className="mono"><b>{money(o.grand_total)}</b></dd>
                    {o.commission_amount !== undefined && <><dt>Platform commission</dt><dd className="mono">{money(o.commission_amount)}</dd></>}
                    <dt>Payment</dt><dd>{PAYMENT_LABEL[o.payment_method] ?? o.payment_method} · <StatusBadge status={o.payment_status} /></dd>
                    {o.razorpay_payment_id && <><dt>Razorpay ID</dt><dd className="mono small">{o.razorpay_payment_id}</dd></>}
                  </dl>
                </div>
              </div>

              <div className="stack">
                <div className="card card-pad">
                  <h3 style={{ marginBottom: 10 }}>Timeline</h3>
                  <ul className="timeline">
                    {STEPS.map((s) => {
                      const at = o[s.key] as string | null | undefined;
                      if (at === undefined && s.key !== 'created_at') return null;
                      return (
                        <li key={s.key} className={at ? 'done' : ''}>
                          <span className="tdot" /><span>{s.label}</span><span className="muted small">{at ? dateTime(at) : ''}</span>
                        </li>
                      );
                    })}
                    {o.cancelled_at && (
                      <li className="done"><span className="tdot" style={{ background: 'var(--red)' }} /><span>Cancelled{o.cancel_reason ? ` — ${o.cancel_reason}` : ''}</span><span className="muted small">{dateTime(o.cancelled_at)}</span></li>
                    )}
                    {o.rider_settled_at && (
                      <li className="done"><span className="tdot" style={{ background: 'var(--green)' }} /><span>Rider settled</span><span className="muted small">{dateTime(o.rider_settled_at)}</span></li>
                    )}
                  </ul>
                </div>
                {(o.restaurant_rating != null || o.rider_rating != null) && (
                  <div className="card card-pad">
                    <h3 style={{ marginBottom: 10 }}>Ratings</h3>
                    <dl className="kv">
                      {o.restaurant_rating != null && <><dt>Food</dt><dd>{'★'.repeat(o.restaurant_rating)} {o.restaurant_rating_comment && <span className="muted">“{o.restaurant_rating_comment}”</span>}</dd></>}
                      {o.rider_rating != null && <><dt>Rider</dt><dd>{'★'.repeat(o.rider_rating)} {o.rider_rating_comment && <span className="muted">“{o.rider_rating_comment}”</span>}</dd></>}
                    </dl>
                  </div>
                )}
              </div>
            </div>

            {o.ledger && o.ledger.length > 0 && (
              <div className="card">
                <div className="card-head"><h3>Wallet movements for this order</h3></div>
                <LedgerTable entries={o.ledger} showOwner />
              </div>
            )}
          </>
        )}
      </QueryState>

      {cancelOpen && o && (
        <Confirm title={`Cancel order #${id}?`} danger confirmLabel="Cancel order" reasonLabel="Reason (kept on the order)"
          message={o.payment_status === 'paid'
            ? <>The customer paid {money(o.grand_total)} by {PAYMENT_LABEL[o.payment_method]}. It will be refunded to their Fengle wallet.</>
            : <>No payment was captured, so there is nothing to refund.</>}
          busy={cancel.isPending} error={cancel.error} onConfirm={(r) => cancel.mutate(r)} onClose={() => setCancelOpen(false)} />
      )}
      {reassignOpen && <ReassignRider orderId={id} current={o?.rider_id ?? null} onClose={() => setReassignOpen(false)} />}
    </div>
  );
}

function ReassignRider({ orderId, current, onClose }: { orderId: string; current: number | null; onClose: () => void }) {
  const riders = useQuery({
    queryKey: ['/admin/riders', 'active-picker'],
    queryFn: () => api.get<{ riders: Rider[] }>('/admin/riders', { status: 'active', limit: 200 }),
  });
  const [riderId, setRiderId] = useState('');
  const act = useAction(() => api.post(`/admin/orders/${orderId}/reassign-rider`, { rider_id: Number(riderId) }), {
    success: 'Rider reassigned', invalidate: ['/admin/orders'], onDone: onClose,
  });
  const options = (riders.data?.riders ?? []).filter((r) => r.status === 'active' && r.id !== current);
  return (
    <Modal title="Reassign rider" onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Back</button>
      <button className="btn primary" disabled={!riderId || act.isPending} onClick={() => act.mutate(undefined)}>{act.isPending ? 'Saving…' : 'Reassign'}</button>
    </>}>
      <p className="muted" style={{ margin: 0 }}>Use this when the assigned rider can't complete the delivery. The new rider is notified.</p>
      <QueryState isLoading={riders.isLoading} error={riders.error}>
        <Field label="New rider">
          <select className="select" value={riderId} onChange={(e) => setRiderId(e.target.value)}>
            <option value="">Choose an active rider…</option>
            {options.map((r) => <option key={r.id} value={r.id}>{r.name || 'Unnamed'} · {r.phone}</option>)}
          </select>
        </Field>
      </QueryState>
    </Modal>
  );
}
