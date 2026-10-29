import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ShippingHistoryRow, ShippingKind, ShippingRule, ShippingZone } from '../api/types';
import { useCan } from '../auth';
import ShippingPreview from '../components/ShippingPreview';
import ShippingRuleEditor from '../components/ShippingRuleEditor';
import ShippingZoneEditor from '../components/ShippingZoneEditor';
import { Badge, Confirm, Empty, Pager, QueryState, Tabs } from '../components/ui';
import { bool, dateTime } from '../lib/format';
import { useAction, useList } from '../lib/hooks';
import {
  KIND_HELP, KIND_LABEL, TYPE_LABEL, TYPE_TONE, describeCharge, describeConditions, describeZone, ruleStatus,
} from '../lib/shipping';

type Tab = ShippingKind | 'zones' | 'history';
const INVALIDATE = ['/admin/shipping'];

export default function Shipping() {
  const [tab, setTab] = useState<Tab>('customer_fee');
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Shipping charges</h1>
          <p>Set what customers pay for delivery and what riders earn, with special rules for distance, order value, time of day and area. Every rate is managed here.</p>
        </div>
      </div>
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[
        { value: 'customer_fee', label: KIND_LABEL.customer_fee },
        { value: 'rider_pay', label: KIND_LABEL.rider_pay },
        { value: 'zones', label: 'Zones' },
        { value: 'history', label: 'History' },
      ]} />
      {(tab === 'customer_fee' || tab === 'rider_pay') && <RulesTab key={tab} kind={tab} />}
      {tab === 'zones' && <ZonesTab />}
      {tab === 'history' && <HistoryTab />}
    </div>
  );
}

function useZones() {
  return useQuery({ queryKey: ['/admin/shipping/zones'], queryFn: () => api.get<{ zones: ShippingZone[] }>('/admin/shipping/zones') });
}

/* ---------- rules ---------- */

