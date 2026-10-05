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
  price: Money;
  image_url?: string | null;
  is_veg?: boolean | number;
  is_active?: boolean | number;
  created_by_type?: 'admin' | 'restaurant';
}

export interface Restaurant {
  id: number;
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
  created_at?: string;
  categories?: { id: number; name: string }[];
  order_count?: number;
  rating_avg?: number | string | null;
  commission_history?: { id: number; rate_percent: Money; effective_from: string; changed_by_admin_id: number | null }[];
  agreementAcceptedAt?: string | null;
  agreementVersion?: number | null;
  hasAgreementSelfie?: boolean;
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
  unsettled_deliveries?: number;
  last_active_at?: string | null;
  ledger?: LedgerEntry[];
  orders?: OrderRow[];
  agreementAcceptedAt?: string | null;
  agreementVersion?: number | null;
  hasAgreementSelfie?: boolean;
  verificationStatus?: VerificationStatus;
  verificationDeniedReason?: string | null;
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
