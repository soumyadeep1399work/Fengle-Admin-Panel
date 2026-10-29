import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Rider } from '../api/types';
import { useAction } from '../lib/hooks';
import { money, num } from '../lib/format';
import { Confirm, useToast } from './ui';

/** Runs settlement for one rider: pays earnings for unsettled deliveries and nets them against COD cash held. */
export default function SettleRider({ rider, onClose }: { rider: Rider; onClose: () => void }) {
  const toast = useToast();
  const settle = useAction(
    () => api.post<{ ordersSettled: number; totalEarnings: number; newBalance: number | string }>(`/admin/riders/${rider.id}/settle`),
    { invalidate: ['/admin/riders', '/admin/settlements', '/admin/orders'] },
  );
  return (
    <Confirm title={`Settle ${rider.name || 'rider'}?`} confirmLabel="Run settlement" busy={settle.isPending} error={settle.error}
      message={
        <div className="stack" style={{ gap: 10 }}>
          <div>
            This pays earnings for every delivered, unsettled order
            {rider.unsettled_deliveries !== undefined && <> (<b>{num(rider.unsettled_deliveries)}</b> right now)</>} and nets them against the COD cash the rider is holding
            {rider.cod_outstanding !== undefined && <> (<b>{money(rider.cod_outstanding)}</b>)</>}. It can't be undone.
          </div>
          <div className="muted small">
            Each delivery pays what was worked out when it was delivered, using the <Link to="/shipping">shipping charge rules</Link> in force then.
            Deliveries from before those settings existed use today's settings.
          </div>
        </div>
      }
      onConfirm={() => settle.mutate(undefined, {
        onSuccess: (r) => {
          toast(r.ordersSettled === 0
            ? 'Nothing to settle — no unsettled deliveries'
            : `Settled ${r.ordersSettled} deliveries · earned ${money(r.totalEarnings)} · balance now ${money(r.newBalance)}`);
          onClose();
        },
      })}
      onClose={onClose} />
  );
}
