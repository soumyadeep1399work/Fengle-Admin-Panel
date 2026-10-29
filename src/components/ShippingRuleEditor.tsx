import { useState } from 'react';
import { api } from '../api/client';
import type { ShippingKind, ShippingRule, ShippingRuleType, ShippingZone } from '../api/types';
import { useAction } from '../lib/hooks';
import {
  DAYS, TYPE_HELP, TYPE_LABEL, describeCharge, describeConditions, emptyRuleForm, ruleFormToPayload, ruleToForm, typesFor,
  type RuleForm,
} from '../lib/shipping';
import { Field, Modal } from './ui';

/** Add or edit one shipping rule. `rule` = editing; otherwise a new rule for `presetZoneId` (null = Everywhere). */
export default function ShippingRuleEditor({ kind, rule, presetZoneId, zones, onClose }: {
  kind: ShippingKind; rule?: ShippingRule; presetZoneId: number | null; zones: ShippingZone[]; onClose: () => void;
}) {
  const editing = !!rule;
  const [f, setF] = useState<RuleForm>(() => (rule ? ruleToForm(rule) : emptyRuleForm(presetZoneId)));
  const [err, setErr] = useState('');
  const locked = !!rule?.is_last_everywhere_base;

  const save = useAction(
    (payload: Record<string, unknown>) => (rule ? api.patch(`/admin/shipping/rules/${rule.id}`, payload) : api.post('/admin/shipping/rules', { kind, ...payload })),
    { success: editing ? 'Rule saved.' : 'Rule added.', invalidate: ['/admin/shipping'], onDone: onClose },
  );

  const set = <K extends keyof RuleForm>(k: K, v: RuleForm[K]) => setF((p) => ({ ...p, [k]: v }));

  function changeType(t: ShippingRuleType) {
    setF((p) => ({ ...p, type: t, bands: t === 'base' && p.bands.length === 0 ? [{ to_km: '', per_km: '' }] : p.bands }));
  }

  function submit() {
    setErr('');
    const built = ruleFormToPayload(f, kind);
    if (built.error) return setErr(built.error);
    save.mutate(built.payload as unknown as Record<string, unknown>);
  }

  const preview = ruleFormToPayload(f, kind);
  const toggleDay = (d: number) => set('days', f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d]);

  // The "from" of each band is the previous band's "up to".
  const bandFrom = (i: number) => (i === 0 ? '0' : f.bands[i - 1].to_km || '…');
  const setBand = (i: number, k: 'to_km' | 'per_km', v: string) => set('bands', f.bands.map((b, j) => (j === i ? { ...b, [k]: v } : b)));

  return (
    <Modal wide title={editing ? 'Edit rule' : 'Add a rule'} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" disabled={save.isPending} onClick={submit}>{save.isPending ? 'Saving…' : editing ? 'Save rule' : 'Add rule'}</button>
    </>}>
      <div className="stack">
        {locked && (
          <div className="alert info">
            This is the rule every delivery falls back on, so it can’t be switched off, moved to a zone or given dates. You can change its amounts and conditions.
          </div>
        )}

        <div className="grid-2">
          <Field label="Rule name"><input className="input" value={f.name} maxLength={100} placeholder="e.g. Night surcharge" onChange={(e) => set('name', e.target.value)} autoFocus /></Field>
          <Field label="Type" hint={TYPE_HELP[f.type]}>
            <select className="input" value={f.type} onChange={(e) => changeType(e.target.value as ShippingRuleType)} disabled={editing && locked}>
              {typesFor(kind).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
          </Field>
          <Field label="Where" hint="A zone’s rules apply to deliveries dropped inside it. “Everywhere” is the fallback.">
            <select className="input" value={f.zone_id} onChange={(e) => set('zone_id', e.target.value)} disabled={locked}>
              <option value="">Everywhere</option>
              {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <label className="check"><input type="checkbox" checked={f.is_active} disabled={locked} onChange={(e) => set('is_active', e.target.checked)} /> Rule is on</label>
          </Field>
        </div>

        <div className="card card-pad stack">
          <h3 style={{ margin: 0 }}>When does it apply?</h3>
          <small className="muted">Leave everything empty and the rule applies to every delivery. If you fill in several, all of them must match.</small>
          <div className="grid-2">
            <Field label="Distance from (km)" hint="Kitchen to customer, straight line. Included."><input className="input" type="number" min="0" step="0.5" value={f.dist_min} onChange={(e) => set('dist_min', e.target.value)} /></Field>
            <Field label="Distance up to (km)" hint="Not included."><input className="input" type="number" min="0" step="0.5" value={f.dist_max} onChange={(e) => set('dist_max', e.target.value)} /></Field>
            <Field label="Order value from (₹)" hint="Dish total after offers, before GST and coupons. Included."><input className="input" type="number" min="0" step="1" value={f.val_min} onChange={(e) => set('val_min', e.target.value)} /></Field>
            <Field label="Order value up to (₹)" hint="Not included."><input className="input" type="number" min="0" step="1" value={f.val_max} onChange={(e) => set('val_max', e.target.value)} /></Field>
          </div>
          <label className="check"><input type="checkbox" checked={f.time_on} onChange={(e) => set('time_on', e.target.checked)} /> Only on certain days / hours (Indian time)</label>
          {f.time_on && (
            <div className="stack">
              <div className="chips">
                {DAYS.map((d) => (
                  <button type="button" key={d.v} className={`chip-toggle ${f.days.includes(d.v) ? 'on' : ''}`} onClick={() => toggleDay(d.v)}>{d.label}</button>
                ))}
              </div>
              <small className="muted">No day picked = every day.</small>
              <div className="grid-2">
                <Field label="From (time)"><input className="input" type="time" value={f.time_from} onChange={(e) => set('time_from', e.target.value)} /></Field>
                <Field label="Until (time)" hint="An end earlier than the start runs past midnight, e.g. 22:00 to 06:00."><input className="input" type="time" value={f.time_to} onChange={(e) => set('time_to', e.target.value)} /></Field>
              </div>
              <small className="muted">
                {kind === 'customer_fee'
                  ? 'Judged at the time the order is placed.'
                  : 'Judged at the time the order is delivered.'}
              </small>
            </div>
          )}
        </div>

        <div className="card card-pad stack">
          <h3 style={{ margin: 0 }}>What does it charge?</h3>

          {f.type === 'base' && (
            <>
              <Field label="Flat amount (₹)" hint="Charged on every delivery this rule covers. Optional if you add per-km bands.">
                <input className="input" type="number" min="0" step="0.5" value={f.flat} onChange={(e) => set('flat', e.target.value)} />
              </Field>
              <div>
                <b className="small">Per-km bands</b>
                <div className="muted small" style={{ marginBottom: 6 }}>
                  Each band covers the distance from the previous band’s end. Leave the last “up to” empty to charge that rate for the rest of the distance, or fill it in to stop charging beyond it.
                </div>
                <div className="table-wrap">
                  <table className="tbl">
                    <thead><tr><th>From (km)</th><th>Up to (km)</th><th>₹ per km</th><th /></tr></thead>
                    <tbody>
                      {f.bands.map((b, i) => (
                        <tr key={i}>
                          <td className="nowrap">{bandFrom(i)}</td>
                          <td><input className="input" type="number" min="0" step="0.5" placeholder="and beyond" value={b.to_km} onChange={(e) => setBand(i, 'to_km', e.target.value)} style={{ maxWidth: 120 }} /></td>
                          <td><input className="input" type="number" min="0" step="0.5" value={b.per_km} onChange={(e) => setBand(i, 'per_km', e.target.value)} style={{ maxWidth: 120 }} /></td>
                          <td className="right"><button type="button" className="btn sm" onClick={() => set('bands', f.bands.filter((_, j) => j !== i))}>Remove</button></td>
                        </tr>
                      ))}
                      {f.bands.length === 0 && <tr><td colSpan={4} className="muted small">No bands: only the flat amount is charged.</td></tr>}
                    </tbody>
                  </table>
                </div>
                <button type="button" className="btn sm" style={{ marginTop: 8 }} onClick={() => set('bands', [...f.bands, { to_km: '', per_km: '' }])}>Add a band</button>
              </div>
              {kind === 'customer_fee' && (
                <label className="check" style={{ alignItems: 'flex-start' }}>
                  <input type="checkbox" checked={f.after_kitchen_radius} onChange={(e) => set('after_kitchen_radius', e.target.checked)} />
                  <span>Count distance only beyond the kitchen’s own delivery radius<br /><small className="muted">Delivery inside the kitchen’s radius stays free, as it is today.</small></span>
                </label>
              )}
            </>
          )}

          {f.type === 'add' && (
            <div className="grid-2">
              <Field label="Add a flat amount (₹)"><input className="input" type="number" min="0" step="0.5" value={f.flat} onChange={(e) => set('flat', e.target.value)} /></Field>
              <Field label="Add a percentage (%)" hint="Of the amount worked out so far."><input className="input" type="number" min="0" step="0.5" value={f.percent} onChange={(e) => set('percent', e.target.value)} /></Field>
            </div>
          )}

          {f.type === 'free' && <div className="muted small">Nothing to set. When the conditions above match, the delivery fee is ₹0. Minimum and maximum rules are applied first, then this.</div>}

          {(f.type === 'min' || f.type === 'max') && (
            <Field label={f.type === 'min' ? 'Never less than (₹)' : 'Never more than (₹)'}>
              <input className="input" type="number" min="0" step="0.5" value={f.amount} onChange={(e) => set('amount', e.target.value)} />
            </Field>
          )}
        </div>

        <div className="card card-pad stack">
          <h3 style={{ margin: 0 }}>Schedule (optional)</h3>
          <div className="grid-2">
            <Field label="Starts" hint="Empty = from now."><input className="input" type="datetime-local" value={f.valid_from} disabled={locked} onChange={(e) => set('valid_from', e.target.value)} /></Field>
            <Field label="Ends" hint="Empty = no end, e.g. set one for a festival offer."><input className="input" type="datetime-local" value={f.valid_to} disabled={locked} onChange={(e) => set('valid_to', e.target.value)} /></Field>
          </div>
        </div>

        {preview.payload && (
          <div className="formula">
            In plain words: <b>{describeCharge(f.type, preview.payload.charge)}</b>
            {describeConditions(preview.payload.conditions).length > 0
              ? <> when {describeConditions(preview.payload.conditions).join(', ')}</>
              : <> on every delivery{f.zone_id === '' ? '' : ' in this zone'}</>}
            .
          </div>
        )}
        {err && <div className="alert error">{err}</div>}
        {save.error && <div className="alert error">{save.error instanceof Error ? save.error.message : 'Could not save the rule.'}</div>}
      </div>
    </Modal>
  );
}
