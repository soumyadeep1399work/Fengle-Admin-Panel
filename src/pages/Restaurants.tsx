import { useCan } from '../auth';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Restaurant } from '../api/types';
import { SelfieBadge } from '../components/AgreementSelfie';
import { DocsBadge } from '../components/PartnerDocuments';
import { BankBadge } from '../components/RiderBankCard';
import RestaurantForm from '../components/RestaurantForm';
import { Empty, QueryState, StatusBadge, Tabs } from '../components/ui';
import { num } from '../lib/format';

type Filter = 'all' | 'active' | 'inactive' | 'suspended';

export default function Restaurants() {
  const nav = useNavigate();
  const can = useCan();
  const q = useQuery({
    queryKey: ['/admin/restaurants'],
    queryFn: () => api.get<{ restaurants: Restaurant[] }>('/admin/restaurants'),
  });
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [onboard, setOnboard] = useState(false);

  const all = q.data?.restaurants ?? [];
  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return all.filter((r) => (filter === 'all' || r.status === filter) &&
      (!s || r.name.toLowerCase().includes(s) || r.phone.includes(s) || r.address.toLowerCase().includes(s)));
  }, [all, filter, search]);
  const count = (s: Filter) => (s === 'all' ? all.length : all.filter((r) => r.status === s).length);

  return (
    <div className="stack">
      <div className="page-head">
        <div><h1>Restaurants</h1><p>Partner kitchens. Onboarding is admin-only; kitchens can't sign themselves up.</p></div>
        {can('manage') && <button className="btn primary" onClick={() => setOnboard(true)}>+ Onboard kitchen</button>}
      </div>
      <div className="card">
        <Tabs value={filter} onChange={setFilter} tabs={(['all', 'active', 'inactive', 'suspended'] as Filter[]).map((s) => ({
          value: s, label: s === 'all' ? 'All' : s[0].toUpperCase() + s.slice(1), count: count(s),
        }))} />
        <div className="toolbar">
          <input className="input search" placeholder="Search name, phone or address" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <QueryState isLoading={q.isLoading} error={q.error}>
          {rows.length === 0 ? <Empty title="No kitchens match" /> : (
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Kitchen</th><th>Status</th><th>Address</th><th className="num">Radius</th><th className="num">Commission</th><th className="num">Orders</th><th>Selfie</th><th>Documents</th><th>Bank</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="clickable" onClick={() => nav(`/restaurants/${r.id}`)}>
                      <td><div className="cell-main">{r.name}</div><div className="cell-sub">{r.phone}{r.owner_name ? ` · ${r.owner_name}` : ''}</div></td>
                      <td><StatusBadge status={r.status} /></td>
                      <td className="muted small" style={{ maxWidth: 320 }}>{r.address}</td>
                      <td className="num">{Number(r.radius_km)} km</td>
                      <td className="num">{Number(r.commission_rate_percent)}%</td>
                      <td className="num">{r.order_count !== undefined ? num(r.order_count) : '—'}</td>
                      <td><SelfieBadge hasSelfie={r.hasAgreementSelfie} status={r.verificationStatus} /></td>
                      <td><DocsBadge summary={r.documents} /></td>
                      <td><BankBadge has={r.has_bank_account} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </QueryState>
      </div>
      {onboard && <RestaurantForm onClose={() => setOnboard(false)} onSaved={(id) => nav(`/restaurants/${id}`)} />}
    </div>
  );
}
