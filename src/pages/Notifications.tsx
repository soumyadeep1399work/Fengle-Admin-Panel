import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { Confirm, Empty, Field, Modal, Pager, QueryState, Tabs, errMsg, useDebounced } from '../components/ui';
import { useAllCategories } from '../lib/catalog';
import { useAction } from '../lib/hooks';
import { dateTime, num } from '../lib/format';
import { parsePhones } from './Coupons';

// Backend: "Notification centre" in fengle-backend/docs/API.md (super_admin only).
type Kind = 'promotion' | 'service';
type Status = 'scheduled' | 'sending' | 'sent' | 'cancelled' | 'failed';
interface Filters { min_orders?: number; max_orders?: number; inactive_days?: number; ordered_category_id?: number }
type Audience = { type: 'all' } | { type: 'filtered'; filters: Filters } | { type: 'phones'; phones: string[] };
interface Campaign {
  id: number; title: string; body: string; kind: Kind;
  audience: { type: Audience['type']; filters?: Filters | null; phones?: string[] | null };
  scheduled_at: string | null; status: Status;
  targeted_customers: number | null; targeted_devices: number | null; sent_count: number | null; failed_count: number | null;
  error: string | null; created_by_admin_name?: string | null; sent_at: string | null; cancelled_at: string | null; created_at: string;
}
interface Preview { customers: number; devices: number; matched: number; opted_out_excluded: number }

const STATUS: Record<Status, { label: string; tone: string }> = {
  scheduled: { label: 'Scheduled', tone: 'gold' },
  sending: { label: 'Sending…', tone: 'blue' },
  sent: { label: 'Sent', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: '' },
  failed: { label: 'Failed', tone: 'red' },
};

function audienceText(a: Campaign['audience']) {
  if (a.type === 'all') return 'All customers';
  if (a.type === 'phones') { const n = a.phones?.length ?? 0; return `${num(n)} specific customer${n === 1 ? '' : 's'}`; }
  const f = a.filters ?? {};
  const parts: string[] = [];
  if (f.max_orders === 0) parts.push('never ordered');
  else {
    if (f.min_orders != null) parts.push(`${f.min_orders}+ orders`);
    if (f.max_orders != null) parts.push(`≤ ${f.max_orders} orders`);
  }
  if (f.inactive_days != null) parts.push(`inactive ${f.inactive_days}+ days`);
  if (f.ordered_category_id != null) parts.push('ordered a chosen category');
  return parts.length ? `Customers: ${parts.join(', ')}` : 'All customers';
}

