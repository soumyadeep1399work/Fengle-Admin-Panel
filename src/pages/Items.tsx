import { useCan } from '../auth';
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Item, QuantityUnit } from '../api/types';

const QUANTITY_UNITS: { value: QuantityUnit; label: string }[] = [
  { value: 'pc', label: 'pc (pieces)' },
  { value: 'gm', label: 'gm (grams)' },
  { value: 'kg', label: 'kg' },
  { value: 'ml', label: 'ml' },
  { value: 'ltr', label: 'ltr (litres)' },
];
import ImageUpload from '../components/ImageUpload';
import { Empty, Field, Modal, QueryState, useDebounced, errMsg } from '../components/ui';
import { useAllCategories } from '../lib/catalog';
import { useAction, useList } from '../lib/hooks';
import { bool, money } from '../lib/format';

function VegMark({ veg }: { veg: boolean }) {
  const c = veg ? 'var(--green)' : 'var(--red)';
  return (
    <span title={veg ? 'Veg' : 'Non-veg'} style={{ display: 'inline-grid', placeItems: 'center', width: 14, height: 14, border: `1.5px solid ${c}`, borderRadius: 3, verticalAlign: 'middle' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />
    </span>
  );
}

export default function Items() {
  const [params, setParams] = useSearchParams();
  const categoryId = params.get('category_id') ?? '';
  const [search, setSearch] = useState('');
  const dq = useDebounced(search);
  const cats = useAllCategories();
  const can = useCan();
  const [editing, setEditing] = useState<Item | 'new' | null>(null);
  const { data, isLoading, error } = useList<Item>('/admin/items', 'items', { category_id: categoryId || undefined, q: dq || undefined, limit: 500 });
  const catName = (id: number) => cats.data?.find((c) => c.id === id)?.name ?? `#${id}`;

  return (
    <div className="stack">
      <div className="page-head">
        <div><h1>Items</h1><p>The shared menu. Every kitchen carrying a category sells that category's items; there are no kitchen-exclusive dishes.</p></div>
        {can('manage') && <button className="btn primary" onClick={() => setEditing('new')}>+ New item</button>}
      </div>
      <div className="card">
        <div className="toolbar">
          <input className="input search" placeholder="Search dishes" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="select" value={categoryId} aria-label="Category"
            onChange={(e) => { const n = new URLSearchParams(params); if (e.target.value) n.set('category_id', e.target.value); else n.delete('category_id'); setParams(n, { replace: true }); }}>
            <option value="">All categories</option>
            {(cats.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <QueryState isLoading={isLoading} error={error}>
          {(data?.rows.length ?? 0) === 0 ? <Empty title="No items" /> : (
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Item</th><th>Category</th><th>Added by</th><th>Status</th><th className="num">Price</th></tr></thead>
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
                      <td className="small muted">{it.created_by_type === 'restaurant' ? 'Kitchen' : 'Fengle'}</td>
                      <td>{it.is_active === undefined || bool(it.is_active) ? <span className="badge green">Active</span> : <span className="badge">Hidden</span>}</td>
                      <td className="num cell-main">{money(it.price)}</td>
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

function ItemForm({ item, defaultCategory, onClose }: { item?: Item; defaultCategory: string; onClose: () => void }) {
  const cats = useAllCategories();
  const [f, setF] = useState({
    category_id: item ? String(item.category_id) : defaultCategory,
    name: item?.name ?? '',
    description: item?.description ?? '',
    price: item ? String(Number(item.price)) : '',
    quantity_value: item?.quantity_value != null ? String(Number(item.quantity_value)) : '',
    quantity_unit: (item?.quantity_unit ?? '') as QuantityUnit | '',
    is_veg: item ? bool(item.is_veg) : true,
    image_url: item?.image_url ?? '',
    is_active: item?.is_active === undefined ? true : bool(item.is_active),
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const qtyFilled = f.quantity_value.trim() !== '';
  const qtyOk = qtyFilled ? Number(f.quantity_value) > 0 && Number(f.quantity_value) <= 99999.99 && !!f.quantity_unit : !f.quantity_unit;

  const save = useAction(async () => {
    const body: Record<string, unknown> = {
      name: f.name.trim(), description: f.description.trim() || null, price: Number(f.price), is_veg: f.is_veg, image_url: f.image_url || null,
      // Quantity and unit are set together or cleared together (the backend rejects one alone).
      quantity_value: qtyOk && f.quantity_value ? Number(f.quantity_value) : null,
      quantity_unit: qtyOk && f.quantity_value ? f.quantity_unit : null,
    };
    if (item) {
      // is_active is only sent when changed, so edits keep working on backends that don't accept it yet.
      if (f.is_active !== (item.is_active === undefined ? true : bool(item.is_active))) body.is_active = f.is_active;
      await api.patch(`/items/${item.id}`, body);
    } else {
      await api.post('/items', { ...body, category_id: Number(f.category_id) });
    }
  }, { success: item ? 'Item saved' : 'Item added', invalidate: ['/admin/items', '/admin/categories'], onDone: onClose });

  function submit(e: FormEvent) { e.preventDefault(); save.mutate(undefined); }
  const priceOk = Number(f.price) > 0;

  return (
    <Modal title={item ? `Edit ${item.name}` : 'New item'} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" form="item-form" disabled={save.isPending || !f.name.trim() || !priceOk || !qtyOk || !f.category_id}>{save.isPending ? 'Saving…' : 'Save'}</button>
    </>}>
      <form id="item-form" className="stack" onSubmit={submit}>
        <Field label="Category" hint={item ? 'An item can’t move between categories.' : undefined}>
          <select className="select" value={f.category_id} onChange={(e) => set('category_id', e.target.value)} disabled={!!item} required>
            <option value="">Choose…</option>
            {(cats.data ?? []).filter((c) => bool(c.is_active) || String(c.id) === f.category_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Name"><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} required /></Field>
        <Field label="Description"><textarea className="textarea" value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
        <div className="grid-2">
          <Field label="Price (₹)">
            <input className="input" type="number" min="1" step="1" value={f.price} onChange={(e) => set('price', e.target.value)} required />
          </Field>
          <Field label="Type">
            <div className="row" style={{ paddingTop: 6 }}>
              <label className="check"><input type="radio" checked={f.is_veg} onChange={() => set('is_veg', true)} /> Veg</label>
              <label className="check"><input type="radio" checked={!f.is_veg} onChange={() => set('is_veg', false)} /> Non-veg</label>
            </div>
          </Field>
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
