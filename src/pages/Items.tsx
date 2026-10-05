import { useCan } from '../auth';
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Item } from '../api/types';
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
                            <div className="cell-main"><VegMark veg={bool(it.is_veg)} /> {it.name}</div>
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
    is_veg: item ? bool(item.is_veg) : true,
    image_url: item?.image_url ?? '',
    is_active: item?.is_active === undefined ? true : bool(item.is_active),
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const save = useAction(async () => {
    const body: Record<string, unknown> = {
      name: f.name.trim(), description: f.description.trim() || null, price: Number(f.price), is_veg: f.is_veg, image_url: f.image_url || null,
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
      <button className="btn primary" form="item-form" disabled={save.isPending || !f.name.trim() || !priceOk || !f.category_id}>{save.isPending ? 'Saving…' : 'Save'}</button>
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
        <Field label="Photo"><ImageUpload value={f.image_url} onChange={(u) => set('image_url', u)} /></Field>
        {item && (
          <label className="check"><input type="checkbox" checked={f.is_active} onChange={(e) => set('is_active', e.target.checked)} /> Show this item to customers</label>
        )}
        {save.error && <div className="alert error">{errMsg(save.error)}</div>}
      </form>
    </Modal>
  );
}
