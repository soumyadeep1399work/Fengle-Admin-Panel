// Shapes follow the backend migrations + the admin endpoint spec sent to the
// backend session on 2026-09-27. Money arrives as decimal strings; ids are numbers.
// Join/aggregate fields are optional so the UI degrades if a column is missing.

export type Money = string | number;

export type OrderStatus = 'placed' | 'accepted' | 'picked_up' | 'on_the_way' | 'delivered' | 'cancelled';
export type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'cod' | 'wallet';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded';
export type PartnerStatus = 'active' | 'inactive' | 'suspended';
export type VerificationStatus = 'pending' | 'approved' | 'denied';

export interface Paged { total?: number; page?: number; limit?: number }

export interface OrderRow {
  id: number;
  status: OrderStatus;
  customer_id: number;
  restaurant_id: number | null;
  rider_id: number | null;
  is_clubbed?: boolean | number;
  item_total: Money;
  delivery_fee: Money;
  grand_total: Money;
  commission_amount?: Money;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  delivery_address: string;
  created_at: string;
  delivered_at?: string | null;
  cancelled_at?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  restaurant_name?: string | null;
  rider_name?: string | null;
  category_names?: string | string[] | null;
  item_count?: number;
  /** what the rider earns for this delivery, frozen when it was delivered (null before item 8 shipped) */
  rider_payout?: Money | null;
}

export interface OrderItem {
  id: number;
  item_id: number;
  item_name?: string;
  name?: string;
  category_id: number;
  category_name?: string;
  quantity: number;
  unit_price: Money;
  subtotal: Money;
  status: 'confirmed' | 'dropped_unavailable';
  portion_label?: string | null;
  /** normal price at the time; unit_price is what was charged (lower while an offer ran) */
  list_price?: Money | null;
  /** vendor cost snapshotted at placement (super_admin/ops only) */
  vendor_cost?: Money | null;
}

export interface LedgerEntry {
  id: number;
  owner_type: 'customer' | 'rider';
  owner_id: number;
  entry_type: 'credit' | 'debit';
  amount: Money;
  balance_after: Money;
  reason: string;
  related_order_id: number | null;
  notes: string | null;
  created_at: string;
}

export interface OrderDetail extends OrderRow {
  /** what Fengle owes the kitchen for this order (super_admin/ops only) */
  restaurant_payable?: Money | null;
  payable_estimated?: boolean | number;
  rider_payout_breakdown?: RiderPayBreakdown | null;
  rider_pay_config_id?: number | null;
  cgst_amount?: Money;
  sgst_amount?: Money;
  wallet_used?: Money;
  cascade_attempts?: number;
  eta_minutes?: number | null;
  accepted_at?: string | null;
  preparation_started_at?: string | null;
  ready_at?: string | null;
  picked_up_at?: string | null;
  rider_settled_at?: string | null;
  rider_rating?: number | null;
  rider_rating_comment?: string | null;
  restaurant_rating?: number | null;
  restaurant_rating_comment?: string | null;
  razorpay_payment_id?: string | null;
  cancel_reason?: string | null;
  customer?: { id: number; name: string | null; phone: string; email?: string | null } | null;
  restaurant?: { id: number; name: string; phone?: string; address?: string } | null;
  rider?: { id: number; name: string | null; phone: string } | null;
  items?: OrderItem[];
  ledger?: LedgerEntry[];
}

export interface Dashboard {
  totalOrders: number;
  activeRestaurants: number;
  activeRiders: number;
  pendingOrders: number;
  todayOrders?: number;
  todayGmv?: Money;
  series?: { date: string; orders: number; gmv: Money }[];
  statusCounts?: Partial<Record<OrderStatus, number>>;
  restaurantsByStatus?: Partial<Record<PartnerStatus, number>>;
  ridersByStatus?: Partial<Record<PartnerStatus, number>>;
}

export interface Category {
  id: number;
  name: string;
  description?: string | null;
  image_url?: string | null;
  is_active: boolean | number;
  prep_time_min_minutes?: number | null;
  prep_time_max_minutes?: number | null;
  min_order_override?: Money | null;
  item_count?: number;
  restaurant_count?: number;
  created_by_restaurant_id?: number | null;
  created_by_restaurant_name?: string | null;
}