export default function Notifications() {
  const [status, setStatus] = useState<'' | Status>('');
  const [page, setPage] = useState(1);
  const [composing, setComposing] = useState(false);
  const [cancelling, setCancelling] = useState<Campaign | null>(null);
  const q = useQuery({
    queryKey: ['/admin/notifications', status, page],
    queryFn: () => api.get<{ campaigns: Campaign[]; total: number }>('/admin/notifications', { status: status || undefined, page, limit: 30 }),
    // A send-now campaign is processed in the background: poll while one is going out.
    refetchInterval: (query) => (query.state.data?.campaigns.some((c) => c.status === 'sending') ? 3000 : false),
  });
  const cancel = useAction((c: Campaign) => api.post(`/admin/notifications/${c.id}/cancel`), {
    success: 'Scheduled notification cancelled', invalidate: ['/admin/notifications'], onDone: () => setCancelling(null),
  });

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Notifications</h1>
          <p>Push notifications to customers' phones: offers, launches and service updates. Send now or schedule for later.</p>
        </div>
        <button className="btn primary" onClick={() => setComposing(true)}>+ New notification</button>
      </div>
      <div className="card">
        <Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={[
          { value: '', label: 'All' }, { value: 'scheduled', label: 'Scheduled' }, { value: 'sent', label: 'Sent' },
          { value: 'failed', label: 'Failed' }, { value: 'cancelled', label: 'Cancelled' },
        ]} />
        <QueryState isLoading={q.isLoading} error={q.error}>
          {(q.data?.campaigns.length ?? 0) === 0 ? <Empty title="No notifications yet">Send your first one to let customers know about an offer or a new cuisine.</Empty> : (
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Notification</th><th>Type</th><th>Audience</th><th>Status</th><th>When</th><th className="num">Delivered</th><th /></tr></thead>
                <tbody>
                  {q.data!.campaigns.map((c) => (
                    <tr key={c.id}>
                      <td style={{ maxWidth: 340 }}>
                        <div className="cell-main">{c.title}</div>
                        <div className="cell-sub" style={{ whiteSpace: 'normal' }}>{c.body}</div>
                      </td>
                      <td><span className={`badge ${c.kind === 'promotion' ? 'violet' : 'blue'}`}>{c.kind === 'promotion' ? 'Promotion' : 'Service update'}</span></td>
                      <td className="small">{audienceText(c.audience)}{c.targeted_customers != null && <div className="cell-sub">{num(c.targeted_customers)} customers · {num(c.targeted_devices ?? 0)} phones</div>}</td>
                      <td>
                        <span className={`badge ${STATUS[c.status].tone}`}>{STATUS[c.status].label}</span>
                        {c.error && <div className="cell-sub" style={{ color: 'var(--red)', maxWidth: 220, whiteSpace: 'normal' }}>{c.error}</div>}
                      </td>
                      <td className="small nowrap">
                        {c.status === 'scheduled' ? <>For {dateTime(c.scheduled_at)}</>
                          : c.status === 'cancelled' ? <>Cancelled {dateTime(c.cancelled_at)}</>
                          : c.sent_at ? <>Sent {dateTime(c.sent_at)}</> : <>Created {dateTime(c.created_at)}</>}
                        <div className="cell-sub">by {c.created_by_admin_name || 'admin'}</div>
                      </td>
                      <td className="num">
                        {c.sent_count != null && ['sent', 'failed', 'sending'].includes(c.status) ? <><b>{num(c.sent_count)}</b>{!!c.failed_count && <div className="cell-sub" style={{ color: 'var(--red)' }}>{num(c.failed_count)} failed</div>}</> : <span className="muted">—</span>}
                      </td>
                      <td className="right">{c.status === 'scheduled' && <button className="btn sm ghost" onClick={() => setCancelling(c)}>Cancel</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={page} limit={30} total={q.data?.total} count={q.data?.campaigns.length ?? 0} onPage={setPage} />
        </QueryState>
        <div className="pager"><span className="muted small">"Delivered" counts phones that accepted the push. Promotions skip customers who turned "Offers &amp; news" off; service updates reach everyone targeted.</span></div>
      </div>

      {composing && <Composer onClose={() => setComposing(false)} />}
      {cancelling && (
        <Confirm title="Cancel this scheduled notification?" danger confirmLabel="Cancel notification" busy={cancel.isPending} error={cancel.error}
          message={<>“{cancelling.title}” was going out {dateTime(cancelling.scheduled_at)}. Nothing will be sent.</>}
          onConfirm={() => cancel.mutate(cancelling)} onClose={() => setCancelling(null)} />
      )}
    </div>
  );
}

const pad = (x: number) => String(x).padStart(2, '0');
const toLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

function Composer({ onClose }: { onClose: () => void }) {
  const cats = useAllCategories();
  const [kind, setKind] = useState<Kind>('promotion');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audType, setAudType] = useState<Audience['type']>('all');
  const [filters, setFilters] = useState({ min_orders: '', max_orders: '', inactive_days: '', ordered_category_id: '' });
  const [phones, setPhones] = useState('');
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [scheduledAt, setScheduledAt] = useState(toLocal(new Date(Date.now() + 60 * 60000)));
  const [err, setErr] = useState('');
  const [confirming, setConfirming] = useState(false);
  const parsed = useMemo(() => parsePhones(phones), [phones]);

  const audience: Audience = useMemo(() => {
    if (audType === 'phones') return { type: 'phones', phones: parsed.phones };
    if (audType === 'filtered') {
      const f: Filters = {};
      for (const [k, v] of Object.entries(filters)) if (v !== '') (f as Record<string, number>)[k] = Number(v);
      return { type: 'filtered', filters: f };
    }
    return { type: 'all' };
  }, [audType, filters, parsed.phones]);

  // Live "this will reach N" line; sends nothing.
  const previewKey = useDebounced(JSON.stringify({ kind, audience }), 500);
  const preview = useQuery({
    queryKey: ['/admin/notifications/preview', previewKey],
    queryFn: () => api.post<Preview>('/admin/notifications/preview', JSON.parse(previewKey)),
    enabled: !(audType === 'phones' && parsed.phones.length === 0),
  });
  useEffect(() => { setErr(''); }, [kind, audType]);

  const send = useAction(() => api.post('/admin/notifications', {
    title: title.trim(), body: body.trim(), kind, audience,
    ...(when === 'later' ? { scheduled_at: new Date(scheduledAt).toISOString() } : {}),
  }), { success: when === 'now' ? 'Sending now' : 'Notification scheduled', invalidate: ['/admin/notifications'], onDone: onClose });

  function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (!title.trim()) return setErr('Write a title.');
    if (!body.trim()) return setErr('Write the message.');
    if (audType === 'phones') {
      if (parsed.invalid.length) return setErr(`These aren’t valid 10-digit numbers: ${parsed.invalid.slice(0, 5).join(', ')}`);
      if (parsed.phones.length === 0) return setErr('Paste at least one phone number.');
      if (parsed.phones.length > 5000) return setErr('At most 5,000 phone numbers per notification.');
    }
    if (audType === 'filtered' && Object.values(filters).every((v) => v === '')) return setErr('Set at least one filter, or choose “All customers”.');
    if (Object.values(filters).some((v) => v !== '' && !(Number.isInteger(Number(v)) && Number(v) >= 0))) return setErr('Filters must be whole numbers.');
    if (when === 'later') {
      const t = new Date(scheduledAt).getTime();
      if (!(t > Date.now() + 60_000)) return setErr('Schedule at least a minute from now.');
      if (t > Date.now() + 365 * 86400000) return setErr('Schedule within the next year.');
    }
    setConfirming(true);
  }

  const p = preview.data;
  const setF = (k: keyof typeof filters, v: string) => setFilters((x) => ({ ...x, [k]: v }));

  return (
    <Modal wide title="New notification" onClose={onClose} footer={<>
      <button className="btn" type="button" onClick={onClose}>Cancel</button>
      <button className="btn primary" form="notif-form" disabled={send.isPending}>{when === 'now' ? 'Send now…' : 'Schedule…'}</button>
    </>}>
      <form id="notif-form" className="stack" onSubmit={submit}>
        <Field label="Type">
          <div className="stack" style={{ gap: 6 }}>
            <label className="check" style={{ alignItems: 'flex-start' }}>
              <input type="radio" checked={kind === 'promotion'} onChange={() => setKind('promotion')} style={{ marginTop: 3 }} />
              <span>Promotion <span className="muted" style={{ fontWeight: 500 }}>— offers, discounts, new cuisines. Skips customers who turned “Offers &amp; news” off.</span></span>
            </label>
            <label className="check" style={{ alignItems: 'flex-start' }}>
              <input type="radio" checked={kind === 'service'} onChange={() => setKind('service')} style={{ marginTop: 3 }} />
              <span>Service update <span className="muted" style={{ fontWeight: 500 }}>— important news like delivery hours or outages. Reaches everyone targeted. Don't use it for marketing.</span></span>
            </label>
          </div>
        </Field>

        <div className="grid-2" style={{ alignItems: 'start' }}>
          <div className="stack">
            <Field label={`Title (${title.length}/100)`}><input className="input" value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} placeholder="Weekend biryani fest 🍛" autoFocus /></Field>
            <Field label={`Message (${body.length}/500)`}><textarea className="textarea" value={body} maxLength={500} onChange={(e) => setBody(e.target.value)} placeholder="Flat ₹50 off every biryani this Saturday and Sunday." /></Field>
          </div>
          <div className="phone-preview" aria-label="Preview">
            <div className="pp-app"><span className="pp-dot" />Fengle · now</div>
            <div className="pp-title">{title || 'Your title'}</div>
            <div className="pp-body">{body || 'Your message appears here.'}</div>
          </div>
        </div>

        <Field label="Who gets it">
          <div className="row">
            {(['all', 'filtered', 'phones'] as const).map((t) => (
              <label key={t} className="check"><input type="radio" checked={audType === t} onChange={() => setAudType(t)} />
                {t === 'all' ? 'All customers' : t === 'filtered' ? 'Customers matching filters' : 'Specific phone numbers'}</label>
            ))}
          </div>
        </Field>
        {audType === 'filtered' && (
          <div className="grid-2">
            <Field label="Min orders"><input className="input" type="number" min="0" value={filters.min_orders} onChange={(e) => setF('min_orders', e.target.value)} /></Field>
            <Field label="Max orders" hint="0 = never ordered"><input className="input" type="number" min="0" value={filters.max_orders} onChange={(e) => setF('max_orders', e.target.value)} /></Field>
            <Field label="No order in the last … days"><input className="input" type="number" min="0" value={filters.inactive_days} onChange={(e) => setF('inactive_days', e.target.value)} /></Field>
            <Field label="Has ordered from category">
              <select className="select" value={filters.ordered_category_id} onChange={(e) => setF('ordered_category_id', e.target.value)}>
                <option value="">Any</option>
                {(cats.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          </div>
        )}
        {audType === 'phones' && (
          <Field label="Phone numbers" hint={`${parsed.phones.length} valid${parsed.invalid.length ? ` · ${parsed.invalid.length} not recognised` : ''}. One per line or comma-separated; +91 is fine. Up to 5,000.`}>
            <textarea className="textarea mono" rows={4} value={phones} onChange={(e) => setPhones(e.target.value)} />
          </Field>
        )}

        <div className={`alert ${p && p.devices === 0 ? 'warn' : 'info'}`}>
          {preview.isLoading || preview.isFetching ? 'Counting…'
            : preview.error ? errMsg(preview.error)
            : p ? (
              <>Will reach <b>{num(p.customers)}</b> customer{p.customers === 1 ? '' : 's'} on <b>{num(p.devices)}</b> phone{p.devices === 1 ? '' : 's'}.
                {kind === 'promotion' && p.opted_out_excluded > 0 && <> {num(p.opted_out_excluded)} who turned offers off are skipped.</>}
                {p.devices === 0 && <> Nobody here has the app with notifications enabled, so nothing would be delivered.</>}
              </>
            ) : 'Paste phone numbers to see who it reaches.'}
        </div>

        <Field label="When">
          <div className="row">
            <label className="check"><input type="radio" checked={when === 'now'} onChange={() => setWhen('now')} /> Send now</label>
            <label className="check"><input type="radio" checked={when === 'later'} onChange={() => setWhen('later')} /> Schedule</label>
            {when === 'later' && <input className="input" style={{ width: 'auto' }} type="datetime-local" value={scheduledAt} min={toLocal(new Date(Date.now() + 2 * 60000))} onChange={(e) => setScheduledAt(e.target.value)} />}
          </div>
          {when === 'later' && <small className="muted">Goes out within a minute of this time. You can cancel it until then.</small>}
        </Field>
        {(err || send.error) && <div className="alert error">{err || errMsg(send.error)}</div>}
      </form>

      {confirming && (
        <Confirm title={when === 'now' ? 'Send this notification now?' : 'Schedule this notification?'} confirmLabel={when === 'now' ? 'Send now' : 'Schedule'}
          busy={send.isPending} error={send.error}
          message={<>
            <b>{title}</b> goes to {p ? <>about <b>{num(p.customers)}</b> customer{p.customers === 1 ? '' : 's'}</> : 'the chosen customers'}
            {when === 'later' ? <> on {dateTime(new Date(scheduledAt).toISOString())}. You can cancel it before then.</> : <>. A sent notification can't be taken back.</>}
          </>}
          onConfirm={() => send.mutate(undefined)} onClose={() => setConfirming(false)} />
      )}
    </Modal>
  );
}
