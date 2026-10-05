import { useCan } from '../auth';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Customer } from '../api/types';
import { api } from '../api/client';
import LedgerTable from '../components/LedgerTable';
import OrdersTable from '../components/OrdersTable';
import { Confirm, Field, Modal, QueryState, StatusBadge, Tabs, errMsg } from '../components/ui';
import { useQuery } from '@tanstack/react-query';
import { useAction } from '../lib/hooks';
import { normalizeCustomer } from '../api/normalize';
import { bool, date, dateTime, money, num } from '../lib/format';

export default function CustomerDetail() {
  const { id = '' } = useParams();
  const q = useQuery({
    queryKey: ['/admin/customers/', id],
    queryFn: async () => normalizeCustomer(await api.get<Record<string, unknown>>(`/admin/customers/${id}`)),
  });
  const c = q.data;
  const can = useCan();
  const [tab, setTab] = useState<'orders' | 'wallet'>('orders');
  const [blockOpen, setBlockOpen] = useState(false);
  const [creditOpen, setCreditOpen] = useState(false);

  const setStatus = useAction((s: 'active' | 'blocked') => api.patch(`/admin/customers/${id}`, { status: s }), {
    success: 'Customer updated', invalidate: ['/admin/customers'], onDone: () => setBlockOpen(false),
  });

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <div className="small"><Link to="/customers">← Customers</Link></div>
          <h1 className="row" style={{ marginTop: 6 }}>{c?.name || 'Customer'} {c && <StatusBadge status={c.status} />}</h1>
          {c && <p>{c.phone}{c.email ? ` · ${c.email}` : ''} · joined {date(c.created_at)}</p>}
        </div>
        {c && (
          <div className="row">
            {can('money') && <button className="btn" onClick={() => setCreditOpen(true)}>Add wallet credit</button>}
            {can('manage') && <button className={`btn ${c.status === 'active' ? 'danger' : ''}`} onClick={() => setBlockOpen(true)}>{c.status === 'active' ? 'Block' : 'Unblock'}</button>}
          </div>
        )}
      </div>

      <QueryState isLoading={q.isLoading} error={q.error}>
        {c && (
          <>
            <div className="grid-4">
              <div className="card stat accent"><div className="label">Wallet</div><div className="value">{money(c.wallet_balance)}</div></div>
              <div className="card stat"><div className="label">Orders</div><div className="value">{num(c.order_count)}</div><div className="sub">{c.last_order_at ? `Last ${dateTime(c.last_order_at)}` : 'No orders yet'}</div></div>
              <div className="card stat"><div className="label">Total spent</div><div className="value">{money(c.total_spent)}</div></div>
              <div className="card stat"><div className="label">Promotions</div><div className="value" style={{ fontSize: 18 }}>{c.promo_opt_in === undefined ? '—' : bool(c.promo_opt_in) ? 'Opted in' : 'Opted out'}</div></div>
            </div>
            <div className="card">
              <Tabs value={tab} onChange={setTab} tabs={[
                { value: 'orders', label: 'Orders', count: c.orders?.length },
                { value: 'wallet', label: 'Wallet ledger', count: c.ledger?.length },
              ]} />
              {tab === 'orders' ? <OrdersTable orders={c.orders ?? []} hide={['customer']} /> : <LedgerTable entries={c.ledger ?? []} />}
            </div>
          </>
        )}
      </QueryState>

      {blockOpen && c && (
        <Confirm title={c.status === 'active' ? `Block ${c.name || c.phone}?` : `Unblock ${c.name || c.phone}?`}
          danger={c.status === 'active'} confirmLabel={c.status === 'active' ? 'Block' : 'Unblock'}
          message={c.status === 'active'
            ? 'They will be signed out and can’t place orders. Their wallet balance and order history are kept.'
            : 'They can sign in and order again.'}
          busy={setStatus.isPending} error={setStatus.error}
          onConfirm={() => setStatus.mutate(c.status === 'active' ? 'blocked' : 'active')} onClose={() => setBlockOpen(false)} />
      )}
      {creditOpen && c && <WalletCredit customer={c} onClose={() => setCreditOpen(false)} />}
    </div>
  );
}

function WalletCredit({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const n = Number(amount);
  const ok = n > 0 && n <= 5000 && notes.trim().length > 0;
  const act = useAction(() => api.post(`/admin/customers/${customer.id}/wallet-credit`, { amount: n, notes: notes.trim() }), {
    success: `${money(n)} added to wallet`, invalidate: ['/admin/customers'], onDone: onClose,
  });
  return (
    <Modal title="Add wallet credit" onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" disabled={!ok || act.isPending} onClick={() => act.mutate(undefined)}>{act.isPending ? 'Adding…' : `Add ${n > 0 ? money(n) : 'credit'}`}</button>
    </>}>
      <p className="muted" style={{ margin: 0 }}>Goodwill credit for {customer.name || customer.phone}. It's recorded as a manual adjustment in their ledger.</p>
      <Field label="Amount (₹)" hint="Up to ₹5,000 per credit.">
        <input className="input" type="number" min="1" max="5000" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
      </Field>
      <Field label="Reason" hint="Required. The customer may see this in their wallet history.">
        <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Late delivery on order #123" />
      </Field>
      {act.error && <div className="alert error">{errMsg(act.error)}</div>}
    </Modal>
  );
}
