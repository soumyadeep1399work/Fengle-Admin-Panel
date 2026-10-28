import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { PartnerDocument } from '../api/types';
import { DocStatusBadge, DocumentViewer, ReviewButtons } from '../components/PartnerDocuments';
import { Empty, Pager, QueryState, Tabs } from '../components/ui';
import { useList } from '../lib/hooks';
import { date, dateTime } from '../lib/format';

const LIMIT = 50;
type StatusTab = 'pending' | 'rejected' | 'approved' | '';
type OwnerTab = '' | 'restaurant' | 'rider';

/** Review queue for partner KYC / licence uploads (oldest pending first). */
export default function Documents() {
  const [status, setStatus] = useState<StatusTab>('pending');
  const [ownerType, setOwnerType] = useState<OwnerTab>('');
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<PartnerDocument | null>(null);
  const { data, isLoading, error } = useList<PartnerDocument>('/admin/documents', 'documents', {
    status: status || undefined, owner_type: ownerType || undefined, page, limit: LIMIT,
  });

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Documents</h1>
          <p>Aadhaar, FSSAI and licences uploaded by kitchens and riders at partner.fengle.in. Check each one against the details and approve or reject it.</p>
        </div>
      </div>
      <div className="card">
        <Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={[
          { value: 'pending', label: 'Awaiting review', count: status === 'pending' ? data?.total : undefined },
          { value: 'rejected', label: 'Rejected' },
          { value: 'approved', label: 'Approved' },
          { value: '', label: 'All' },
        ]} />
        <div className="toolbar">
          <select className="select" value={ownerType} onChange={(e) => { setOwnerType(e.target.value as OwnerTab); setPage(1); }} aria-label="Partner type">
            <option value="">Kitchens and riders</option>
            <option value="restaurant">Kitchens only</option>
            <option value="rider">Riders only</option>
          </select>
        </div>
        <QueryState isLoading={isLoading} error={error}>
          {(data?.rows.length ?? 0) === 0 ? (
            <Empty title={status === 'pending' ? 'Nothing waiting for review' : 'No documents here'} />
          ) : (
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Partner</th><th>Document</th><th>Details</th><th>Status</th><th>Uploaded</th><th /></tr></thead>
                <tbody>
                  {data!.rows.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <Link className="cell-main" to={d.ownerType === 'restaurant' ? `/restaurants/${d.ownerId}` : `/riders/${d.ownerId}`}>
                          {d.ownerName || (d.ownerType === 'restaurant' ? 'Kitchen' : 'Rider')}
                        </Link>
                        <div className="cell-sub">{d.ownerType === 'restaurant' ? 'Kitchen' : 'Rider'} · {d.ownerPhone}</div>
                      </td>
                      <td className="cell-main">{d.label}</td>
                      <td className="small">
                        {d.docNumber ? <span className="mono">{d.docNumber}</span> : <span className="muted">—</span>}
                        {d.expiryDate && <div className="muted">Valid till {date(d.expiryDate)}</div>}
                      </td>
                      <td>
                        <DocStatusBadge doc={d} />
                        {d.status === 'rejected' && d.rejectionReason && <div className="cell-sub" style={{ maxWidth: 220 }}>{d.rejectionReason}</div>}
                      </td>
                      <td className="small nowrap">{dateTime(d.uploadedAt)}</td>
                      <td className="right">
                        <div className="row nowrap" style={{ justifyContent: 'flex-end' }}>
                          <button className="btn sm" onClick={() => setViewing(d)}>View</button>
                          <ReviewButtons doc={d} invalidate={['/admin/documents', '/admin/restaurants', '/admin/riders']} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={page} limit={LIMIT} total={data?.total} count={data?.rows.length ?? 0} onPage={setPage} />
        </QueryState>
      </div>
      {viewing && <DocumentViewer doc={viewing} title={`${viewing.label} · ${viewing.ownerName ?? ''}`} onClose={() => setViewing(null)} />}
    </div>
  );
}
