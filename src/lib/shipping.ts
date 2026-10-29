import type {
  ShippingBand, ShippingCharge, ShippingConditions, ShippingKind, ShippingRule, ShippingRuleType, ShippingZone,
} from '../api/types';
import { bool, money } from './format';

export const KIND_LABEL: Record<ShippingKind, string> = {
  customer_fee: 'Customer delivery fee',
  rider_pay: 'Rider pay',
};

export const KIND_HELP: Record<ShippingKind, string> = {
  customer_fee: 'What the customer pays for delivery. Worked out when the order is placed (using the time of the order) and fixed on that order.',
  rider_pay: 'What a rider earns per delivery. Worked out when the order is delivered, and fixed on that order from then on. Paid out weekly.',
};

export const TYPE_LABEL: Record<ShippingRuleType, string> = {
  base: 'Base charge',
  add: 'Extra charge',
  free: 'Free delivery',
  min: 'Minimum',
  max: 'Maximum',
};

export const TYPE_HELP: Record<ShippingRuleType, string> = {
  base: 'Sets the amount: a flat sum and/or a per-km rate. The first matching base rule decides; a rule for a zone beats an "Everywhere" rule.',
  add: 'Adds on top of the base: a flat sum, a percentage, or both (peak hours, rain, a bonus).',
  free: 'Makes delivery free when the conditions match, e.g. orders over ₹500.',
  min: 'The amount never goes below this.',
  max: 'The amount never goes above this.',
};

/** Rule types a kind can use — a rider payout is never zeroed by a rule. */
export function typesFor(kind: ShippingKind): ShippingRuleType[] {
  return kind === 'customer_fee' ? ['base', 'add', 'min', 'max', 'free'] : ['base', 'add', 'min', 'max'];
}

export const TYPE_TONE: Record<ShippingRuleType, string> = { base: 'violet', add: 'gold', free: 'green', min: 'blue', max: 'blue' };

/** Monday first, as people read a week. Values are JS weekdays (0 = Sunday). */
export const DAYS: { v: number; label: string }[] = [
  { v: 1, label: 'Mon' }, { v: 2, label: 'Tue' }, { v: 3, label: 'Wed' }, { v: 4, label: 'Thu' },
  { v: 5, label: 'Fri' }, { v: 6, label: 'Sat' }, { v: 0, label: 'Sun' },
];

const n = (v: unknown) => Number(v);
const plain = (v: number) => String(Number(v.toFixed(2)));

/* ---------- plain-English summaries ---------- */

export function describeConditions(c: ShippingConditions | null | undefined): string[] {
  const out: string[] = [];
  const d = c?.distance_km;
  if (d && (d.min != null || d.max != null)) {
    if (d.min != null && d.max != null) out.push(`${plain(d.min)}–${plain(d.max)} km`);
    else if (d.min != null) out.push(`${plain(d.min)} km or more`);
    else out.push(`under ${plain(d.max as number)} km`);
  }
  const v = c?.order_value;
  if (v && (v.min != null || v.max != null)) {
    if (v.min != null && v.max != null) out.push(`order ${money(v.min)}–${money(v.max)}`);
    else if (v.min != null) out.push(`order ${money(v.min)} or more`);
    else out.push(`order under ${money(v.max as number)}`);
  }
  const t = c?.time;
  if (t && ((t.days && t.days.length > 0) || t.from || t.to)) {
    const days = t.days && t.days.length > 0 && t.days.length < 7
      ? DAYS.filter((x) => t.days!.includes(x.v)).map((x) => x.label).join(', ')
      : '';
    const hours = t.from && t.to ? `${t.from}–${t.to}` : '';
    out.push([days || 'every day', hours].filter(Boolean).join(' '));
  }
  return out;
}

function describeBands(bands: ShippingBand[]): string {
  return bands
    .map((b) => {
      const rate = `${money(b.per_km)}/km`;
      if (b.to_km == null) return b.from_km === 0 ? rate : `${rate} beyond ${plain(b.from_km)} km`;
      return b.from_km === 0 ? `${rate} for the first ${plain(b.to_km)} km` : `${rate} for ${plain(b.from_km)}–${plain(b.to_km)} km`;
    })
    .join(' · ');
}

