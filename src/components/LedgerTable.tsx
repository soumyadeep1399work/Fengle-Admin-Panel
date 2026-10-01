import { Link } from 'react-router-dom';
import type { LedgerEntry } from '../api/types';
import { dateTime, LEDGER_REASON, money } from '../lib/format';
import { Empty } from './ui';

export default function LedgerTable({ entries, showOwner }: { entries: LedgerEntry[]; showOwner?: boolean }) {
  if (entries.length === 0) return <Empty title="No wallet movements yet" />;
  return (
    <div className="table-wrap">
      <table className="tbl">
        <thead>
          <tr>
            <th>When</th>
            {showOwner && <th>Wallet</th>}
            <th>Reason</th>
            <th>Order</th>
            <th>Notes</th>
            <th className="num">Amount</th>
            <th className="num">Balance after</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              <td className="nowrap">{dateTime(e.created_at)}</td>
              {showOwner && (
                <td>
                  <Link to={e.owner_type === 'rider' ? `/riders/${e.owner_id}` : `/customers/${e.owner_id}`}>
                    {e.owner_type === 'rider' ? 'Rider' : 'Customer'} #{e.owner_id}
                  </Link>
                </td>
              )}
              <td>{LEDGER_REASON[e.reason] ?? e.reason}</td>
              <td>{e.related_order_id ? <Link to={`/orders/${e.related_order_id}`}>#{e.related_order_id}</Link> : <span className="muted">—</span>}</td>
              <td className="muted small">{e.notes || '—'}</td>
              <td className="num" style={{ color: e.entry_type === 'credit' ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                {e.entry_type === 'credit' ? '+' : '−'}{money(e.amount)}
              </td>
              <td className="num">{money(e.balance_after)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
