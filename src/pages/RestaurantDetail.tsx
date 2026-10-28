import { useCan } from '../auth';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import type { OrderRow, PartnerStatus, Restaurant } from '../api/types';
import { normalizeRestaurant } from '../api/normalize';
import AgreementSelfie from '../components/AgreementSelfie';
import PartnerDocumentsCard from '../components/PartnerDocuments';
import MapPicker from '../components/MapPicker';
import OrdersTable from '../components/OrdersTable';
import RestaurantForm from '../components/RestaurantForm';
import { Confirm, QueryState, StatusBadge } from '../components/ui';
import { useAllCategories } from '../lib/catalog';
import { useAction } from '../lib/hooks';
import { dateTime, num } from '../lib/format';

async function fetchRestaurant(id: string): Promise<Restaurant> {
  try {
    return normalizeRestaurant(await api.get<Record<string, unknown>>(`/admin/restaurants/${id}`));
  } catch (e) {
    // Fallback until GET /admin/restaurants/:id ships: pick the row from the list (no categories/history).
    if (!(e instanceof ApiError && e.status === 404)) throw e;
    const list = (await api.get<{ restaurants: Restaurant[] }>('/admin/restaurants')).restaurants;
    const r = list.find((x) => String(x.id) === id);
    if (!r) throw new ApiError(404, 'Restaurant not found', null);
    return r;
  }
}

const STATUS_ACTIONS: Record<PartnerStatus, { to: PartnerStatus; label: string; danger?: boolean; note: string }[]> = {
  active: [
    { to: 'inactive', label: 'Pause', note: 'The kitchen stops receiving new orders until it is reactivated. Orders in progress are unaffected.' },
    { to: 'suspended', label: 'Suspend', danger: true, note: 'Suspended kitchens get no new orders. Use this for quality or compliance problems.' },
  ],
  inactive: [{ to: 'active', label: 'Reactivate', note: 'The kitchen starts receiving orders again right away.' }],
  suspended: [{ to: 'active', label: 'Reactivate', note: 'The kitchen starts receiving orders again right away.' }],
};