function RulesTab({ kind }: { kind: ShippingKind }) {
  const can = useCan();
  const editable = can('money');
  const zonesQ = useZones();
  const rulesQ = useQuery({
    queryKey: ['/admin/shipping/rules', kind],
    queryFn: () => api.get<{ rules: ShippingRule[] }>('/admin/shipping/rules', { kind }),
  });
  const zones = zonesQ.data?.zones ?? [];
  const rules = rulesQ.data?.rules ?? [];

  const [editor, setEditor] = useState<{ rule?: ShippingRule; zoneId: number | null } | null>(null);
  const [deleting, setDeleting] = useState<ShippingRule | null>(null);

  const reorder = useAction((v: { zone_id: number | null; ids: number[] }) => api.post('/admin/shipping/rules/reorder', { kind, ...v }), { invalidate: INVALIDATE });
  const toggle = useAction((r: ShippingRule) => api.patch(`/admin/shipping/rules/${r.id}`, { is_active: !bool(r.is_active) }), { success: 'Updated.', invalidate: INVALIDATE });
  const remove = useAction((id: number) => api.del(`/admin/shipping/rules/${id}`), { success: 'Rule deleted.', invalidate: INVALIDATE, onDone: () => setDeleting(null) });

  const hasDefaultBase = rules.some((r) => r.zone_id == null && r.type === 'base' && bool(r.is_active) && !r.valid_from && !r.valid_to);

  // Everywhere first, then zones in their own order.
  const groups: { zone: ShippingZone | null; title: string }[] = [
    { zone: null, title: 'Everywhere (default)' },
    ...zones.map((z) => ({ zone: z, title: z.name })),
  ];

  function move(zoneId: number | null, active: ShippingRule[], index: number, dir: -1 | 1) {
    const to = index + dir;
    if (to < 0 || to >= active.length) return;
    const ids = active.map((r) => r.id);
    [ids[index], ids[to]] = [ids[to], ids[index]];
    reorder.mutate({ zone_id: zoneId, ids });
  }

  return (
    <div className="stack">
      <div className="alert info">
        <b>{KIND_HELP[kind]}</b>
        <div className="small" style={{ marginTop: 4 }}>
          How it’s worked out: the first matching <b>Base charge</b> sets the amount (a rule for the delivery’s zone beats an “Everywhere” rule), then every matching <b>Extra charge</b> is added, then <b>Minimum</b> / <b>Maximum</b> are applied{kind === 'customer_fee' ? <>, and last <b>Free delivery</b></> : null}. Rules higher in a list are checked first. Because Extra charges are added before the Minimum is applied, a flat bonus counts toward the minimum.
        </div>
      </div>

      <QueryState isLoading={rulesQ.isLoading || zonesQ.isLoading} error={rulesQ.error || zonesQ.error}>
        {!hasDefaultBase && (
          <div className="alert warn">
            There is no active “Everywhere” base charge, so the apps are using their old built-in {kind === 'customer_fee' ? 'delivery fee' : 'pay'} rule. Add a base charge below to take over.
          </div>
        )}

        {groups.map(({ zone, title }) => {
          const group = rules.filter((r) => (r.zone_id ?? null) === (zone ? zone.id : null));
          const active = group.filter((r) => bool(r.is_active));
          return (
            <div className="card" key={zone ? zone.id : 'all'}>
              <div className="card-head">
                <div>
                  <h3>{title} {zone && !bool(zone.is_active) && <Badge>Zone off</Badge>}</h3>
                  {zone && <small className="muted">{describeZone(zone)}</small>}
                </div>
                {editable && <button className="btn sm primary" onClick={() => setEditor({ zoneId: zone ? zone.id : null })}>Add a rule</button>}
              </div>
              {group.length === 0 ? (
                <Empty title="No rules here">{zone ? 'Deliveries in this zone use the Everywhere rules.' : 'Add a base charge to set the default.'}</Empty>
              ) : (
                <div className="table-wrap">
                  <table className="tbl">
                    <thead><tr>{editable && <th style={{ width: 70 }}>Order</th>}<th>Rule</th><th>Applies when</th><th>Charge</th><th>Status</th>{editable && <th />}</tr></thead>
                    <tbody>
                      {group.map((r) => {
                        const st = ruleStatus(r);
                        const ai = active.findIndex((x) => x.id === r.id);
                        const conds = describeConditions(r.conditions);
                        return (
                          <tr key={r.id}>
                            {editable && (
                              <td className="nowrap">
                                {ai >= 0 && (
                                  <>
                                    <button className="btn sm" title="Check earlier" disabled={ai === 0 || reorder.isPending} onClick={() => move(zone ? zone.id : null, active, ai, -1)}>↑</button>{' '}
                                    <button className="btn sm" title="Check later" disabled={ai === active.length - 1 || reorder.isPending} onClick={() => move(zone ? zone.id : null, active, ai, 1)}>↓</button>
                                  </>
                                )}
                              </td>
                            )}
                            <td>
                              <div className="cell-main">{r.name}</div>
                              <div className="row" style={{ gap: 6 }}><Badge tone={TYPE_TONE[r.type]}>{TYPE_LABEL[r.type]}</Badge>{r.is_last_everywhere_base && <Badge tone="blue">Default — can’t be removed</Badge>}</div>
                            </td>
                            <td className="small">
                              {conds.length > 0 ? conds.join(' · ') : <span className="muted">Every delivery</span>}
                              {(r.valid_from || r.valid_to) && <div className="muted">{r.valid_from ? `from ${dateTime(r.valid_from)}` : ''}{r.valid_from && r.valid_to ? ' ' : ''}{r.valid_to ? `until ${dateTime(r.valid_to)}` : ''}</div>}
                            </td>
                            <td className="small">{describeCharge(r.type, r.charge)}</td>
                            <td><Badge tone={st.tone} dot>{st.label}</Badge></td>
                            {editable && (
                              <td className="nowrap right">
                                <button className="btn sm" disabled={!!r.is_last_everywhere_base || toggle.isPending} title={r.is_last_everywhere_base ? 'Every delivery needs a default base charge' : ''} onClick={() => toggle.mutate(r)}>{bool(r.is_active) ? 'Turn off' : 'Turn on'}</button>{' '}
                                <button className="btn sm" onClick={() => setEditor({ rule: r, zoneId: r.zone_id })}>Edit</button>{' '}
                                <button className="btn sm danger" disabled={!!r.is_last_everywhere_base} title={r.is_last_everywhere_base ? 'Every delivery needs a default base charge' : ''} onClick={() => setDeleting(r)}>Delete</button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}

        {!editable && <small className="muted">Only a super admin can change shipping charges.</small>}

        <ShippingPreview kind={kind} zones={zones.filter((z) => bool(z.is_active))} />
      </QueryState>

      {editor && <ShippingRuleEditor kind={kind} rule={editor.rule} presetZoneId={editor.zoneId} zones={zones} onClose={() => setEditor(null)} />}
      {deleting && (
        <Confirm danger title="Delete this rule?" confirmLabel="Delete rule" busy={remove.isPending} error={remove.error}
          message={<>“{deleting.name}” will stop applying straight away. Deliveries already completed keep what they were charged or paid.</>}
          onConfirm={() => remove.mutate(deleting.id)} onClose={() => setDeleting(null)} />
      )}
    </div>
  );
}

/* ---------- zones ---------- */

function ZonesTab() {
  const can = useCan();
  const editable = can('money');
  const q = useZones();
  const zones = q.data?.zones ?? [];
  const [editor, setEditor] = useState<{ zone?: ShippingZone } | null>(null);
  const [deleting, setDeleting] = useState<ShippingZone | null>(null);

  const reorder = useAction((ids: number[]) => api.post('/admin/shipping/zones/reorder', { ids }), { invalidate: INVALIDATE });
  const remove = useAction((id: number) => api.del(`/admin/shipping/zones/${id}`), { success: 'Zone deleted.', invalidate: INVALIDATE, onDone: () => setDeleting(null) });

  const active = zones.filter((z) => bool(z.is_active));
  function move(z: ShippingZone, dir: -1 | 1) {
    const i = active.findIndex((x) => x.id === z.id);
    const to = i + dir;
    if (i < 0 || to < 0 || to >= active.length) return;
    const ids = active.map((x) => x.id);
    [ids[i], ids[to]] = [ids[to], ids[i]];
    reorder.mutate(ids);
  }

  return (
    <div className="stack">
      <div className="alert info">
        A zone is an area of the city. Rules you attach to a zone apply to deliveries dropped inside it and override the “Everywhere” rules. If a drop-off falls in several zones, the one higher in this list wins.
      </div>
      <QueryState isLoading={q.isLoading} error={q.error}>
        <div className="card">
          <div className="card-head">
            <h3>Zones</h3>
            {editable && <button className="btn sm primary" onClick={() => setEditor({})}>Add a zone</button>}
          </div>
          {zones.length === 0 ? <Empty title="No zones yet">Everything uses the “Everywhere” rules. Add a zone to price an area differently.</Empty> : (
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr>{editable && <th style={{ width: 70 }}>Order</th>}<th>Zone</th><th>Area</th><th>Status</th>{editable && <th />}</tr></thead>
                <tbody>
                  {zones.map((z) => {
                    const ai = active.findIndex((x) => x.id === z.id);
                    return (
                      <tr key={z.id}>
                        {editable && (
                          <td className="nowrap">
                            {ai >= 0 && (
                              <>
                                <button className="btn sm" disabled={ai === 0 || reorder.isPending} onClick={() => move(z, -1)}>↑</button>{' '}
                                <button className="btn sm" disabled={ai === active.length - 1 || reorder.isPending} onClick={() => move(z, 1)}>↓</button>
                              </>
                            )}
                          </td>
                        )}
                        <td className="cell-main">{z.name}</td>
                        <td className="small">{describeZone(z)}</td>
                        <td><Badge tone={bool(z.is_active) ? 'green' : ''} dot>{bool(z.is_active) ? 'On' : 'Off'}</Badge></td>
                        {editable && (
                          <td className="nowrap right">
                            <button className="btn sm" onClick={() => setEditor({ zone: z })}>Edit</button>{' '}
                            <button className="btn sm danger" onClick={() => setDeleting(z)}>Delete</button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </QueryState>
      {editor && <ShippingZoneEditor zone={editor.zone} onClose={() => setEditor(null)} />}
      {deleting && (
        <Confirm danger title="Delete this zone?" confirmLabel="Delete zone" busy={remove.isPending} error={remove.error}
          message={<>“{deleting.name}” and all the rules attached to it will be removed. Deliveries there will use the “Everywhere” rules from now on. Deliveries already completed are not changed.</>}
          onConfirm={() => remove.mutate(deleting.id)} onClose={() => setDeleting(null)} />
      )}
    </div>
  );
}

/* ---------- history ---------- */

const ACTION_LABEL: Record<string, string> = { create: 'Added', update: 'Changed', delete: 'Deleted', reorder: 'Reordered' };
const ACTION_TONE: Record<string, string> = { create: 'green', update: 'blue', delete: 'red', reorder: '' };

function nameOf(row: ShippingHistoryRow): string {
  const pick = (v: unknown) => (v && typeof v === 'object' ? (v as { name?: string }).name : undefined);
  const named = pick(row.after) || pick(row.before);
  if (named) return named;
  return row.action === 'reorder' ? `Order changed (${row.entity === 'zone' ? 'zone' : 'rule'} #${row.entity_id} moved)` : `#${row.entity_id}`;
}

function HistoryTab() {
  const [page, setPage] = useState(1);
  const [kind, setKind] = useState('');
  const limit = 25;
  const { data, isLoading, error } = useList<ShippingHistoryRow>('/admin/shipping/history', 'history', { page, limit, kind: kind || undefined });
  const rows = data?.rows ?? [];

  return (
    <div className="card">
      <div className="card-head">
        <h3>Change history</h3>
        <select className="input" style={{ maxWidth: 220 }} value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }}>
          <option value="">Everything</option>
          <option value="customer_fee">{KIND_LABEL.customer_fee}</option>
          <option value="rider_pay">{KIND_LABEL.rider_pay}</option>
        </select>
      </div>
      <QueryState isLoading={isLoading} error={error}>
        {rows.length === 0 ? <Empty title="No changes yet" /> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>When</th><th>What</th><th>Which</th><th>Set</th><th>By</th></tr></thead>
              <tbody>
                {rows.map((h) => (
                  <tr key={h.id}>
                    <td className="nowrap">{dateTime(h.created_at)}</td>
                    <td><Badge tone={ACTION_TONE[h.action]}>{ACTION_LABEL[h.action] ?? h.action}</Badge></td>
                    <td className="cell-main">{h.entity === 'zone' ? 'Zone: ' : ''}{nameOf(h)}</td>
                    <td className="small muted">{h.kind ? KIND_LABEL[h.kind] : '—'}</td>
                    <td className="small muted">{h.admin_name || (h.admin_id ? `Admin #${h.admin_id}` : 'System')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} limit={limit} total={data?.total} count={rows.length} onPage={setPage} />
      </QueryState>
    </div>
  );
}