export function describeCharge(type: ShippingRuleType, c: ShippingCharge | null | undefined): string {
  const charge = c ?? {};
  switch (type) {
    case 'base': {
      const parts: string[] = [];
      if (charge.flat) parts.push(`${money(charge.flat)} flat`);
      if (charge.bands && charge.bands.length > 0) parts.push(describeBands(charge.bands));
      let s = parts.join(' + ') || '₹0';
      if (charge.after_kitchen_radius) s += ' · beyond the kitchen’s radius';
      return s;
    }
    case 'add':
      return [charge.flat ? `+ ${money(charge.flat)}` : '', charge.percent ? `+ ${plain(charge.percent)}%` : ''].filter(Boolean).join(' ') || '+ ₹0';
    case 'free': return 'Delivery is free';
    case 'min': return `At least ${money(charge.amount ?? 0)}`;
    case 'max': return `At most ${money(charge.amount ?? 0)}`;
  }
}

export function ruleStatus(r: ShippingRule): { label: string; tone: string } {
  if (!bool(r.is_active)) return { label: 'Off', tone: '' };
  const now = Date.now();
  const from = r.valid_from ? new Date(r.valid_from).getTime() : null;
  const to = r.valid_to ? new Date(r.valid_to).getTime() : null;
  if (from != null && from > now) return { label: 'Scheduled', tone: 'gold' };
  if (to != null && to <= now) return { label: 'Expired', tone: 'red' };
  if (r.is_in_effect_now === false) return { label: 'Not in effect', tone: 'gold' };
  return { label: 'On', tone: 'green' };
}

export function describeZone(z: ShippingZone): string {
  const circles = z.match?.circles ?? [];
  const pins = z.match?.pincodes ?? [];
  const parts: string[] = [];
  if (circles.length > 0) parts.push(`${circles.length} ${circles.length === 1 ? 'area' : 'areas'} (${circles.map((c) => `${plain(Number(c.radius_km))} km`).join(', ')} radius)`);
  if (pins.length > 0) parts.push(`${pins.length} ${pins.length === 1 ? 'pincode' : 'pincodes'}`);
  return parts.join(' + ') || 'No area set';
}

/* ---------- rule form <-> API payload ---------- */

export interface BandForm { to_km: string; per_km: string }

export interface RuleForm {
  name: string;
  type: ShippingRuleType;
  /** '' = Everywhere. */
  zone_id: string;
  is_active: boolean;
  dist_min: string; dist_max: string;
  val_min: string; val_max: string;
  time_on: boolean; days: number[]; time_from: string; time_to: string;
  flat: string;
  /** Each band runs from the previous band's "up to" (the first from 0). An empty "up to" means "and beyond". */
  bands: BandForm[];
  after_kitchen_radius: boolean;
  percent: string;
  amount: string;
  valid_from: string; valid_to: string;
}

export function emptyRuleForm(zoneId: number | null, type: ShippingRuleType = 'base'): RuleForm {
  return {
    name: '', type, zone_id: zoneId == null ? '' : String(zoneId), is_active: true,
    dist_min: '', dist_max: '', val_min: '', val_max: '',
    time_on: false, days: [], time_from: '', time_to: '',
    flat: '', bands: type === 'base' ? [{ to_km: '', per_km: '' }] : [], after_kitchen_radius: false,
    percent: '', amount: '', valid_from: '', valid_to: '',
  };
}

const str = (v: number | null | undefined) => (v == null ? '' : plain(Number(v)));

/** ISO -> the value a <input type="datetime-local"> wants (browser-local time). */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ruleToForm(r: ShippingRule): RuleForm {
  const c = r.conditions ?? {};
  const t = c.time;
  const ch = r.charge ?? {};
  return {
    name: r.name, type: r.type, zone_id: r.zone_id == null ? '' : String(r.zone_id), is_active: bool(r.is_active),
    dist_min: str(c.distance_km?.min), dist_max: str(c.distance_km?.max),
    val_min: str(c.order_value?.min), val_max: str(c.order_value?.max),
    time_on: !!t && ((t.days?.length ?? 0) > 0 || !!t.from || !!t.to),
    days: t?.days ?? [], time_from: t?.from ?? '', time_to: t?.to ?? '',
    flat: str(ch.flat),
    bands: (ch.bands ?? []).map((b) => ({ to_km: str(b.to_km), per_km: str(b.per_km) })),
    after_kitchen_radius: !!ch.after_kitchen_radius,
    percent: str(ch.percent), amount: str(ch.amount),
    valid_from: toLocalInput(r.valid_from), valid_to: toLocalInput(r.valid_to),
  };
}

