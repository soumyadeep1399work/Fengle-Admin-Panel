import { useNavigate } from 'react-router-dom';
import type { OrderRow } from '../api/types';
import { ago, categoryList, money, PAYMENT_LABEL } from '../lib/format';
import { Empty, StatusBadge } from './ui';

export default function OrdersTable({ orders, hide = [] }: {
  orders: OrderRow[];
  hide?: ('customer' | 'restaurant' | 'rider')[];
}) {
  const nav = useNavigate();
  if (orders.length === 0) return <Empty title="No orders" />;
  return (
    <div className="table-wrap">
      <table className="tbl">
        <thead>
          <tr>
            <th>Order</th>
            <th>Status</th>
            {!hide.includes('customer') && <th>Customer</th>}
            <th>Category</th>
            {!hide.includes('restaurant') && <th>Kitchen</th>}
            {!hide.includes('rider') && <th>Rider</th>}
            <th>Payment</th>
            <th className="num">Total</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="clickable" onClick={() => nav(`/orders/${o.id}`)}>
              <td>
                <div className="cell-main">#{o.id}</div>
                <div className="cell-sub nowrap" title={o.created_at}>{ago(o.created_at)}</div>
              </td>
              <td><StatusBadge status={o.status} /></td>
              {!hide.includes('customer') && (
                <td>
                  <div className="cell-main">{o.customer_name || 'Customer'}</div>
                  <div className="cell-sub">{o.customer_phone || `#${o.customer_id}`}</div>
                </td>
              )}
              <td>
                {categoryList(o.category_names)}
                {(o.is_clubbed === true || o.is_clubbed === 1) && <span className="badge gold" style={{ marginLeft: 6 }}>Clubbed</span>}
              </td>
              {!hide.includes('restaurant') && <td>{o.restaurant_name || (o.restaurant_id ? `#${o.restaurant_id}` : <span className="muted">Routing…</span>)}</td>}
              {!hide.includes('rider') && <td>{o.rider_name || (o.rider_id ? `#${o.rider_id}` : <span className="muted">—</span>)}</td>}
              <td>
                <div>{PAYMENT_LABEL[o.payment_method] ?? o.payment_method}</div>
                <div className="cell-sub"><StatusBadge status={o.payment_status} /></div>
              </td>
              <td className="num cell-main">{money(o.grand_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
