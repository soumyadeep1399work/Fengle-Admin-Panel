import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { api } from '../api/client';
import type { Coupon, CouponTarget, Customer } from '../api/types';
import { Confirm, Empty, Field, Modal, Pager, QueryState, errMsg } from '../components/ui';
import { useAction, useList } from '../lib/hooks';
import { bool, dateTime, money, num } from '../lib/format';

const LIMIT = 50;

const TARGETS: { value: CouponTarget; label: string; hint: string }[] = [
  { value: 'new_users', label: 'New customers', hint: 'Have never placed an order' },
  { value: 'inactive_users', label: 'Inactive customers', hint: 'No order in the last N days' },
  { value: 'selected_users', label: 'Specific customers', hint: 'A list of phone numbers you paste in' },
  { value: 'all', label: 'All customers', hint: 'Everyone with the app' },
];

function discountText(c: Coupon) {
  if (c.discount_type === 'flat') return `${money(c.discount_value)} off`;
  const cap = c.max_discount_amount != null ? ` up to ${money(c.max_discount_amount)}` : '';
  return `${Number(c.discount_value)}% off${cap}`;
}

function targetText(c: Coupon) {
  switch (c.target_type) {
    case 'new_users': return 'New customers';
    case 'inactive_users': return `Inactive ${c.target_meta?.days ?? 30}+ days`;
    case 'selected_users': { const n = c.target_meta?.phones?.length ?? 0; return `${n} specific customer${n === 1 ? '' : 's'}`; }
    default: return 'All customers';
  }
}

function couponState(c: Coupon): { label: string; tone: string } {
  const now = Date.now();
  if (!bool(c.is_active)) return { label: 'Off', tone: '' };
  if (c.valid_until && new Date(c.valid_until).getTime() < now) return { label: 'Expired', tone: 'red' };
  if (c.valid_from && new Date(c.valid_from).getTime() > now) return { label: 'Scheduled', tone: 'gold' };
  if (c.total_usage_limit != null && (c.redemption_count ?? 0) >= c.total_usage_limit) return { label: 'Used up', tone: 'blue' };
  return { label: 'Live', tone: 'green' };
}