export interface Item {
  id: number;
  category_id: number;
  category_name?: string;
  name: string;
  description?: string | null;
  /** null while a kitchen-proposed dish is waiting for an admin to price it */
  price: Money | null;
  image_url?: string | null;
  is_veg?: boolean | number;
  is_active?: boolean | number;
  created_by_type?: 'admin' | 'restaurant';
  created_by_restaurant_id?: number | null;
  created_by_restaurant_name?: string | null;
  awaiting_price?: boolean | number;
  offer_price?: Money | null;
  offer_ends_at?: string | null;
  /** the offer is in force right now */
  offer_active?: boolean | number;
  /** what a customer pays per unit right now */
  effective_price?: Money | null;
  /** internal: what Fengle pays the kitchen per unit (super_admin/ops only) */
  vendor_cost?: Money | null;
  margin?: Money | null;
  margin_percent?: number | null;
  quantity_value?: Money | null;
  quantity_unit?: QuantityUnit | null;
  portion_label?: string | null;
}

export type QuantityUnit = 'pc' | 'gm' | 'kg' | 'ml' | 'ltr';

export interface Restaurant {
  id: number;
  has_bank_account?: boolean;
  bank_account?: RiderBankAccount | null;
  bank_account_history?: RiderBankHistoryRow[];
  name: string;
  owner_name?: string | null;
  phone: string;
  email?: string | null;
  address: string;
  lat: Money;
  lng: Money;
  radius_km: Money;
  commission_rate_percent: Money;
  status: PartnerStatus;
  /** daily service window, IST "HH:MM"; both null = always open; closes < opens = overnight */
  opens_at?: string | null;
  closes_at?: string | null;
  is_open_now?: boolean;
  created_at?: string;
  categories?: { id: number; name: string }[];
  order_count?: number;
  rating_avg?: number | string | null;
  commission_history?: { id: number; rate_percent: Money; effective_from: string; changed_by_admin_id: number | null }[];
  agreementAcceptedAt?: string | null;
  agreementVersion?: number | null;
  hasAgreementSelfie?: boolean;
  documents?: DocumentSummary;
  verificationStatus?: VerificationStatus;
  verificationDeniedReason?: string | null;
}

export interface Rider {
  id: number;
  name: string | null;
  phone: string;
  status: PartnerStatus;
  wallet_balance: Money;
  vehicle_type?: string | null;
  vehicle_number?: string | null;
  created_at: string;
  cod_outstanding?: Money;
  /** sums of stored per-order payouts (rider detail only) */
  payouts?: { deliveries: number; total_earned: Money; unsettled: Money };
  unsettled_deliveries?: number;
  last_active_at?: string | null;
  ledger?: LedgerEntry[];
  orders?: OrderRow[];
  agreementAcceptedAt?: string | null;
  agreementVersion?: number | null;
  hasAgreementSelfie?: boolean;
  documents?: DocumentSummary;
  verificationStatus?: VerificationStatus;
  verificationDeniedReason?: string | null;
  /** List rows: did the rider add payout details? */
  has_bank_account?: boolean;
  /** Detail only. `account_number` (the full number) is sent to super_admin and ops, never to support. */
  bank_account?: RiderBankAccount | null;
  bank_account_history?: RiderBankHistoryRow[];
}

export interface RiderBankAccount {
  account_holder_name: string;
  account_number?: string | null;
  /** True when the server's encryption key was lost, so the full number can't be shown. */
  account_number_unavailable?: boolean;
  account_number_last4: string;
  ifsc: string;
  bank_name?: string | null;
  upi_id?: string | null;
  updated_at?: string | null;
}

export interface RiderBankHistoryRow {
  id: number;
  action: 'create' | 'update';
  before: Pick<RiderBankAccount, 'account_holder_name' | 'account_number_last4' | 'ifsc' | 'upi_id'> | null;
  after: Pick<RiderBankAccount, 'account_holder_name' | 'account_number_last4' | 'ifsc' | 'upi_id'> | null;
  changed_by?: string;
  created_at: string;
}

export interface Customer {
  id: number;
  name: string | null;
  phone: string;
  email?: string | null;
  status: 'active' | 'blocked';
  wallet_balance: Money;
  created_at: string;
  order_count?: number;
  total_spent?: Money;
  last_order_at?: string | null;
  promo_opt_in?: boolean | number;
  orders?: OrderRow[];
  ledger?: LedgerEntry[];
}

