import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { Category } from '../api/types';
import ImageUpload from '../components/ImageUpload';
import { Confirm, Empty, Field, Modal, QueryState, Tabs, errMsg } from '../components/ui';
import { useAllCategories } from '../lib/catalog';
import { useAction } from '../lib/hooks';
import { bool, money, num } from '../lib/format';

type Filter = 'active' | 'inactive' | 'all';

export default function Categories() {
  const q = useAllCategories();
  const [filter, setFilter] = useState<Filter>('active');
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [merging, setMerging] = useState<Category | null>(null);
  const [toggling, setToggling] = useState<Category | null>(null);

  const all = q.data ?? [];
  const rows = useMemo(() => all.filter((c) => filter === 'all' || (filter === 'active') === bool(c.is_active)), [all, filter]);

  const toggle = useAction((c: Category) => api.patch(`/admin/categories/${c.id}`, { is_active: !bool(c.is_active) }), {
    success: 'Category updated', invalidate: ['/admin/categories'], onDone: () => setToggling(null),
  });

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Categories</h1>
          <p>Kitchens can create categories themselves. Use rename or merge to clean up near-duplicates (“Momo” vs “Momos”).</p>
        </div>
        <button className="btn primary" onClick={() => setEditing('new')}>+ New category</button>
      </div>
      <div className="card">
        <Tabs value={filter} onChange={setFilter} tabs={[
          { value: 'active', label: 'Active', count: all.filter((c) => bool(c.is_active)).length },
          { value: 'inactive', label: 'Inactive', count: all.filter((c) => !bool(c.is_active)).length },
          { value: 'all', label: 'All', count: all.length },
        ]} />
        <QueryState isLoading={q.isLoading} error={q.error}>
          {rows.length === 0 ? <Empty title="No categories here" /> : (
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Category</th><th>Status</th><th>Created by</th><th className="num">Items</th><th className="num">Kitchens</th><th>Prep time</th><th /></tr></thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div className="row" style={{ flexWrap: 'nowrap' }}>
                          {c.image_url ? <img className="thumb" src={c.image_url} alt="" /> : <div className="thumb" />}
                          <div><div className="cell-main">{c.name}</div><div className="cell-sub">{c.description || `#${c.id}`}</div></div>
                        </div>
                      </td>
                      <td>{bool(c.is_active) ? <span className="badge green">Active</span> : <span className="badge">Inactive</span>}</td>
                      <td className="small">{c.created_by_restaurant_id
                        ? <Link to={`/restaurants/${c.created_by_restaurant_id}`}>{c.created_by_restaurant_name || `Kitchen #${c.created_by_restaurant_id}`}</Link>
                        : <span className="muted">Fengle</span>}</td>
                      <td className="num">{c.item_count !== undefined ? <Link to={`/items?category_id=${c.id}`}>{num(c.item_count)}</Link> : '—'}</td>
                      <td className="num">{c.restaurant_count !== undefined ? num(c.restaurant_count) : '—'}</td>
                      <td className="small">{c.prep_time_min_minutes ? `${c.prep_time_min_minutes}–${c.prep_time_max_minutes ?? c.prep_time_min_minutes} min` : '—'}</td>
                      <td className="right nowrap">
                        <button className="btn sm ghost" onClick={() => setEditing(c)}>Edit</button>
                        <button className="btn sm ghost" onClick={() => setMerging(c)}>Merge</button>
                        <button className="btn sm ghost" onClick={() => setToggling(c)}>{bool(c.is_active) ? 'Deactivate' : 'Activate'}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </QueryState>
      </div>

      {editing && <CategoryForm category={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {merging && <MergeCategory source={merging} all={all} onClose={() => setMerging(null)} />}
      {toggling && (
        <Confirm title={`${bool(toggling.is_active) ? 'Deactivate' : 'Activate'} ${toggling.name}?`} danger={bool(toggling.is_active)}
          confirmLabel={bool(toggling.is_active) ? 'Deactivate' : 'Activate'}
          message={bool(toggling.is_active)
            ? 'Customers stop seeing this category and its items. Kitchens keep it on file, and you can reactivate it any time.'
            : 'Customers near a kitchen that carries it will see it again.'}
          busy={toggle.isPending} error={toggle.error} onConfirm={() => toggle.mutate(toggling)} onClose={() => setToggling(null)} />
      )}
    </div>
  );
}

function CategoryForm({ category, onClose }: { category?: Category; onClose: () => void }) {
  const [f, setF] = useState({
    name: category?.name ?? '',
    description: category?.description ?? '',
    image_url: category?.image_url ?? '',
    prep_time_min_minutes: category?.prep_time_min_minutes?.toString() ?? '',
    prep_time_max_minutes: category?.prep_time_max_minutes?.toString() ?? '',
    min_order_override: category?.min_order_override != null ? String(Number(category.min_order_override)) : '',
  });
  const [dupe, setDupe] = useState<{ id: number; name: string } | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = useAction(async () => {
    const body = {
      name: f.name.trim(), description: f.description.trim() || null, image_url: f.image_url || null,
      prep_time_min_minutes: f.prep_time_min_minutes ? Number(f.prep_time_min_minutes) : null,
      prep_time_max_minutes: f.prep_time_max_minutes ? Number(f.prep_time_max_minutes) : null,
      min_order_override: f.min_order_override ? Number(f.min_order_override) : null,
    };
    try {
      if (category) await api.patch(`/admin/categories/${category.id}`, body);
      else await api.post('/categories', body);
    } catch (e) {
      const b = e instanceof ApiError ? (e.body as { code?: string; category?: { id: number; name: string } } | null) : null;
      if (b?.code === 'category_exists' && b.category) setDupe(b.category);
      throw e;
    }
  }, { success: category ? 'Category saved' : 'Category created', invalidate: ['/admin/categories'], onDone: onClose });

  function submit(e: FormEvent) { e.preventDefault(); setDupe(null); save.mutate(undefined); }

  return (
    <Modal title={category ? `Edit ${category.name}` : 'New category'} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" form="cat-form" disabled={save.isPending || !f.name.trim()}>{save.isPending ? 'Saving…' : 'Save'}</button>
    </>}>
      <form id="cat-form" className="stack" onSubmit={submit}>
        <Field label="Name" hint="Customers see this. Near-duplicates of an existing name are refused.">
          <input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} required autoFocus />
        </Field>
        <Field label="Short description"><input className="input" value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
        <Field label="Cover image"><ImageUpload value={f.image_url} onChange={(u) => set('image_url', u)} /></Field>
        <div className="grid-3">
          <Field label="Prep from (min)"><input className="input" type="number" min="0" value={f.prep_time_min_minutes} onChange={(e) => set('prep_time_min_minutes', e.target.value)} /></Field>
          <Field label="Prep to (min)"><input className="input" type="number" min="0" value={f.prep_time_max_minutes} onChange={(e) => set('prep_time_max_minutes', e.target.value)} /></Field>
          <Field label="Min order (₹)" hint={`Blank = ${money(50)}`}><input className="input" type="number" min="0" value={f.min_order_override} onChange={(e) => set('min_order_override', e.target.value)} /></Field>
        </div>
        {dupe && <div className="alert warn">“{dupe.name}” already exists. Use that one, or merge the two from the list.</div>}
        {save.error && !dupe && <div className="alert error">{errMsg(save.error)}</div>}
      </form>
    </Modal>
  );
}

function MergeCategory({ source, all, onClose }: { source: Category; all: Category[]; onClose: () => void }) {
  const [into, setInto] = useState('');
  const target = all.find((c) => String(c.id) === into);
  const merge = useAction(() => api.post(`/admin/categories/${source.id}/merge`, { into_category_id: Number(into) }), {
    success: `Merged ${source.name}`, invalidate: ['/admin/categories', '/admin/items', '/admin/restaurants'], onDone: onClose,
  });
  return (
    <Modal title={`Merge “${source.name}” into…`} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn danger solid" disabled={!into || merge.isPending} onClick={() => merge.mutate(undefined)}>{merge.isPending ? 'Merging…' : 'Merge'}</button>
    </>}>
      <Field label="Keep this category">
        <select className="select" value={into} onChange={(e) => setInto(e.target.value)} autoFocus>
          <option value="">Choose…</option>
          {all.filter((c) => c.id !== source.id && bool(c.is_active)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      {target && (
        <div className="alert info">
          All of <b>{source.name}</b>'s items{source.item_count !== undefined ? ` (${source.item_count})` : ''} and kitchens move to <b>{target.name}</b>. Then <b>{source.name}</b> is deactivated. Past orders keep their original names. This can't be undone.
        </div>
      )}
      {merge.error && <div className="alert error">{errMsg(merge.error)}</div>}
    </Modal>
  );
}
