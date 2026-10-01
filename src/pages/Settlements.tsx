import { useState } from 'react';
import type { LedgerEntry } from '../api/types';
import LedgerTable from '../components/LedgerTable';
import { Pager, QueryState } from '../components/ui';
import { useList } from '../lib/hooks';

const LIMIT = 50;

export default function Settlements() {
  const [page, setPage] = useState(1);
  const [riderId, setRiderId] = useState('');
  const { data, isLoading, error } = useList<LedgerEntry>('/admin/settlements', 'settlements', {
    rider_id: riderId || undefined, page, limit: LIMIT,
  });
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Settlements</h1>
          <p>Rider payouts and the COD cash netted against them. Settlement runs manually from a rider's page; there is no automatic schedule yet.</p>
        </div>
      </div>
      <div className="card">
        <div className="toolbar">
          <input className="input" style={{ width: 160 }} placeholder="Rider ID" inputMode="numeric" value={riderId}
            onChange={(e) => { setRiderId(e.target.value.replace(/\D/g, '')); setPage(1); }} />
        </div>
        <QueryState isLoading={isLoading} error={error}>
          <LedgerTable entries={data?.rows ?? []} showOwner />
          <Pager page={page} limit={LIMIT} total={data?.total} count={data?.rows.length ?? 0} onPage={setPage} />
        </QueryState>
      </div>
    </div>
  );
}