export type CouponTarget = 'all' | 'new_users' | 'inactive_users' | 'selected_users';

export interface Coupon {
  id: number;
  code: string;
  title: string;
  description?: string | null;
  discount_type: 'flat' | 'percent';
  discount_value: Money;
  max_discount_amount?: Money | null;
  min_order_value: Money;
  target_type: CouponTarget;
  target_meta?: { days?: number; phones?: string[] } | null;
  usage_limit_per_user: number;
  total_usage_limit?: number | null;
  valid_from?: string | null;
  valid_until?: string | null;
  is_active: boolean | number;
  redemption_count?: number;
  created_at?: string;
}

export interface AdminAccount {
  id: number;
  name: string;
  email: string;
  role: string;
  is_active?: boolean | number;
  last_login_at?: string | null;
  created_at?: string;
}

export type DocType = 'aadhaar' | 'fssai' | 'trade_license' | 'driving_license';
export type DocStatus = 'pending' | 'approved' | 'rejected';
export type DocSummaryStatus = 'complete' | 'expiring' | 'pending' | 'rejected' | 'expired' | 'missing';

export interface DocumentSummary {
  status: DocSummaryStatus;
  complete: boolean;
  validUntil: string | null;
  missing: DocType[];
  pendingCount: number;
}

export interface DocRequirement {
  type: DocType;
  label: string;
  required: boolean;
  needsNumber: boolean;
  needsExpiry: boolean;
  numberLabel?: string;
  hint?: string;
}

export interface PartnerDocument {
  id: number;
  docType: DocType;
  label: string;
  status: DocStatus;
  docNumber: string | null;
  expiryDate: string | null;
  rejectionReason: string | null;
  contentType: string;
  fileSize: number;
  uploadedAt: string;
  reviewedAt: string | null;
  approvedVersion?: PartnerDocument | null;
  ownerType?: 'restaurant' | 'rider';
  ownerId?: number;
  ownerName?: string | null;
  ownerPhone?: string | null;
}

export interface OwnerDocuments {
  owner: { id: number; name: string | null; phone: string; status: string };
  ownerType: 'restaurant' | 'rider';
  enforced: boolean;
  requirements: DocRequirement[];
  documents: Partial<Record<DocType, PartnerDocument | null>>;
  summary: DocumentSummary;
  history: PartnerDocument[];
}

export interface RiderPayBreakdown {
  formula?: string;
  distance_km: number;
  base_payout: Money;
  per_km_rate: Money;
  distance_pay: Money;
  subtotal: Money;
  min_payout: Money;
  min_applied: boolean;
  incentive_per_delivery: Money;
  payout: Money;
  config_id?: number;
}

export interface RiderPaySettings {
  id: number;
  base_payout: Money;
  per_km_rate: Money;
  min_payout: Money;
  incentive_per_delivery: Money;
  created_at: string;
  created_by_admin_id: number | null;
  created_by_admin_name?: string | null;
}

export interface CashHandover {
  id: number;
  rider_id: number;
  rider_name?: string | null;
  amount: Money;
  received_at: string;
  reference: string | null;
  notes: string | null;
  received_by_admin_id: number | null;
  received_by_admin_name?: string | null;
  balance_after: Money;
  outstanding_after?: Money;
  created_at: string;
}

export interface CodRiderRow {
  rider_id: number;
  rider_name: string | null;
  rider_phone: string | null;
  delivered_cod_orders: number;
  expected: Money;
  collected: Money;
  difference: Money;
  flagged_orders: number;
  handed_over: Money;
  net_cash_in_period: Money;
  outstanding: Money;
}

export interface CodOrderRow {
  order_id: number;
  status: 'delivered' | 'cancelled';
  payment_status: string;
  rider_id: number | null;
  rider_name: string | null;
  closed_at: string | null;
  grand_total: Money;
  expected: Money;
  collected: Money;
  difference: Money;
  refunded: Money;
  flag: 'short' | 'excess' | 'unexpected_collection' | null;
}

export interface CodReconciliation {
  range: { from: string | null; to: string | null };
  totals: Record<string, Money | number>;
  riders: CodRiderRow[];
  orders: CodOrderRow[];
  page: number;
  limit: number;
  total_orders: number;
}

export type SettlementStatus = 'settled' | 'due' | 'advance';

