import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Restaurant, ShippingKind, ShippingPreview as Preview, ShippingZone } from '../api/types';
import { TYPE_LABEL } from '../lib/shipping';
import { money } from '../lib/format';
import { Badge, Field, errMsg } from './ui';

/** "Test a delivery": runs the same engine the apps use, so an admin can check a rule before relying on it. */
export default function ShippingPreview({ kind, zones }: { kind: ShippingKind; zones: ShippingZone[] }) {
  const [distance, setDistance] = useState('3');
  const [orderValue, setOrderValue] = useState('300');
  const [at, setAt] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [kitchenId, setKitchenId] = useState('');
  const [localErr, setLocalErr] = useState('');

  const kitchens = useQuery({
    queryKey: ['/admin/restaurants'],
    queryFn: () => api.get<{ restaurants: Restaurant[] }>('/admin/restaurants'),
    enabled: kind === 'customer_fee',
  });

  const run = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<Preview>('/admin/shipping/preview', body),
  });

  function submit() {
    setLocalErr('');
    const km = Number(distance);
    if (distance.trim() === '' || !Number.isFinite(km) || km < 0) return setLocalErr('Enter the distance in km.');
    const body: Record<string, unknown> = { kind, distance_km: km };
    if (orderValue.trim() !== '') {
      const v = Number(orderValue);
      if (!Number.isFinite(v) || v < 0) return setLocalErr('The order value must be a number.');
      body.order_value = v;
    }
    if (at) body.at = new Date(at).toISOString();
    if (zoneId) body.zone_id = Number(zoneId);
    if (kind === 'customer_fee' && kitchenId) body.restaurant_id = Number(kitchenId);
    run.mutate(body);
  }

  const r = run.data;

  return (
    <div className="card card-pad stack">
      <div>
        <h3 style={{ margin: 0 }}>Test a delivery</h3>
        <small className="muted">Try a delivery and see exactly what {kind === 'customer_fee' ? 'the customer pays' : 'the rider earns'} and which rules were used. Nothing is saved.</small>
      </div>
      <div className="grid-2">
        <Field label="Distance (km)"><input className="input" type="number" min="0" step="0.5" value={distance} onChange={(e) => setDistance(e.target.value)} /></Field>
        <Field label="Order value (₹)" hint="Dish total after offers."><input className="input" type="number" min="0" value={orderValue} onChange={(e) => setOrderValue(e.target.value)} /></Field>
        <Field label="Zone">
          <select className="input" value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">Outside every zone (Everywhere rules)</option>
            {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </Field>
        <Field label="Date & time" hint="Empty = right now.">
          <input className="input" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
        </Field>
        {kind === 'customer_fee' && (
          <Field label="Kitchen (optional)" hint="Needed only for rules that count distance beyond a kitchen’s radius.">
            <select className="input" value={kitchenId} onChange={(e) => setKitchenId(e.target.value)}>
              <option value="">No kitchen</option>
              {(kitchens.data?.restaurants ?? []).map((k) => <option key={k.id} value={k.id}>{k.name} ({Number(k.radius_km)} km radius)</option>)}
            </select>
          </Field>
        )}
      </div>
      <div className="row">
        <button className="btn primary" onClick={submit} disabled={run.isPending}>{run.isPending ? 'Working out…' : 'Work it out'}</button>
      </div>
      {localErr && <div className="alert error">{localErr}</div>}
      {run.error && <div className="alert error">{errMsg(run.error)}</div>}

      {r && (
        <div className="stack">
          <div className="row between">
            <div>
              <div className="muted small">{kind === 'customer_fee' ? 'Customer pays' : 'Rider earns'}</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{Number(r.amount) === 0 && kind === 'customer_fee' ? 'Free' : money(r.amount)}</div>
            </div>
            <div className="right small muted">
              {r.zone ? <>Zone: <b>{r.zone.name}</b></> : 'Outside every zone'}
              {r.breakdown?.chargeable_km != null && r.breakdown.distance_km != null && r.breakdown.chargeable_km !== r.breakdown.distance_km && (
                <div>{r.breakdown.chargeable_km} of {r.breakdown.distance_km} km counted</div>
              )}
            </div>
          </div>
          {r.applied.length > 0 ? (
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Rule used</th><th>Type</th><th className="num">Before</th><th className="num">After</th></tr></thead>
                <tbody>
                  {r.applied.map((a, i) => (
                    <tr key={`${a.rule_id}-${i}`}>
                      <td className="cell-main">{a.name}</td>
                      <td><Badge>{TYPE_LABEL[a.type] ?? a.type}</Badge></td>
                      <td className="num">{money(a.effect.before)}</td>
                      <td className="num">{money(a.effect.after)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="muted small">No rule matched, so the fallback applies.</div>}
          {(r.warnings ?? []).map((w, i) => <div key={i} className="alert warn">{w}</div>)}
        </div>
      )}
    </div>
  );
}