type Built<T> = { payload: T; error?: undefined } | { error: string; payload?: undefined };

const MAX_AMOUNT = 100000;

function amount(label: string, v: string, required = false): { value?: number; error?: string } {
  if (v.trim() === '') return required ? { error: `${label} is required.` } : {};
  const x = n(v);
  if (!Number.isFinite(x) || x < 0 || x > MAX_AMOUNT) return { error: `${label} must be between 0 and 1,00,000.` };
  return { value: x };
}

export interface RulePayload {
  zone_id: number | null;
  name: string;
  is_active: boolean;
  type: ShippingRuleType;
  conditions: ShippingConditions;
  charge: ShippingCharge;
  valid_from: string | null;
  valid_to: string | null;
}

export function ruleFormToPayload(f: RuleForm, kind: ShippingKind): Built<RulePayload> {
  const name = f.name.trim();
  if (!name) return { error: 'Give the rule a name, e.g. “Night surcharge”.' };

  // Conditions
  const conditions: ShippingConditions = {};
  const dmin = amount('Distance from', f.dist_min), dmax = amount('Distance up to', f.dist_max);
  if (dmin.error || dmax.error) return { error: (dmin.error || dmax.error) as string };
  if (dmin.value != null && dmax.value != null && dmax.value <= dmin.value) return { error: 'The distance “up to” must be larger than “from”.' };
  if (dmin.value != null || dmax.value != null) conditions.distance_km = { ...(dmin.value != null ? { min: dmin.value } : {}), ...(dmax.value != null ? { max: dmax.value } : {}) };

  const vmin = amount('Order value from', f.val_min), vmax = amount('Order value up to', f.val_max);
  if (vmin.error || vmax.error) return { error: (vmin.error || vmax.error) as string };
  if (vmin.value != null && vmax.value != null && vmax.value <= vmin.value) return { error: 'The order value “up to” must be larger than “from”.' };
  if (vmin.value != null || vmax.value != null) conditions.order_value = { ...(vmin.value != null ? { min: vmin.value } : {}), ...(vmax.value != null ? { max: vmax.value } : {}) };

  if (f.time_on) {
    if ((f.time_from && !f.time_to) || (!f.time_from && f.time_to)) return { error: 'Set both the start and end time, or leave both empty.' };
    if (f.days.length === 0 && !f.time_from) return { error: 'Pick the days and/or the hours this rule applies to.' };
    conditions.time = {
      ...(f.days.length > 0 && f.days.length < 7 ? { days: f.days } : {}),
      ...(f.time_from && f.time_to ? { from: f.time_from, to: f.time_to } : {}),
    };
    if (Object.keys(conditions.time).length === 0) delete conditions.time;
  }

  // Charge
  let charge: ShippingCharge = {};
  switch (f.type) {
    case 'base': {
      const flat = amount('The flat amount', f.flat);
      if (flat.error) return { error: flat.error };
      const bands: ShippingBand[] = [];
      let from = 0;
      for (let i = 0; i < f.bands.length; i++) {
        const b = f.bands[i];
        const last = i === f.bands.length - 1;
        const rate = amount(`The per-km rate in band ${i + 1}`, b.per_km, true);
        if (rate.error) return { error: rate.error };
        let to: number | null = null;
        if (b.to_km.trim() === '') {
          if (!last) return { error: `Band ${i + 1} needs an “up to” distance — only the last band can be open-ended.` };
        } else {
          to = n(b.to_km);
          if (!Number.isFinite(to) || to <= from) return { error: `Band ${i + 1}: “up to” must be more than ${plain(from)} km.` };
          if (to > MAX_AMOUNT) return { error: `Band ${i + 1}: that distance is too large.` };
        }
        bands.push({ from_km: from, to_km: to, per_km: rate.value as number });
        if (to != null) from = to;
      }
      if (bands.length === 0 && !flat.value) return { error: 'Set a flat amount, or add at least one per-km band.' };
      charge = { ...(flat.value ? { flat: flat.value } : {}), ...(bands.length > 0 ? { bands } : {}) };
      if (kind === 'customer_fee' && f.after_kitchen_radius) charge.after_kitchen_radius = true;
      break;
    }
    case 'add': {
      const flat = amount('The flat amount', f.flat);
      if (flat.error) return { error: flat.error };
      let percent: number | undefined;
      if (f.percent.trim() !== '') {
        percent = n(f.percent);
        if (!Number.isFinite(percent) || percent < 0 || percent > 1000) return { error: 'The percentage must be between 0 and 1000.' };
      }
      if (!flat.value && !percent) return { error: 'Set a flat amount, a percentage, or both.' };
      charge = { ...(flat.value ? { flat: flat.value } : {}), ...(percent ? { percent } : {}) };
      break;
    }
    case 'free': charge = {}; break;
    case 'min':
    case 'max': {
      const a = amount(f.type === 'min' ? 'The minimum' : 'The maximum', f.amount, true);
      if (a.error) return { error: a.error };
      charge = { amount: a.value };
      break;
    }
  }

  // Dates
  const vf = f.valid_from ? new Date(f.valid_from) : null;
  const vt = f.valid_to ? new Date(f.valid_to) : null;
  if ((vf && Number.isNaN(vf.getTime())) || (vt && Number.isNaN(vt.getTime()))) return { error: 'One of the dates is not valid.' };
  if (vf && vt && vt <= vf) return { error: '“Ends” must be after “Starts”.' };

  return {
    payload: {
      zone_id: f.zone_id === '' ? null : Number(f.zone_id),
      name, is_active: f.is_active, type: f.type, conditions, charge,
      valid_from: vf ? vf.toISOString() : null, valid_to: vt ? vt.toISOString() : null,
    },
  };
}

