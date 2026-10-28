// Adapts the backend's admin responses to the UI types. The backend returns
// related data as siblings of the main object ({ order, customer, items, ... })
// and uses a few different field names; this keeps pages independent of that.
import type { Customer, Dashboard, LedgerEntry, OrderDetail, Restaurant, Rider } from './types';

type Obj = Record<string, unknown>;

export function normalizeOrder(res: Obj): OrderDetail {
  const o = (res.order ?? res) as Obj;
  return {
    ...o,
    customer: (res.customer ?? o.customer) as OrderDetail['customer'],
    restaurant: (res.restaurant ?? o.restaurant) as OrderDetail['restaurant'],
    rider: (res.rider ?? o.rider) as OrderDetail['rider'],
    items: (res.items ?? o.items) as OrderDetail['items'],
    ledger: (res.ledger ?? res.wallet_ledger ?? o.ledger) as LedgerEntry[] | undefined,
  } as OrderDetail;
}

export function normalizeRider(row: Obj, res: Obj = {}): Rider {
  return {
    ...row,
    cod_outstanding: (row.cod_outstanding ?? row.cod_liability_outstanding) as Rider['cod_outstanding'],
    unsettled_deliveries: (row.unsettled_deliveries ?? row.unsettled_delivery_count) as number | undefined,
    ledger: (res.ledger ?? res.wallet_ledger ?? row.ledger) as LedgerEntry[] | undefined,
    orders: (res.orders ?? row.orders) as Rider['orders'],
    payouts: (res.payouts ?? row.payouts) as Rider['payouts'],
  } as Rider;
}

export function normalizeRestaurant(res: Obj): Restaurant {
  const r = (res.restaurant ?? res) as Obj;
  const rating = res.rating as { avg?: number | string | null } | undefined;
  return {
    ...r,
    categories: (res.categories ?? r.categories) as Restaurant['categories'],
    order_count: (res.order_count ?? r.order_count) as number | undefined,
    rating_avg: (rating?.avg ?? res.rating_avg ?? r.rating_avg) as Restaurant['rating_avg'],
    commission_history: (res.commission_history ?? res.commission_config_history ?? r.commission_history) as Restaurant['commission_history'],
  } as Restaurant;
}

export function normalizeCustomer(res: Obj): Customer {
  const c = (res.customer ?? res) as Obj;
  return {
    ...c,
    orders: (res.orders ?? c.orders) as Customer['orders'],
    ledger: (res.ledger ?? res.wallet_ledger ?? c.ledger) as LedgerEntry[] | undefined,
  } as Customer;
}

/** Fills the 7-day series so days with no orders still show as zero bars. */
export function normalizeDashboard(res: Obj): Dashboard {
  const today = res.today as { orders?: number; gmv?: string | number } | undefined;
  const raw = (res.series ?? res.last7Days) as { date: string; orders: number | string; gmv: string | number }[] | undefined;
  let series: Dashboard['series'];
  if (raw) {
    const byDay = new Map(raw.map((p) => [String(p.date).slice(0, 10), p]));
    series = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const p = byDay.get(key);
      series.push({ date: key, orders: Number(p?.orders ?? 0), gmv: Number(p?.gmv ?? 0) });
    }
  }
  return {
    ...(res as unknown as Dashboard),
    todayOrders: (res.todayOrders ?? today?.orders) as number | undefined,
    todayGmv: (res.todayGmv ?? today?.gmv) as Dashboard['todayGmv'],
    series,
  };
}