export default function RestaurantDetail() {
  const { id = '' } = useParams();
  const q = useQuery({ queryKey: ['/admin/restaurants/', id], queryFn: () => fetchRestaurant(id) });
  const orders = useQuery({
    queryKey: ['/admin/orders', { restaurant_id: id }],
    queryFn: () => api.get<{ orders: OrderRow[] }>('/admin/orders', { restaurant_id: id, limit: 10 }),
  });
  const cats = useAllCategories();
  const r = q.data;
  const can = useCan();
  const [edit, setEdit] = useState(false);
  const [statusTo, setStatusTo] = useState<(typeof STATUS_ACTIONS)['active'][number] | null>(null);
  const [addCat, setAddCat] = useState('');
  const [removeCat, setRemoveCat] = useState<{ id: number; name: string } | null>(null);

  const inv = ['/admin/restaurants', '/admin/dashboard', '/admin/categories'];
  const setStatus = useAction((s: PartnerStatus) => api.patch(`/admin/restaurants/${id}`, { status: s }), {
    success: 'Status updated', invalidate: inv, onDone: () => setStatusTo(null),
  });
  const add = useAction((categoryId: number) => api.post(`/admin/restaurants/${id}/categories`, { category_id: categoryId }), {
    success: 'Category added', invalidate: inv, onDone: () => setAddCat(''),
  });
  const remove = useAction((categoryId: number) => api.del(`/admin/restaurants/${id}/categories/${categoryId}`), {
    success: 'Category removed', invalidate: inv, onDone: () => setRemoveCat(null),
  });

  // Hide orders that weren't filtered server-side (older backend ignores restaurant_id).
  const kitchenOrders = (orders.data?.orders ?? []).filter((o) => String(o.restaurant_id) === id);
  const carried = r?.categories ?? [];
  const addable = (cats.data ?? []).filter((c) => (c.is_active === true || c.is_active === 1) && !carried.some((x) => x.id === c.id));

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <div className="small"><Link to="/restaurants">← Restaurants</Link></div>
          <h1 className="row" style={{ marginTop: 6 }}>{r?.name ?? 'Kitchen'} {r && <StatusBadge status={r.status} />}</h1>
          {r?.created_at && <p>Onboarded {dateTime(r.created_at)}</p>}
        </div>
        {r && can('manage') && (
          <div className="row">
            <button className="btn" onClick={() => setEdit(true)}>Edit details</button>
            {STATUS_ACTIONS[r.status].map((a) => (
              <button key={a.to} className={`btn ${a.danger ? 'danger' : ''}`} onClick={() => setStatusTo(a)}>{a.label}</button>
            ))}
          </div>
        )}
      </div>

      <QueryState isLoading={q.isLoading} error={q.error}>
        {r && (
          <>
            <div className="grid-4">
              <div className="card stat"><div className="label">Commission</div><div className="value">{Number(r.commission_rate_percent)}%</div></div>
              <div className="card stat"><div className="label">Radius</div><div className="value">{Number(r.radius_km)} km</div></div>
              <div className="card stat"><div className="label">Orders</div><div className="value">{r.order_count !== undefined ? num(r.order_count) : '—'}</div></div>
              <div className="card stat"><div className="label">Food rating</div><div className="value">{r.rating_avg != null ? `${Number(r.rating_avg).toFixed(1)}★` : '—'}</div></div>
            </div>

            <div className="grid-2" style={{ alignItems: 'start' }}>
              <div className="card card-pad stack">
                <h3>Details</h3>
                <dl className="kv">
                  <dt>Login phone</dt><dd>{r.phone}</dd>
                  <dt>Owner</dt><dd>{r.owner_name || '—'}</dd>
                  <dt>Email</dt><dd>{r.email || '—'}</dd>
                  <dt>Address</dt><dd>{r.address}</dd>
                  <dt>Coordinates</dt><dd className="mono small">{Number(r.lat).toFixed(5)}, {Number(r.lng).toFixed(5)}</dd>
                </dl>
                <MapPicker readOnly lat={Number(r.lat)} lng={Number(r.lng)} radiusKm={Number(r.radius_km)} />
              </div>

              <div className="stack">
                <PartnerDocumentsCard ownerType="restaurant" id={r.id} />
                <AgreementSelfie kind="restaurants" id={r.id} hasSelfie={r.hasAgreementSelfie} acceptedAt={r.agreementAcceptedAt} version={r.agreementVersion} verificationStatus={r.verificationStatus} deniedReason={r.verificationDeniedReason} />
                <div className="card">
                  <div className="card-head"><h3>Categories</h3><span className="muted small">{carried.length} carried</span></div>
                  <div className="card-pad stack">
                    {r.categories === undefined ? (
                      <div className="muted">The kitchen's category list appears once the restaurant detail endpoint is live. You can still add a category below.</div>
                    ) : carried.length === 0 ? <div className="muted">No categories yet — this kitchen won't receive orders.</div> : (
                      <div className="chips">
                        {carried.map((c) => (
                          <span key={c.id} className="badge violet" style={{ paddingRight: 4 }}>
                            {c.name}
                            {can('manage') && <button className="x-btn" style={{ fontSize: 15, padding: '0 4px', color: 'inherit' }} aria-label={`Remove ${c.name}`} onClick={() => setRemoveCat(c)}>×</button>}
                          </span>
                        ))}
                      </div>
                    )}
                    {can('manage') && <div className="row" style={{ flexWrap: 'nowrap' }}>
                      <select className="select" value={addCat} onChange={(e) => setAddCat(e.target.value)} aria-label="Category to add">
                        <option value="">Add a category…</option>
                        {addable.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <button className="btn" disabled={!addCat || add.isPending} onClick={() => add.mutate(Number(addCat))}>Add</button>
                    </div>}
                  </div>
                </div>

                {r.commission_history && r.commission_history.length > 0 && (
                  <div className="card">
                    <div className="card-head"><h3>Commission history</h3></div>
                    <table className="tbl">
                      <thead><tr><th>Effective from</th><th className="num">Rate</th><th>Changed by</th></tr></thead>
                      <tbody>
                        {r.commission_history.map((h) => (
                          <tr key={h.id}><td>{dateTime(h.effective_from)}</td><td className="num">{Number(h.rate_percent)}%</td><td className="muted">{h.changed_by_admin_id ? `Admin #${h.changed_by_admin_id}` : '—'}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-head"><h3>Recent orders</h3><Link className="btn sm" to={`/orders`}>All orders</Link></div>
              <QueryState isLoading={orders.isLoading} error={orders.error}>
                <OrdersTable orders={kitchenOrders} hide={['restaurant']} />
              </QueryState>
            </div>
          </>
        )}
      </QueryState>

      {edit && r && <RestaurantForm restaurant={r} onClose={() => setEdit(false)} />}
      {statusTo && r && (
        <Confirm title={`${statusTo.label} ${r.name}?`} message={statusTo.note} confirmLabel={statusTo.label} danger={statusTo.danger}
          busy={setStatus.isPending} error={setStatus.error} onConfirm={() => setStatus.mutate(statusTo.to)} onClose={() => setStatusTo(null)} />
      )}
      {removeCat && (
        <Confirm title={`Remove ${removeCat.name}?`} danger confirmLabel="Remove"
          message={<>This kitchen will stop receiving <b>{removeCat.name}</b> orders. Customers nearby may lose the category if no other kitchen covers it.</>}
          busy={remove.isPending} error={remove.error} onConfirm={() => remove.mutate(removeCat.id)} onClose={() => setRemoveCat(null)} />
      )}
    </div>
  );
}