/* ---------- zone form <-> API payload ---------- */

export interface ZoneForm {
  name: string;
  is_active: boolean;
  circles: { lat: string; lng: string; radius_km: string }[];
  /** Kept as they are — v1 can't set them, but editing a zone must not drop any. */
  pincodes: string[];
}

export function emptyZoneForm(): ZoneForm {
  return { name: '', is_active: true, circles: [{ lat: '22.58', lng: '88.47', radius_km: '5' }], pincodes: [] };
}

export function zoneToForm(z: ShippingZone): ZoneForm {
  return {
    name: z.name, is_active: bool(z.is_active),
    circles: (z.match?.circles ?? []).map((c) => ({ lat: String(c.lat), lng: String(c.lng), radius_km: String(c.radius_km) })),
    pincodes: z.match?.pincodes ?? [],
  };
}

export function zoneFormToPayload(f: ZoneForm): Built<{ name: string; is_active: boolean; match: ShippingZone['match'] }> {
  const name = f.name.trim();
  if (!name) return { error: 'Give the zone a name, e.g. “Newtown core”.' };
  if (name.length > 100) return { error: 'The name is too long (100 characters at most).' };
  const circles = [];
  for (let i = 0; i < f.circles.length; i++) {
    const c = f.circles[i];
    const lat = n(c.lat), lng = n(c.lng), radius = n(c.radius_km);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) return { error: `Area ${i + 1}: latitude must be between -90 and 90.` };
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) return { error: `Area ${i + 1}: longitude must be between -180 and 180.` };
    if (!Number.isFinite(radius) || radius <= 0 || radius > 100) return { error: `Area ${i + 1}: the radius must be more than 0 and at most 100 km.` };
    circles.push({ lat, lng, radius_km: radius });
  }
  if (circles.length === 0 && f.pincodes.length === 0) return { error: 'Add at least one area (a point on the map and a radius).' };
  return { payload: { name, is_active: f.is_active, match: { ...(circles.length > 0 ? { circles } : {}), ...(f.pincodes.length > 0 ? { pincodes: f.pincodes } : {}) } } };
}
