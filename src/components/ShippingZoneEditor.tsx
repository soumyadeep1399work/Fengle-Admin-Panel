import { useState } from 'react';
import { api } from '../api/client';
import type { ShippingZone } from '../api/types';
import { useAction } from '../lib/hooks';
import { emptyZoneForm, zoneFormToPayload, zoneToForm, type ZoneForm } from '../lib/shipping';
import MapPicker from './MapPicker';
import { Field, Modal } from './ui';

/** Add or edit a delivery zone: one or more circular areas (a point on the map and a radius). */
export default function ShippingZoneEditor({ zone, onClose }: { zone?: ShippingZone; onClose: () => void }) {
  const editing = !!zone;
  const [f, setF] = useState<ZoneForm>(() => (zone ? zoneToForm(zone) : emptyZoneForm()));
  const [sel, setSel] = useState(0);
  const [err, setErr] = useState('');

  const save = useAction(
    (payload: Record<string, unknown>) => (zone ? api.patch(`/admin/shipping/zones/${zone.id}`, payload) : api.post('/admin/shipping/zones', payload)),
    { success: editing ? 'Zone saved.' : 'Zone added.', invalidate: ['/admin/shipping'], onDone: onClose },
  );

  const setCircle = (i: number, patch: Partial<ZoneForm['circles'][number]>) =>
    setF((p) => ({ ...p, circles: p.circles.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));

  function submit() {
    setErr('');
    const built = zoneFormToPayload(f);
    if (built.error) return setErr(built.error);
    save.mutate(built.payload as unknown as Record<string, unknown>);
  }

  const cur = f.circles[Math.min(sel, f.circles.length - 1)];
  const curIdx = Math.min(sel, f.circles.length - 1);
  const latNum = cur ? Number(cur.lat) : NaN;
  const lngNum = cur ? Number(cur.lng) : NaN;

  return (
    <Modal wide title={editing ? 'Edit zone' : 'Add a zone'} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" disabled={save.isPending} onClick={submit}>{save.isPending ? 'Saving…' : editing ? 'Save zone' : 'Add zone'}</button>
    </>}>
      <div className="stack">
        <div className="grid-2">
          <Field label="Zone name"><input className="input" value={f.name} maxLength={100} placeholder="e.g. Newtown core" onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus /></Field>
          <Field label="Status"><label className="check"><input type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} /> Zone is on</label></Field>
        </div>

        <div className="muted small">
          A delivery belongs to a zone when its drop-off point falls inside one of the zone’s areas. If it fits several zones, the one higher in the list wins. A delivery in no zone uses the “Everywhere” rules.
        </div>

        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Area</th><th>Latitude</th><th>Longitude</th><th>Radius (km)</th><th /></tr></thead>
            <tbody>
              {f.circles.map((c, i) => (
                <tr key={i} style={i === curIdx ? { background: 'var(--primary-tint, #f5f0ff)' } : undefined}>
                  <td className="nowrap"><button type="button" className="linklike" onClick={() => setSel(i)}>Area {i + 1}{i === curIdx ? ' (on map)' : ''}</button></td>
                  <td><input className="input" type="number" step="any" value={c.lat} onChange={(e) => setCircle(i, { lat: e.target.value })} style={{ maxWidth: 130 }} /></td>
                  <td><input className="input" type="number" step="any" value={c.lng} onChange={(e) => setCircle(i, { lng: e.target.value })} style={{ maxWidth: 130 }} /></td>
                  <td><input className="input" type="number" min="0.5" max="100" step="0.5" value={c.radius_km} onChange={(e) => setCircle(i, { radius_km: e.target.value })} style={{ maxWidth: 100 }} /></td>
                  <td className="right"><button type="button" className="btn sm" onClick={() => { setF({ ...f, circles: f.circles.filter((_, j) => j !== i) }); setSel(0); }}>Remove</button></td>
                </tr>
              ))}
              {f.circles.length === 0 && <tr><td colSpan={5} className="muted small">No areas yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <div>
          <button type="button" className="btn sm" onClick={() => { setF({ ...f, circles: [...f.circles, { lat: cur?.lat ?? '22.58', lng: cur?.lng ?? '88.47', radius_km: '3' }] }); setSel(f.circles.length); }}>Add another area</button>
        </div>

        {cur && Number.isFinite(latNum) && Number.isFinite(lngNum) && (
          <MapPicker lat={latNum} lng={lngNum} radiusKm={Number(cur.radius_km) || undefined}
            hint={`Search, or click the map to move the centre of Area ${curIdx + 1}.${Number(cur.radius_km) ? ` The shaded circle is the ${Number(cur.radius_km)} km area.` : ''}`}
            onChange={(lat, lng) => setCircle(curIdx, { lat: String(lat), lng: String(lng) })} />
        )}
        {f.pincodes.length > 0 && <small className="muted">This zone also lists {f.pincodes.length} pincode(s), which are kept as they are.</small>}

        {err && <div className="alert error">{err}</div>}
      </div>
    </Modal>
  );
}