export default function Coupons() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useList<Coupon>('/admin/coupons', 'coupons', { page, limit: LIMIT });
  const [editing, setEditing] = useState<Coupon | 'new' | null>(null);
  const [toggling, setToggling] = useState<Coupon | null>(null);

  const toggle = useAction((c: Coupon) => api.patch(`/admin/coupons/${c.id}`, { is_active: !bool(c.is_active) }), {
    success: 'Coupon updated', invalidate: ['/admin/coupons'], onDone: () => setToggling(null),
  });

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Coupons</h1>
          <p>Discount codes for a chosen group of customers. Creating a live coupon sends a push notification to that group.</p>
        </div>
        <button className="btn primary" onClick={() => setEditing('new')}>+ New coupon</button>
      </div>
      <div className="card">
        <QueryState isLoading={isLoading} error={error}>
          {(data?.rows.length ?? 0) === 0 ? <Empty title="No coupons yet">Create one to bring customers back or welcome new ones.</Empty> : (
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Coupon</th><th>Status</th><th>Discount</th><th>Who can use it</th><th className="num">Used</th><th>Valid</th><th /></tr></thead>
                <tbody>
                  {data!.rows.map((c) => {
                    const st = couponState(c);
                    return (
                      <tr key={c.id}>
                        <td><div className="cell-main mono">{c.code}</div><div className="cell-sub">{c.title}</div></td>
                        <td><span className={`badge ${st.tone}`}>{st.label}</span></td>
                        <td>{discountText(c)}<div className="cell-sub">{Number(c.min_order_value) > 0 ? `Min order ${money(c.min_order_value)}` : 'No minimum'}</div></td>
                        <td>{targetText(c)}<div className="cell-sub">{c.usage_limit_per_user}× per customer</div></td>
                        <td className="num">{num(c.redemption_count ?? 0)}{c.total_usage_limit != null && <span className="muted"> / {num(c.total_usage_limit)}</span>}</td>
                        <td className="small nowrap">
                          {c.valid_from ? dateTime(c.valid_from) : 'Now'} →<br />{c.valid_until ? dateTime(c.valid_until) : 'No end date'}
                        </td>
                        <td className="right nowrap">
                          <button className="btn sm ghost" onClick={() => setEditing(c)}>Edit</button>
                          <button className="btn sm ghost" onClick={() => setToggling(c)}>{bool(c.is_active) ? 'Turn off' : 'Turn on'}</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={page} limit={LIMIT} total={data?.total} count={data?.rows.length ?? 0} onPage={setPage} />
        </QueryState>
      </div>

      {editing && <CouponForm coupon={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {toggling && (
        <Confirm title={`${bool(toggling.is_active) ? 'Turn off' : 'Turn on'} ${toggling.code}?`} danger={bool(toggling.is_active)}
          confirmLabel={bool(toggling.is_active) ? 'Turn off' : 'Turn on'}
          message={bool(toggling.is_active)
            ? 'Customers can no longer apply this code at checkout. Orders that already used it keep their discount.'
            : 'Customers in its target group can apply this code again. No new push notification is sent.'}
          busy={toggle.isPending} error={toggle.error} onConfirm={() => toggle.mutate(toggling)} onClose={() => setToggling(null)} />
      )}
    </div>
  );
}

/** datetime-local value (local time) <-> ISO string */
function toLocalInput(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

/** Pulls 10-digit Indian mobile numbers out of pasted text (strips +91 / 0 prefixes, de-dupes). */
export function parsePhones(text: string): { phones: string[]; invalid: string[] } {
  const phones = new Set<string>();
  const invalid: string[] = [];
  for (const part of text.split(/[\n,;]+/)) {
    const raw = part.trim();
    if (!raw) continue;
    let d = raw.replace(/\D/g, '');
    if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
    if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
    if (d.length === 10) phones.add(d); else invalid.push(raw);
  }
  return { phones: [...phones], invalid };
}

function CouponForm({ coupon, onClose }: { coupon?: Coupon; onClose: () => void }) {
  const editing = !!coupon;
  const [f, setF] = useState({
    code: coupon?.code ?? '',
    title: coupon?.title ?? '',
    description: coupon?.description ?? '',
    discount_type: coupon?.discount_type ?? ('flat' as Coupon['discount_type']),
    discount_value: coupon ? String(Number(coupon.discount_value)) : '',
    max_discount_amount: coupon?.max_discount_amount != null ? String(Number(coupon.max_discount_amount)) : '',
    min_order_value: coupon && Number(coupon.min_order_value) > 0 ? String(Number(coupon.min_order_value)) : '',
    target_type: coupon?.target_type ?? ('new_users' as CouponTarget),
    days: String(coupon?.target_meta?.days ?? 30),
    phones: (coupon?.target_meta?.phones ?? []).join('\n'),
    usage_limit_per_user: String(coupon?.usage_limit_per_user ?? 1),
    total_usage_limit: coupon?.total_usage_limit != null ? String(coupon.total_usage_limit) : '',
    valid_from: toLocalInput(coupon?.valid_from),
    valid_until: toLocalInput(coupon?.valid_until),
    is_active: coupon ? bool(coupon.is_active) : true,
  });
  const [err, setErr] = useState('');
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const parsed = useMemo(() => parsePhones(f.phones), [f.phones]);
  const errRef = useRef<HTMLDivElement>(null);

  // Rough audience size from the customers endpoint (active, promotions allowed) — the push goes to these people.
  const audienceQuery = f.target_type === 'new_users' ? { max_orders: 0 }
    : f.target_type === 'inactive_users' ? { inactive_days: Number(f.days) || 30 }
    : {};
  const audience = useList<Customer>('/admin/customers', 'customers', { status: 'active', promo_opt_in: true, limit: 1, page: 1, ...audienceQuery });
  const audienceCount = f.target_type === 'selected_users' ? parsed.phones.length : audience.data?.total;

  const startsLater = !!f.valid_from && new Date(f.valid_from).getTime() > Date.now();
  const willPush = !editing && f.is_active && !startsLater;

  const save = useAction(async () => {
    const body = {
      code: f.code.trim().toUpperCase(),
      title: f.title.trim(),
      description: f.description.trim() || null,
      discount_type: f.discount_type,
      discount_value: Number(f.discount_value),
      max_discount_amount: f.discount_type === 'percent' && f.max_discount_amount ? Number(f.max_discount_amount) : null,
      min_order_value: f.min_order_value ? Number(f.min_order_value) : 0,
      target_type: f.target_type,
      target_meta: f.target_type === 'inactive_users' ? { days: Number(f.days) }
        : f.target_type === 'selected_users' ? { phones: parsed.phones }
        : null,
      usage_limit_per_user: Number(f.usage_limit_per_user) || 1,
      total_usage_limit: f.total_usage_limit ? Number(f.total_usage_limit) : null,
      valid_from: fromLocalInput(f.valid_from),
      valid_until: fromLocalInput(f.valid_until),
      is_active: f.is_active,
    };
    if (editing) await api.patch(`/admin/coupons/${coupon.id}`, body);
    else await api.post('/admin/coupons', body);
  }, {
    success: editing ? 'Coupon saved' : willPush ? 'Coupon created and customers notified' : 'Coupon created',
    invalidate: ['/admin/coupons'], onDone: onClose,
  });

  // The form scrolls inside the modal, so bring a new error into view.
  useEffect(() => {
    if (err || save.error) errRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [err, save.error]);

  function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    const v = Number(f.discount_value);
    if (!/^[A-Za-z0-9]{3,20}$/.test(f.code.trim())) return setErr('Code must be 3–20 letters or numbers, with no spaces.');
    if (!f.title.trim()) return setErr('Give the coupon a short title. Customers see it in the app and in the notification.');
    if (!(v > 0)) return setErr('Enter a discount value above zero.');
    if (f.discount_type === 'percent' && v > 100) return setErr('A percent discount can’t be more than 100.');
    if (f.target_type === 'inactive_users' && !(Number(f.days) >= 1)) return setErr('Enter the number of inactive days (1 or more).');
    if (f.target_type === 'selected_users') {
      if (parsed.invalid.length) return setErr(`These aren’t valid 10-digit numbers: ${parsed.invalid.slice(0, 5).join(', ')}${parsed.invalid.length > 5 ? '…' : ''}`);
      if (parsed.phones.length === 0) return setErr('Paste at least one phone number.');
    }
    if (f.valid_from && f.valid_until && new Date(f.valid_until) <= new Date(f.valid_from)) return setErr('“Valid until” must be after “Valid from”.');
    if (!editing && f.valid_until && new Date(f.valid_until).getTime() < Date.now()) return setErr('“Valid until” is already in the past.');
    save.mutate(undefined);
  }

  return (
    <Modal wide title={editing ? `Edit ${coupon.code}` : 'New coupon'} onClose={onClose} footer={<>
      <button className="btn" type="button" onClick={onClose}>Cancel</button>
      <button className="btn primary" form="coupon-form" disabled={save.isPending}>
        {save.isPending ? 'Saving…' : editing ? 'Save changes' : willPush ? 'Create & notify' : 'Create coupon'}
      </button>
    </>}>
      <form id="coupon-form" className="stack" onSubmit={submit}>
        <div className="grid-2">
          <Field label="Code" hint="What customers type at checkout, e.g. WELCOME50.">
            <input className="input mono" value={f.code} maxLength={20} onChange={(e) => set('code', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} required autoFocus={!editing} />
          </Field>
          <Field label="Title" hint="Shown in the app and as the notification title.">
            <input className="input" value={f.title} maxLength={80} onChange={(e) => set('title', e.target.value)} placeholder="₹50 off your first order" required />
          </Field>
        </div>
        <Field label="Description (optional)"><input className="input" value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>

        <div className="grid-3">
          <Field label="Discount type">
            <select className="select" value={f.discount_type} onChange={(e) => set('discount_type', e.target.value as Coupon['discount_type'])}>
              <option value="flat">Flat ₹ off</option>
              <option value="percent">Percent % off</option>
            </select>
          </Field>
          <Field label={f.discount_type === 'flat' ? 'Amount off (₹)' : 'Percent off (%)'}>
            <input className="input" type="number" min="1" max={f.discount_type === 'percent' ? 100 : undefined} step="1" value={f.discount_value} onChange={(e) => set('discount_value', e.target.value)} required />
          </Field>
          {f.discount_type === 'percent' ? (
            <Field label="Max discount (₹)" hint="Blank = no cap">
              <input className="input" type="number" min="1" value={f.max_discount_amount} onChange={(e) => set('max_discount_amount', e.target.value)} />
            </Field>
          ) : (
            <Field label="Min order value (₹)" hint="Blank = none">
              <input className="input" type="number" min="0" value={f.min_order_value} onChange={(e) => set('min_order_value', e.target.value)} />
            </Field>
          )}
        </div>
        {f.discount_type === 'percent' && (
          <Field label="Min order value (₹)" hint="Blank = none">
            <input className="input" type="number" min="0" value={f.min_order_value} onChange={(e) => set('min_order_value', e.target.value)} style={{ maxWidth: 220 }} />
          </Field>
        )}
        <small className="muted">The discount comes off the food total only, never delivery or GST.</small>

        <hr className="sep" />
        <Field label="Who can use it">
          <div className="stack" style={{ gap: 6 }}>
            {TARGETS.map((t) => (
              <label key={t.value} className="check" style={{ alignItems: 'flex-start' }}>
                <input type="radio" name="target" checked={f.target_type === t.value} onChange={() => set('target_type', t.value)} style={{ marginTop: 3 }} />
                <span>{t.label} <span className="muted" style={{ fontWeight: 500 }}>— {t.hint}</span></span>
              </label>
            ))}
          </div>
        </Field>
        {f.target_type === 'inactive_users' && (
          <Field label="Inactive for at least (days)">
            <input className="input" type="number" min="1" value={f.days} onChange={(e) => set('days', e.target.value)} style={{ maxWidth: 160 }} />
          </Field>
        )}
        {f.target_type === 'selected_users' && (
          <Field label="Phone numbers" hint={`${parsed.phones.length} valid number${parsed.phones.length === 1 ? '' : 's'}${parsed.invalid.length ? ` · ${parsed.invalid.length} not recognised` : ''}. One per line, or separated by commas. +91 is fine.`}>
            <textarea className="textarea mono" rows={5} value={f.phones} onChange={(e) => set('phones', e.target.value)} placeholder={'9876543210\n9123456780'} />
          </Field>
        )}
        {f.target_type === 'all' && <div className="alert warn">This coupon works for every customer. Pick a narrower group unless that’s what you want.</div>}

        <hr className="sep" />
        <div className="grid-2">
          <Field label="Uses per customer"><input className="input" type="number" min="1" value={f.usage_limit_per_user} onChange={(e) => set('usage_limit_per_user', e.target.value)} /></Field>
          <Field label="Total uses (all customers)" hint="Blank = unlimited"><input className="input" type="number" min="1" value={f.total_usage_limit} onChange={(e) => set('total_usage_limit', e.target.value)} /></Field>
          <Field label="Valid from" hint="Blank = starts now"><input className="input" type="datetime-local" value={f.valid_from} onChange={(e) => set('valid_from', e.target.value)} /></Field>
          <Field label="Valid until" hint="Blank = no end date"><input className="input" type="datetime-local" value={f.valid_until} onChange={(e) => set('valid_until', e.target.value)} /></Field>
        </div>
        <label className="check"><input type="checkbox" checked={f.is_active} onChange={(e) => set('is_active', e.target.checked)} /> Active</label>

        {!editing && (willPush ? (
          <div className="alert info">
            Creating this sends a push notification right away to {audienceCount !== undefined ? <>about <b>{num(audienceCount)}</b> customer{audienceCount === 1 ? '' : 's'}</> : 'the customers'} in this group who allow offers. It can’t be unsent.
          </div>
        ) : (
          <div className="alert warn">
            No notification will be sent, because the coupon {f.is_active ? 'starts in the future' : 'is not active'}. Turning it on later doesn’t send one either.
          </div>
        ))}
        {editing && <small className="muted">Saving changes never sends a new notification.</small>}
        {(err || save.error) && <div ref={errRef} className="alert error">{err || errMsg(save.error)}</div>}
      </form>
    </Modal>
  );
}
