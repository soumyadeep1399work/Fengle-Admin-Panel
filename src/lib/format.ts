import type { Money, OrderStatus } from '../api/types';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2, minimumFractionDigits: 0 });
const count = new Intl.NumberFormat('en-IN');

export function money(v: Money | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—';
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? inr.format(n) : '—';
}

export function num(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  return Number.isFinite(n) ? count.format(n) : '—';
}

export function dateTime(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
}

export function date(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function ago(v: string | null | undefined): string {
  if (!v) return '—';
  const ms = Date.now() - new Date(v).getTime();
  if (!Number.isFinite(ms)) return '—';
  const m = Math.round(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d} d ago` : date(v);
}

export const ORDER_STATUSES: OrderStatus[] = ['placed', 'accepted', 'picked_up', 'on_the_way', 'delivered', 'cancelled'];

export const STATUS_LABEL: Record<string, string> = {
  placed: 'Placed', accepted: 'Accepted', picked_up: 'Picked up', on_the_way: 'On the way',
  delivered: 'Delivered', cancelled: 'Cancelled',
  active: 'Active', inactive: 'Inactive', suspended: 'Suspended', blocked: 'Blocked',
  pending: 'Pending', paid: 'Paid', failed: 'Failed', refunded: 'Refunded', partially_refunded: 'Part refunded',
};

export const STATUS_TONE: Record<string, string> = {
  placed: 'gold', accepted: 'violet', picked_up: 'blue', on_the_way: 'blue', delivered: 'green', cancelled: 'red',
  active: 'green', inactive: '', suspended: 'red', blocked: 'red',
  pending: 'gold', paid: 'green', failed: 'red', refunded: 'blue', partially_refunded: 'blue',
};

export const PAYMENT_LABEL: Record<string, string> = {
  upi: 'UPI', card: 'Card', netbanking: 'Netbanking', cod: 'Cash', wallet: 'Wallet',
};

export const LEDGER_REASON: Record<string, string> = {
  cod_collected: 'COD collected', settlement_payout: 'Settlement payout', settlement_deduction: 'COD netted',
  order_refund: 'Order refund', manual_adjustment: 'Manual adjustment', cash_handover: 'Cash handed over',
};

export function bool(v: boolean | number | null | undefined): boolean {
  return v === true || v === 1;
}

export function categoryList(v: string | string[] | null | undefined): string {
  if (!v) return '—';
  return Array.isArray(v) ? v.join(' + ') : v;
}
