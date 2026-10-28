import { useState, type FormEvent } from 'react';
import { api } from '../api/client';
import type { Restaurant } from '../api/types';
import { useAllCategories } from '../lib/catalog';
import { useAction } from '../lib/hooks';
import MapPicker from './MapPicker';
import { Field, Modal } from './ui';

/** Onboard (no `restaurant`) or edit an existing kitchen. Categories are only picked at onboarding; after that they're managed on the detail page. */
export default function RestaurantForm({ restaurant, onClose, onSaved }: {
  restaurant?: Restaurant; onClose: () => void; onSaved?: (id: number) => void;
}) {
  const editing = !!restaurant;
  const cats = useAllCategories();
  const [f, setF] = useState({
    name: restaurant?.name ?? '',
    owner_name: restaurant?.owner_name ?? '',
    phone: restaurant?.phone ?? '',
    email: restaurant?.email ?? '',
    address: restaurant?.address ?? '',
    lat: restaurant ? Number(restaurant.lat) : null as number | null,
    lng: restaurant ? Number(restaurant.lng) : null as number | null,
    radius_km: restaurant ? String(Number(restaurant.radius_km)) : '5',
    commission_rate_percent: restaurant ? String(Number(restaurant.commission_rate_percent)) : '15',
    category_ids: [] as number[],
  });
  const [err, setErr] = useState('');
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const save = useAction(async () => {
    const body = {
      name: f.name.trim(), owner_name: f.owner_name.trim() || null, phone: f.phone.trim(), email: f.email.trim() || null,
      address: f.address.trim(), lat: f.lat, lng: f.lng,
      radius_km: Number(f.radius_km), commission_rate_percent: Number(f.commission_rate_percent),
    };
    if (editing) {
      await api.patch(`/admin/restaurants/${restaurant.id}`, body);
      return restaurant.id;
    }
    const res = await api.post<{ restaurant: Restaurant }>('/admin/restaurants', { ...body, category_ids: f.category_ids });
    return res.restaurant.id;
  }, {
    success: editing ? 'Kitchen updated' : 'Kitchen onboarded',
    invalidate: ['/admin/restaurants', '/admin/dashboard'],
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (!/^\d{10}$/.test(f.phone.trim())) return setErr('Phone must be 10 digits (no +91). The kitchen logs in to the Restaurant app with this number.');
    if (f.lat == null || f.lng == null) return setErr('Drop the kitchen pin on the map.');
    const r = Number(f.radius_km);
    if (!(r > 0 && r <= 7)) return setErr('Delivery radius must be between 0 and 7 km (7 km is the cascade ceiling).');
    const c = Number(f.commission_rate_percent);
    if (!(c >= 0 && c <= 100)) return setErr('Commission must be between 0 and 100%.');
    if (!editing && f.category_ids.length === 0) return setErr('Pick at least one category this kitchen cooks.');
    save.mutate(undefined, { onSuccess: (id) => { onSaved?.(id as number); onClose(); } });
  }

  return (
    <Modal wide title={editing ? `Edit ${restaurant.name}` : 'Onboard a kitchen'} onClose={onClose} footer={<>
      <button className="btn" type="button" onClick={onClose}>Cancel</button>
      <button className="btn primary" form="restaurant-form" disabled={save.isPending}>{save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Onboard kitchen'}</button>
    </>}>
      <form id="restaurant-form" className="stack" onSubmit={submit}>
        <div className="grid-2">
          <Field label="Kitchen name"><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} required /></Field>
          <Field label="Owner name"><input className="input" value={f.owner_name} onChange={(e) => set('owner_name', e.target.value)} disabled={editing} /></Field>
          <Field label="Login phone" hint="10 digits. Used for OTP login to the Restaurant app.">
            <input className="input" inputMode="numeric" value={f.phone} onChange={(e) => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} required disabled={editing} />
          </Field>
          <Field label="Email"><input className="input" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} disabled={editing} /></Field>
        </div>
        <Field label="Address"><input className="input" value={f.address} onChange={(e) => set('address', e.target.value)} required /></Field>
        <MapPicker lat={f.lat} lng={f.lng} radiusKm={Number(f.radius_km) || undefined} onChange={(lat, lng) => setF((p) => ({ ...p, lat, lng }))}
          onAddressFound={(addr) => setF((p) => (p.address.trim() ? p : { ...p, address: addr }))} />
        <div className="grid-2">
          <Field label="Delivery radius (km)" hint="Default 5 km. Orders cascade to other kitchens up to 7 km.">
            <input className="input" type="number" step="0.5" min="0.5" max="7" value={f.radius_km} onChange={(e) => set('radius_km', e.target.value)} />
          </Field>
          <Field label="Commission (%)" hint={editing ? 'Changes are recorded in the commission history.' : 'Platform cut of each order’s item total.'}>
            <input className="input" type="number" step="0.5" min="0" max="100" value={f.commission_rate_percent} onChange={(e) => set('commission_rate_percent', e.target.value)} />
          </Field>
        </div>
        {!editing && (
          <Field label="Categories this kitchen cooks">
            <div className="chips">
              {(cats.data ?? []).filter((c) => c.is_active === true || c.is_active === 1).map((c) => {
                const on = f.category_ids.includes(c.id);
                return (
                  <button type="button" key={c.id} className={`chip-toggle ${on ? 'on' : ''}`}
                    onClick={() => set('category_ids', on ? f.category_ids.filter((x) => x !== c.id) : [...f.category_ids, c.id])}>{c.name}</button>
                );
              })}
              {cats.isLoading && <span className="muted">Loading categories…</span>}
            </div>
          </Field>
        )}
        {editing && <small className="muted">Phone, owner and email can't be changed here yet. Manage categories and status from the kitchen's page.</small>}
        {err && <div className="alert error">{err}</div>}
      </form>
    </Modal>
  );
}
