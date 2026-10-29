import { useCan } from '../auth';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import type { PartnerStatus, Rider } from '../api/types';
import { normalizeRider } from '../api/normalize';
import AgreementSelfie from '../components/AgreementSelfie';
import PartnerDocumentsCard from '../components/PartnerDocuments';
import RiderBankCard from '../components/RiderBankCard';
import LedgerTable from '../components/LedgerTable';
import OrdersTable from '../components/OrdersTable';
import SettleRider from '../components/SettleRider';
import CashHandover from '../components/CashHandover';
import { Confirm, QueryState, StatusBadge, Tabs } from '../components/ui';
import { useAction } from '../lib/hooks';
import { dateTime, money, num } from '../lib/format';

async function fetchRider(id: string): Promise<Rider> {
  try {
    const res = await api.get<Record<string, unknown>>(`/admin/riders/${id}`);
    return normalizeRider(res.rider as Record<string, unknown>, res);
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 404)) throw e;
    const list = (await api.get<{ riders: Rider[] }>('/admin/riders')).riders;
    const r = list.find((x) => String(x.id) === id);
    if (!r) throw new ApiError(404, 'Rider not found', null);
    return normalizeRider(r as unknown as Record<string, unknown>);
  }
}

export default function RiderDetail() {
  const { id = '' } = useParams();
  const q = useQuery({ queryKey: ['/admin/riders/', id], queryFn: () => fetchRider(id) });
  const r = q.data;
  const can = useCan();
  const [tab, setTab] = useState<'orders' | 'ledger'>('orders');
  const [settling, setSettling] = useState(false);
  const [handover, setHandover] = useState(false);
  const [statusTo, setStatusTo] = useState<PartnerStatus | null>(null);

  const setStatus = useAction((s: PartnerStatus) => api.patch(`/admin/riders/${id}`, { status: s }), {
    success: 'Rider status updated', invalidate: ['/admin/riders', '/admin/dashboard'], onDone: () => setStatusTo(null),
  });

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <div className="small"><Link to="/riders">← Riders</Link></div>
          <h1 className="row" style={{ marginTop: 6 }}>{r?.name || 'Rider'} {r && <StatusBadge status={r.status} />}</h1>
          {r && <p>{r.phone} · joined {dateTime(r.created_at)}</p>}
        </div>
        {r && (
          <div className="row">
            {can('manage') && <button className="btn" onClick={() => setHandover(true)}>Record cash received</button>}
            {can('money') && <button className="btn primary" onClick={() => setSettling(true)}>Run settlement</button>}
            {can('manage') && (r.status === 'active'
              ? <button className="btn danger" onClick={() => setStatusTo('suspended')}>Suspend</button>
              : <button className="btn" onClick={() => setStatusTo('active')}>Reactivate</button>)}
          </div>
        )}
      </div>

      <QueryState isLoading={q.isLoading} error={q.error}>
        {r && (
          <>
            <div className="grid-4">
              <div className={`card stat ${Number(r.wallet_balance) < 0 ? '' : 'accent'}`}>
                <div className="label">Wallet balance</div>
                <div className="value" style={Number(r.wallet_balance) < 0 ? { color: 'var(--red)' } : undefined}>{money(r.wallet_balance)}</div>
                <div className="sub">{Number(r.wallet_balance) < 0 ? 'Owes Fengle COD cash' : 'Earnings net of COD'}</div>
              </div>
              <div className="card stat"><div className="label">COD held</div><div className="value">{r.cod_outstanding !== undefined ? money(r.cod_outstanding) : '—'}</div></div>
              <div className="card stat"><div className="label">Unsettled deliveries</div><div className="value">{r.unsettled_deliveries !== undefined ? num(r.unsettled_deliveries) : '—'}</div>{r.payouts && <div className="sub">{money(r.payouts.unsettled)} to pay · {money(r.payouts.total_earned)} earned in all</div>}</div>
              <div className="card stat"><div className="label">Vehicle</div><div className="value" style={{ fontSize: 18 }}>{r.vehicle_type || '—'}</div><div className="sub">{r.vehicle_number}</div></div>
            </div>

            <RiderBankCard account={r.bank_account} history={r.bank_account_history} />
            <PartnerDocumentsCard ownerType="rider" id={r.id} />
            <AgreementSelfie kind="riders" id={r.id} hasSelfie={r.hasAgreementSelfie} acceptedAt={r.agreementAcceptedAt} version={r.agreementVersion} verificationStatus={r.verificationStatus} deniedReason={r.verificationDeniedReason} />

            <div className="card">
              <Tabs value={tab} onChange={setTab} tabs={[
                { value: 'orders', label: 'Deliveries', count: r.orders?.length },
                { value: 'ledger', label: 'Wallet ledger', count: r.ledger?.length },
              ]} />
              {tab === 'orders' && (r.orders
                ? <OrdersTable orders={r.orders} hide={['rider']} showRiderPay />
                : <div className="empty">Delivery history appears once the rider detail endpoint is live.</div>)}
              {tab === 'ledger' && (r.ledger
                ? <LedgerTable entries={r.ledger} />
                : <div className="empty">The ledger appears once the rider detail endpoint is live.</div>)}
            </div>
          </>
        )}
      </QueryState>

      {settling && r && <SettleRider rider={r} onClose={() => setSettling(false)} />}
      {handover && r && <CashHandover rider={r} onClose={() => setHandover(false)} />}
      {statusTo && r && (
        <Confirm title={statusTo === 'suspended' ? `Suspend ${r.name || 'this rider'}?` : `Reactivate ${r.name || 'this rider'}?`}
          danger={statusTo === 'suspended'} confirmLabel={statusTo === 'suspended' ? 'Suspend' : 'Reactivate'}
          message={statusTo === 'suspended'
            ? 'They will be signed out of the Rider app and get no new deliveries. Settle any COD cash they hold separately.'
            : 'They can log in and take deliveries again.'}
          busy={setStatus.isPending} error={setStatus.error} onConfirm={() => setStatus.mutate(statusTo)} onClose={() => setStatusTo(null)} />
      )}
    </div>
  );
}