export interface RestaurantSettlementRow {
  restaurant_id: number; restaurant_name: string; delivered_orders: number;
  payable_earned: Money; adjustments: Money; paid: Money;
  total_payable: Money; total_adjustments: Money; total_paid: Money; outstanding: Money;
  status: SettlementStatus; estimated_orders: number; estimated_orders_total: Money;
  has_estimated_payables: boolean; last_payment_at: string | null;
}

export interface SettlementOrderLine {
  item_id: number; name: string; quantity: number; unit_price: Money; line_subtotal: Money;
  vendor_cost: Money | null; line_cost: Money; estimated: boolean;
}

export interface RestaurantPayment {
  id: number; restaurant_id: number; restaurant_name?: string; amount: Money; paid_at: string;
  reference: string | null; method: string | null; notes: string | null;
  recorded_by_admin_id?: number | null; recorded_by_admin_name?: string | null; created_at: string;
}

export interface RestaurantAdjustment {
  id: number; restaurant_id: number; amount: Money; reason: string; related_order_id: number | null;
  created_by_admin_id?: number | null; created_by_admin_name?: string | null; created_at: string;
}

export interface RestaurantStatement {
  restaurant: { id: number; name: string; phone?: string };
  range: { from: string | null; to: string | null };
  opening_balance: Money; payable_earned: Money; adjustments_total: Money; paid_total: Money;
  closing_balance: Money; outstanding_now: Money; status: SettlementStatus; estimated_orders: number;
  days: { date: string; orders: number; payable: Money; estimated_orders: number }[];
  orders: { order_id: number; delivered_at: string; payable: Money; estimated: boolean; customer_paid_items: Money; items: SettlementOrderLine[] }[];
  page: number; limit: number; total_orders: number;
  payments: RestaurantPayment[];
  adjustments: RestaurantAdjustment[];
}

/* ---------- Shipping charges (zones + rules; one engine for the customer fee and rider pay) ---------- */
export type ShippingKind = 'customer_fee' | 'rider_pay';
export type ShippingRuleType = 'base' | 'add' | 'free' | 'min' | 'max';

export interface ShippingCircle { lat: number; lng: number; radius_km: number }

export interface ShippingZone {
  id: number;
  name: string;
  is_active: boolean | number;
  priority: number;
  /** v1 zones are circles around the drop-off; `pincodes` is accepted by the API but nothing sends one yet. */
  match: { pincodes?: string[]; circles?: ShippingCircle[] };
  created_at?: string;
  updated_at?: string;
}

export interface ShippingBand { from_km: number; to_km: number | null; per_km: number }

export interface ShippingConditions {
  distance_km?: { min?: number; max?: number };
  order_value?: { min?: number; max?: number };
  time?: { days?: number[]; from?: string; to?: string };
}

export interface ShippingCharge {
  flat?: number;
  bands?: ShippingBand[];
  /** customer_fee base rules only: count distance only beyond the kitchen's own radius. */
  after_kitchen_radius?: boolean;
  percent?: number;
  amount?: number;
}

export interface ShippingRule {
  id: number;
  kind: ShippingKind;
  zone_id: number | null;
  zone_name?: string | null;
  name: string;
  is_active: boolean | number;
  priority: number;
  type: ShippingRuleType;
  conditions: ShippingConditions | null;
  charge: ShippingCharge;
  valid_from: string | null;
  valid_to: string | null;
  /** Active, and inside its dates, right now. */
  is_in_effect_now?: boolean;
  /** The one rule the "every delivery can be priced" safeguard protects — it can't be switched off or deleted. */
  is_last_everywhere_base?: boolean;
  created_by_admin_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface ShippingHistoryRow {
  id: number;
  entity: 'rule' | 'zone';
  entity_id: number;
  kind: ShippingKind | null;
  action: 'create' | 'update' | 'delete' | 'reorder';
  before: unknown;
  after: unknown;
  admin_id: number | null;
  admin_name: string | null;
  created_at: string;
}

export interface ShippingPreview {
  amount: Money;
  zone: { id: number; name: string } | null;
  applied: { rule_id: number; name: string; type: ShippingRuleType; effect: { before: number; after: number; delta: number } }[];
  breakdown: { distance_km?: number; chargeable_km?: number; base_amount?: number; steps?: unknown[] };
  warnings?: string[];
}
