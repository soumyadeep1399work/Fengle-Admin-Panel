import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { RiderPaySettings } from '../api/types';
import { useCan } from '../auth';
import { Confirm, Field, QueryState, errMsg } from '../components/ui';
import { useAction } from '../lib/hooks';
import { dateTime, money } from '../lib/format';

interface Response { settings: RiderPaySettings; formula: string; history: RiderPaySettings[] }

/** The payout rule, computed the same way as the backend (for the preview only). */
function payoutFor(s: { base_payout: number; per_km_rate: number; min_payout: number; incentive_per_delivery: number }, km: number) {
  const subtotal = s.base_payout + s.per_km_rate * km;
  return Math.max(s.min_payout, subtotal) + s.incentive_per_delivery;
}

const n = (v: unknown) => Number(v) || 0;

export default function RiderPay() {
  const can = useCan();
  const q = useQuery({ queryKey: ['/admin/settings/rider-pay'], queryFn: () => api.get<Response>('/admin/settings/rider-pay') });
  const s = q.data?.settings;
  const [f, setF] = useState<Record<string, string> | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [err, setErr] = useState('');

  const form = f ?? (s ? {
    base_payout: String(n(s.base_payout)), per_km_rate: String(n(s.per_km_rate)),
    min_payout: String(n(s.min_payout)), incentive_per_delivery: String(n(s.incentive_per_delivery)),
  } : null);
  const values = form ? {
    base_payout: n(form.base_payout), per_km_rate: n(form.per_km_rate), min_payout: n(form.min_payout), incentive_per_delivery: n(form.incentive_per_delivery),
  } : null;
  const changed = !!(s && values && (values.base_payout !== n(s.base_payout) || values.per_km_rate !== n(s.per_km_rate)
    || values.min_payout !== n(s.min_payout) || values.incentive_per_delivery !== n(s.incentive_per_delivery)));

  const save = useAction(() => api.put('/admin/settings/rider-pay', values), {
    success: 'Rider pay updated. It applies to deliveries from now on.',
    invalidate: ['/admin/settings/rider-pay'],
    onDone: () => { setConfirming(false); setF(null); },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (!values || !form) return;
    if (Object.values(form).some((v) => v.trim() === '' || Number(v) < 0 || Number(v) > 100000)) return setErr('Each value must be between 0 and 1,00,000.');
    if (Object.values(values).every((v) => v === 0)) return setErr('At least one value must be above zero, or riders would earn nothing.');
    setConfirming(true);
  }

  const set = (k: string, v: string) => setF({ ...(form ?? {}), [k]: v });
  const editable = can('money');

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Rider pay</h1>
          <p>How much a rider earns per delivery. Worked out automatically when an order is delivered, and fixed on that order from then on.</p>
        </div>
      </div>
      <QueryState isLoading={q.isLoading} error={q.error}>
        {s && values && form && (
          <div className="grid-2" style={{ alignItems: 'start' }}>
            <form className="card card-pad stack" onSubmit={submit}>
              <h3>Current rule</h3>
              <div className="formula">
                Payout = the larger of <b>minimum</b> and (<b>base</b> + <b>per km</b> × distance), plus <b>incentive</b>
              </div>
              <div className="grid-2">
                <Field label="Base payout (₹)" hint="Paid on every delivery."><input className="input" type="number" min="0" step="0.5" value={form.base_payout} disabled={!editable} onChange={(e) => set('base_payout', e.target.value)} /></Field>
                <Field label="Per km (₹)" hint="Kitchen to customer, straight-line km."><input className="input" type="number" min="0" step="0.5" value={form.per_km_rate} disabled={!editable} onChange={(e) => set('per_km_rate', e.target.value)} /></Field>
                <Field label="Minimum payout (₹)" hint="A delivery never pays less than this."><input className="input" type="number" min="0" step="0.5" value={form.min_payout} disabled={!editable} onChange={(e) => set('min_payout', e.target.value)} /></Field>
                <Field label="Incentive per delivery (₹)" hint="Extra on top, e.g. a festival bonus. 0 = none."><input className="input" type="number" min="0" step="0.5" value={form.incentive_per_delivery} disabled={!editable} onChange={(e) => set('incentive_per_delivery', e.target.value)} /></Field>
              </div>
              {err && <div className="alert error">{err}</div>}
              {editable ? (
                <div className="row">
                  <button className="btn primary" disabled={!changed}>Save new rates</button>
                  {changed && <button type="button" className="btn ghost" onClick={() => { setF(null); setErr(''); }}>Discard changes</button>}
                </div>
              ) : <small className="muted">Only a super admin can change rider pay.</small>}
              <small className="muted">Last changed {dateTime(s.created_at)}{s.created_by_admin_id ? '' : ' (starting values)'}.</small>
            </form>

            <div className="card">
              <div className="card-head"><h3>What a rider earns</h3>{changed && <span className="badge gold">Preview of your changes</span>}</div>
              <table className="tbl">
                <thead><tr><th>Distance</th><th className="num">Now</th>{changed && <th className="num">With changes</th>}</tr></thead>
                <tbody>
                  {[1, 2, 3, 5, 7].map((km) => (
                    <tr key={km}>
                      <td>{km} km</td>
                      <td className="num">{money(payoutFor({ base_payout: n(s.base_payout), per_km_rate: n(s.per_km_rate), min_payout: n(s.min_payout), incentive_per_delivery: n(s.incentive_per_delivery) }, km))}</td>
                      {changed && <td className="num cell-main">{money(payoutFor(values, km))}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {q.data && (
          <div className="card">
            <div className="card-head"><h3>History</h3></div>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>From</th><th className="num">Base</th><th className="num">Per km</th><th className="num">Minimum</th><th className="num">Incentive</th><th>Changed by</th></tr></thead>
                <tbody>
                  {q.data.history.map((h, i) => (
                    <tr key={h.id}>
                      <td className="nowrap">{dateTime(h.created_at)} {i === 0 && <span className="badge green" style={{ marginLeft: 6 }}>In use</span>}</td>
                      <td className="num">{money(h.base_payout)}</td>
                      <td className="num">{money(h.per_km_rate)}</td>
                      <td className="num">{money(h.min_payout)}</td>
                      <td className="num">{money(h.incentive_per_delivery)}</td>
                      <td className="small muted">{h.created_by_admin_name || (h.created_by_admin_id ? `Admin #${h.created_by_admin_id}` : 'Starting values')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </QueryState>

      {confirming && values && (
        <Confirm title="Change rider pay?" confirmLabel="Save new rates" busy={save.isPending} error={save.error}
          message={<>
            New rates apply to every delivery completed from now on. Deliveries already completed keep what they earned.
            <div style={{ marginTop: 8 }}>A 3 km delivery will pay <b>{money(payoutFor(values, 3))}</b>.</div>
          </>}
          onConfirm={() => save.mutate(undefined)} onClose={() => setConfirming(false)} />
      )}
      {save.error && !confirming && <div className="alert error">{errMsg(save.error)}</div>}
    </div>
  );
}
