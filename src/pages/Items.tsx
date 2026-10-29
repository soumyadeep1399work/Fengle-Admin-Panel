import { useCan } from '../auth';
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Item, QuantityUnit } from '../api/types';
import ImageUpload from '../components/ImageUpload';
import { Empty, Field, Modal, QueryState, Tabs, useDebounced, errMsg } from '../components/ui';
import { useAllCategories } from '../lib/catalog';
import { useAction, useList } from '../lib/hooks';
import { bool, dateTime, money } from '../lib/format';

const QUANTITY_UNITS: { value: QuantityUnit; label: string }[] = [
  { value: 'pc', label: 'pc (pieces)' },
  { value: 'gm', label: 'gm (grams)' },
  { value: 'kg', label: 'kg' },
  { value: 'ml', label: 'ml' },
  { value: 'ltr', label: 'ltr (litres)' },
];

type View = 'all' | 'awaiting' | 'nocost' | 'hidden';

function VegMark({ veg }: { veg: boolean }) {
  const c = veg ? 'var(--green)' : 'var(--red)';
  return (
    <span title={veg ? 'Veg' : 'Non-veg'} style={{ display: 'inline-grid', placeItems: 'center', width: 14, height: 14, border: `1.5px solid ${c}`, borderRadius: 3, verticalAlign: 'middle' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />
    </span>
  );
}

/** Price cell: waiting for a price, an offer in force (struck normal price), or the plain price. */
function PriceCell({ it }: { it: Item }) {
  if (bool(it.awaiting_price)) return <span className="badge gold">Waiting for price</span>;
  if (bool(it.offer_active) && it.offer_price != null) {
    return (
      <div>
        <span className="muted" style={{ textDecoration: 'line-through', marginRight: 6 }}>{money(it.price)}</span>
        <span className="cell-main" style={{ color: 'var(--green)' }}>{money(it.offer_price)}</span>
        <div className="cell-sub">{it.offer_ends_at ? `Offer till ${dateTime(it.offer_ends_at)}` : 'Offer, no end date'}</div>
      </div>
    );
  }
  return (
    <div>
      <span className="cell-main">{money(it.price)}</span>
      {it.offer_price != null && !bool(it.offer_active) && <div className="cell-sub">Offer ended</div>}
    </div>
  );
}

export default function Items() {
  const [params, setParams] = useSearchParams();
  const categoryId = params.get('category_id') ?? '';
  const view = (params.get('view') ?? 'all') as View;
  const [search, setSearch] = useState('');
  const dq = useDebounced(search);
  const cats = useAllCategories();
  const can = useCan();
  const [editing, setEditing] = useState<Item | 'new' | null>(null);
  const { data, isLoading, error } = useList<Item>('/admin/items', 'items', {
    category_id: categoryId || undefined,
    q: dq || undefined,
    awaiting_price: view === 'awaiting' ? 1 : undefined,
    missing_vendor_cost: view === 'nocost' ? 1 : undefined,
    is_active: view === 'hidden' ? 0 : undefined,
    limit: 500,
  });
  // Separate tiny query so the tab can show how many dishes are waiting, whichever tab is open.
  const awaiting = useList<Item>('/admin/items', 'items', { awaiting_price: 1, limit: 500 });
  const awaitingCount = awaiting.data?.total ?? awaiting.data?.rows.length;
  const catName = (id: number) => cats.data?.find((c) => c.id === id)?.name ?? `#${id}`;
  // vendor_cost is only sent to super_admin/ops; Support never sees costs or margins.
  const showCost = (data?.rows ?? []).some((it) => 'vendor_cost' in it) || view === 'nocost';
  const setParam = (k: string, v: string) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v); else n.delete(k);
    setParams(n, { replace: true });
  };

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Items</h1>
          <p>The shared menu. Every kitchen carrying a category sells that category's items. Only admins set prices; dishes a kitchen proposes wait here for a price.</p>
        </div>
        {can('manage') && <button className="btn primary" onClick={() => setEditing('new')}>+ New item</button>}
      </div>
      <div className="card">
        <Tabs value={view} onChange={(v) => setParam('view', v === 'all' ? '' : v)} tabs={[
          { value: 'all', label: 'All' },
          { value: 'awaiting', label: 'Waiting for price', count: awaitingCount },
          { value: 'nocost', label: 'Missing vendor cost' },
          { value: 'hidden', label: 'Hidden' },
        ]} />
        <div className="toolbar">
          <input className="input search" placeholder="Search dishes" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="select" value={categoryId} aria-label="Category" onChange={(e) => setParam('category_id', e.target.value)}>
            <option value="">All categories</option>
            {(cats.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <QueryState isLoading={isLoading} error={error}>
          {(data?.rows.length ?? 0) === 0 ? (
            <Empty title={view === 'awaiting' ? 'No dishes waiting for a price' : view === 'nocost' ? 'Every dish has a vendor cost' : 'No items'} />
          ) : (
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Item</th><th>Category</th><th>Added by</th><th>Status</th><th className="num">Price</th>{showCost && <th className="num">Vendor cost · margin</th>}</tr></thead>
                <tbody>
                  {data!.rows.map((it) => (
                    <tr key={it.id} className={can('manage') ? 'clickable' : undefined} onClick={can('manage') ? () => setEditing(it) : undefined}>
                      <td>
                        <div className="row" style={{ flexWrap: 'nowrap' }}>
                          {it.image_url ? <img className="thumb" src={it.image_url} alt="" /> : <div className="thumb" />}
                          <div>
                            <div className="cell-main"><VegMark veg={bool(it.is_veg)} /> {it.name}{it.portion_label && <span className="badge" style={{ marginLeft: 6 }}>{it.portion_label}</span>}</div>
                            <div className="cell-sub" style={{ maxWidth: 380 }}>{it.description}</div>
                          </div>
                        </div>
                      </td>
                      <td>{it.category_name ?? catName(it.category_id)}</td>
                      <td className="small">
                        {it.created_by_type === 'restaurant'
                          ? <>{it.created_by_restaurant_name || 'Kitchen'}<div className="cell-sub">Kitchen</div></>
                          : <span className="muted">Fengle</span>}
                      </td>
                      <td>
                        {bool(it.awaiting_price) ? <span className="badge gold">Not published</span>
                          : it.is_active === undefined || bool(it.is_active) ? <span className="badge green">Active</span> : <span className="badge">Hidden</span>}
                      </td>
                      <td className="num"><PriceCell it={it} /></td>
                      {showCost && (
                        <td className="num">
                          {it.vendor_cost == null ? <span className="badge gold">Not set</span> : (
                            <>
                              <div>{money(it.vendor_cost)}</div>
                              {it.margin != null && <div className="cell-sub" style={{ color: Number(it.margin) < 0 ? 'var(--red)' : 'var(--green)' }}>{money(it.margin)}{it.margin_percent != null ? ` · ${Number(it.margin_percent).toFixed(0)}%` : ''}</div>}
                            </>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </QueryState>
      </div>
      {editing && <ItemForm item={editing === 'new' ? undefined : editing} defaultCategory={categoryId} onClose={() => setEditing(null)} />}
    </div>
  );
}

/** datetime-local value (local time) <-> ISO */
function toLocalInput(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function ItemForm({ item, defaultCategory, onClose }: { item?: Item; defaultCategory: string; onClose: () => void }) {
  const cats = useAllCategories();
  const awaitingPrice = !!item && bool(item.awaiting_price);
  const initialOffer = item?.offer_price != null ? String(Number(item.offer_price)) : '';
  const initialEnds = toLocalInput(item?.offer_ends_at);
  const [f, setF] = useState({
    category_id: item ? String(item.category_id) : defaultCategory,
    name: item?.name ?? '',
    description: item?.description ?? '',
    price: item && item.price != null ? String(Number(item.price)) : '',
    quantity_value: item?.quantity_value != null ? String(Number(item.quantity_value)) : '',
    quantity_unit: (item?.quantity_unit ?? '') as QuantityUnit | '',
    is_veg: item ? bool(item.is_veg) : true,
    image_url: item?.image_url ?? '',
    // A dish waiting for a price goes live once it's priced, unless the admin unticks this.
    is_active: awaitingPrice ? true : item?.is_active === undefined ? true : bool(item.is_active),
    vendor_cost: item?.vendor_cost != null ? String(Number(item.vendor_cost)) : '',
    has_offer: initialOffer !== '',
    offer_price: initialOffer,
    offer_ends_at: initialEnds,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const qtyFilled = f.quantity_value.trim() !== '';
  const qtyOk = qtyFilled ? Number(f.quantity_value) > 0 && Number(f.quantity_value) <= 99999.99 && !!f.quantity_unit : !f.quantity_unit;
  const priceNum = Number(f.price);
  const priceOk = priceNum > 0;
  const offerNum = Number(f.offer_price);
  const offerError = !f.has_offer ? ''
    : !(offerNum > 0) ? 'Enter the offer price.'
    : priceOk && offerNum >= priceNum ? 'The offer price must be lower than the normal price.'
    : f.offer_ends_at && f.offer_ends_at !== initialEnds && new Date(f.offer_ends_at).getTime() <= Date.now() ? 'The offer end must be in the future.'
    : '';

  const save = useAction(async () => {
    const body: Record<string, unknown> = {
      name: f.name.trim(), description: f.description.trim() || null, is_veg: f.is_veg, image_url: f.image_url || null,
      // Quantity and unit are set together or cleared together (the backend rejects one alone).
      quantity_value: qtyOk && f.quantity_value ? Number(f.quantity_value) : null,
      quantity_unit: qtyOk && f.quantity_value ? f.quantity_unit : null,
    };
    if (!item || priceNum !== Number(item.price) || awaitingPrice) body.price = priceNum;
    const initialCost = item?.vendor_cost != null ? String(Number(item.vendor_cost)) : '';
    if (f.vendor_cost !== initialCost) body.vendor_cost = f.vendor_cost === '' ? null : Number(f.vendor_cost);

    // Offer: send only what changed. An unchanged end date is left alone (re-sending a past one is refused).
    if (!f.has_offer) {
      if (item?.offer_price != null) body.offer_price = null;
    } else {
      const endsChanged = f.offer_ends_at !== initialEnds;
      if (!item || f.offer_price !== initialOffer || endsChanged) body.offer_price = offerNum;
      if (endsChanged) body.offer_ends_at = f.offer_ends_at ? new Date(f.offer_ends_at).toISOString() : null;
    }

    if (item) {
      const wasActive = item.is_active === undefined ? true : bool(item.is_active);
      if (awaitingPrice ? !f.is_active : f.is_active !== wasActive) body.is_active = f.is_active;
      await api.patch(`/items/${item.id}`, body);
    } else {
      await api.post('/items', { ...body, category_id: Number(f.category_id) });
    }
  }, {
    success: !item ? 'Item added' : awaitingPrice ? (f.is_active ? 'Priced and published' : 'Price saved (still hidden)') : 'Item saved',
    invalidate: ['/admin/items', '/admin/categories'],
    onDone: onClose,
  });

  function submit(e: FormEvent) { e.preventDefault(); save.mutate(undefined); }

  return (
    <Modal title={item ? `Edit ${item.name}` : 'New item'} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" form="item-form" disabled={save.isPending || !f.name.trim() || !priceOk || !qtyOk || !!offerError || !f.category_id}>
        {save.isPending ? 'Saving…' : awaitingPrice ? (f.is_active ? 'Set price & publish' : 'Save price') : 'Save'}
      </button>
    </>}>
      <form id="item-form" className="stack" onSubmit={submit}>
        {awaitingPrice && (
          <div className="alert warn">
            Proposed by <b>{item!.created_by_restaurant_name || 'a kitchen'}</b>. Customers can't see it until you set a price.
          </div>
        )}
        <Field label="Category" hint={item ? 'An item can’t move between categories.' : undefined}>
          <select className="select" value={f.category_id} onChange={(e) => set('category_id', e.target.value)} disabled={!!item} required>
            <option value="">Choose…</option>
            {(cats.data ?? []).filter((c) => bool(c.is_active) || String(c.id) === f.category_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Name"><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} required /></Field>
        <Field label="Description"><textarea className="textarea" value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
        <div className="grid-2">
          <Field label="Price (₹)" hint="What customers pay. Only admins can set prices.">
            <input className="input" type="number" min="1" step="1" value={f.price} onChange={(e) => set('price', e.target.value)} required autoFocus={awaitingPrice} />
          </Field>
          <Field label="Type">
            <div className="row" style={{ paddingTop: 6 }}>
              <label className="check"><input type="radio" checked={f.is_veg} onChange={() => set('is_veg', true)} /> Veg</label>
              <label className="check"><input type="radio" checked={!f.is_veg} onChange={() => set('is_veg', false)} /> Non-veg</label>
            </div>
          </Field>
        </div>

        <Field label="Vendor cost (₹, internal)" hint="What Fengle pays the kitchen for one of this dish. Never shown to customers or kitchens.">
          <input className="input" type="number" min="0" step="0.01" value={f.vendor_cost} placeholder="e.g. 200" onChange={(e) => set('vendor_cost', e.target.value)} />
        </Field>
        {f.vendor_cost !== '' && priceOk && (() => {
          const charged = f.has_offer && offerNum > 0 && offerNum < priceNum ? offerNum : priceNum;
          const m = charged - Number(f.vendor_cost);
          return (
            <small style={{ marginTop: -8, color: m < 0 ? 'var(--red)' : 'var(--green)' }}>
              {m < 0 ? 'Loss' : 'Profit'} per dish: <b>{money(Math.abs(m))}</b> ({charged > 0 ? Math.round((m / charged) * 100) : 0}% of {money(charged)}{charged !== priceNum ? ', offer price' : ''}).
              {m < 0 && ' The vendor cost is above what the customer pays.'}
            </small>
          );
        })()}
        <div className="offer-box">
          <label className="check"><input type="checkbox" checked={f.has_offer} onChange={(e) => set('has_offer', e.target.checked)} /> Offer price (discount on this dish)</label>
          {f.has_offer && (
            <>
              <div className="grid-2">
                <Field label="Offer price (₹)" hint={priceOk && offerNum > 0 && offerNum < priceNum ? `${Math.round((1 - offerNum / priceNum) * 100)}% off ${money(priceNum)}` : 'Lower than the normal price.'}>
                  <input className="input" type="number" min="1" step="1" value={f.offer_price} onChange={(e) => set('offer_price', e.target.value)} />
                </Field>
                <Field label="Offer ends (optional)" hint="Blank = runs until you turn it off.">
                  <input className="input" type="datetime-local" value={f.offer_ends_at} onChange={(e) => set('offer_ends_at', e.target.value)} />
                </Field>
              </div>
              {item?.offer_price != null && !bool(item.offer_active) && f.offer_ends_at === initialEnds && initialEnds && (
                <small className="muted">This offer has ended. Set a new end date (or clear it) to run it again.</small>
              )}
              <small className="muted">The customer pays the offer price; commission and GST follow it. Coupons still apply on top.</small>
              {offerError && <small style={{ color: 'var(--red)' }}>{offerError}</small>}
            </>
          )}
        </div>

        <div className="grid-2">
          <Field label="Quantity (optional)" hint="Shown to customers next to the dish, e.g. 3 pc or 500 gm.">
            <input className="input" type="number" min="0" step="any" value={f.quantity_value} placeholder="e.g. 500"
              onChange={(e) => set('quantity_value', e.target.value)} />
          </Field>
          <Field label="Unit">
            <select className="select" value={f.quantity_unit} onChange={(e) => set('quantity_unit', e.target.value as QuantityUnit | '')}>
              <option value="">Choose…</option>
              {QUANTITY_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </Field>
        </div>
        {!qtyOk && <small style={{ color: 'var(--red)', marginTop: -8 }}>Enter both a quantity above 0 and a unit, or leave both empty.</small>}
        {qtyOk && f.quantity_value && f.quantity_unit && <small className="muted" style={{ marginTop: -8 }}>Customers will see: <b>{Number(f.quantity_value)} {f.quantity_unit}</b></small>}
        <Field label="Photo"><ImageUpload value={f.image_url} onChange={(u) => set('image_url', u)} /></Field>
        {item && (
          <label className="check"><input type="checkbox" checked={f.is_active} onChange={(e) => set('is_active', e.target.checked)} /> Show this item to customers</label>
        )}
        {save.error && <div className="alert error">{errMsg(save.error)}</div>}
      </form>
    </Modal>
  );
}
