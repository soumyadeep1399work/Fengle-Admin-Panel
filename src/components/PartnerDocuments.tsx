import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, fetchBlob } from '../api/client';
import type { DocumentSummary, DocRequirement, OwnerDocuments, PartnerDocument } from '../api/types';
import { useCan } from '../auth';
import { useAction } from '../lib/hooks';
import { date, dateTime } from '../lib/format';
import { Badge, Confirm, Modal, QueryState } from './ui';

const SUMMARY: Record<string, { label: string; tone: string }> = {
  complete: { label: 'All approved', tone: 'green' },
  expiring: { label: 'Expiring soon', tone: 'gold' },
  pending: { label: 'Awaiting review', tone: 'gold' },
  rejected: { label: 'Rejected', tone: 'red' },
  expired: { label: 'Expired', tone: 'red' },
  missing: { label: 'Missing', tone: 'red' },
};

/** List-row badge for a partner's overall document standing. */
export function DocsBadge({ summary }: { summary?: DocumentSummary }) {
  if (!summary) return <span className="muted">—</span>;
  const s = SUMMARY[summary.status] ?? { label: summary.status, tone: '' };
  return <Badge tone={s.tone} dot>{s.label}</Badge>;
}

export function DocStatusBadge({ doc }: { doc: PartnerDocument | null | undefined }) {
  if (!doc) return <Badge tone="red" dot>Not uploaded</Badge>;
  if (doc.status === 'approved') return <Badge tone="green" dot>Approved</Badge>;
  if (doc.status === 'rejected') return <Badge tone="red" dot>Rejected</Badge>;
  return <Badge tone="gold" dot>Awaiting review</Badge>;
}

function isExpired(d: string | null) {
  return !!d && d < new Date().toISOString().slice(0, 10);
}

/**
 * Opens a document in a modal. Files are never public: they're streamed to admins only,
 * so they're fetched with the Bearer token and shown through a temporary blob URL.
 */
export function DocumentViewer({ doc, title, onClose }: { doc: PartnerDocument; title: string; onClose: () => void }) {
  const file = useQuery({
    queryKey: ['partner-document-file', doc.id],
    queryFn: async () => URL.createObjectURL(await fetchBlob(`/admin/documents/${doc.id}/file`)),
    staleTime: Infinity,
    gcTime: 0,
  });
  const url = file.data;
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const isPdf = doc.contentType === 'application/pdf';
  return (
    <Modal wide title={title} onClose={onClose} footer={url ? <a className="btn" href={url} target="_blank" rel="noreferrer">Open in new tab</a> : undefined}>
      <QueryState isLoading={file.isLoading} error={file.error}>
        {url && (isPdf
          ? <iframe title={title} src={url} style={{ width: '100%', height: '70vh', border: 0, borderRadius: 8 }} />
          : <img src={url} alt={title} style={{ maxWidth: '100%', maxHeight: '70vh', display: 'block', margin: '0 auto', borderRadius: 8 }} />)}
      </QueryState>
      <small className="muted">Identity document. Visible to admins only; don't download it to shared computers.</small>
    </Modal>
  );
}

/** Approve / reject controls for one upload, shared by the partner card and the review queue. */
export function ReviewButtons({ doc, invalidate }: { doc: PartnerDocument; invalidate: string[] }) {
  const can = useCan();
  const [rejecting, setRejecting] = useState(false);
  const review = useAction((v: { decision: 'approve' | 'reject'; reason?: string }) => api.post(`/admin/documents/${doc.id}/review`, v), {
    success: 'Document updated', invalidate, onDone: () => setRejecting(false),
  });
  if (!can('manage')) return null;
  return (
    <>
      {doc.status !== 'approved' && (
        <button className="btn sm primary" disabled={review.isPending} onClick={() => review.mutate({ decision: 'approve' })}>Approve</button>
      )}
      {doc.status !== 'rejected' && (
        <button className="btn sm danger" disabled={review.isPending} onClick={() => setRejecting(true)}>Reject</button>
      )}
      {rejecting && (
        <Confirm title={`Reject ${doc.label}?`} danger confirmLabel="Reject" reasonLabel="Reason (sent to the partner)"
          message={<>The partner is notified and asked to upload it again.{doc.status === 'approved' && <> Rejecting an approved document can stop them receiving work while documents are enforced.</>}</>}
          busy={review.isPending} error={review.error} onConfirm={(reason) => review.mutate({ decision: 'reject', reason })} onClose={() => setRejecting(false)} />
      )}
    </>
  );
}

function DocRow({ req, doc, invalidate }: { req: DocRequirement; doc: PartnerDocument | null | undefined; invalidate: string[] }) {
  const [viewing, setViewing] = useState<PartnerDocument | null>(null);
  return (
    <div className="doc-row">
      <div style={{ minWidth: 0 }}>
        <div className="row" style={{ gap: 8 }}>
          <b className="cell-main">{req.label}</b>
          {!req.required && <span className="badge">Optional</span>}
          <DocStatusBadge doc={doc} />
          {doc?.expiryDate && isExpired(doc.expiryDate) && <Badge tone="red">Expired</Badge>}
        </div>
        {doc ? (
          <div className="small muted" style={{ marginTop: 4 }}>
            {doc.docNumber && <>No. <span className="mono">{doc.docNumber}</span> · </>}
            {doc.expiryDate && <>Valid till {date(doc.expiryDate)} · </>}
            Uploaded {dateTime(doc.uploadedAt)}
            {doc.status === 'rejected' && doc.rejectionReason && <div style={{ color: 'var(--red)' }}>Rejected: {doc.rejectionReason}</div>}
            {doc.approvedVersion && (
              <div>
                Still counting: the approved earlier upload{doc.approvedVersion.expiryDate ? `, valid till ${date(doc.approvedVersion.expiryDate)}` : ''}.{' '}
                <button className="linklike" onClick={() => setViewing(doc.approvedVersion!)}>View it</button>
              </div>
            )}
          </div>
        ) : (
          <div className="small muted" style={{ marginTop: 4 }}>{req.required ? 'Required.' : 'Not required.'} Waiting for the partner to upload it.</div>
        )}
      </div>
      {doc && (
        <div className="row nowrap" style={{ justifyContent: 'flex-end' }}>
          <button className="btn sm" onClick={() => setViewing(doc)}>View</button>
          <ReviewButtons doc={doc} invalidate={invalidate} />
        </div>
      )}
      {viewing && <DocumentViewer doc={viewing} title={viewing.label} onClose={() => setViewing(null)} />}
    </div>
  );
}

/** "Documents" card on the restaurant / rider detail pages. */
export default function PartnerDocumentsCard({ ownerType, id }: { ownerType: 'restaurant' | 'rider'; id: number | string }) {
  const path = `/admin/documents/${ownerType}/${id}`;
  const q = useQuery({ queryKey: [path], queryFn: () => api.get<OwnerDocuments>(path) });
  const [showHistory, setShowHistory] = useState(false);
  const [viewing, setViewing] = useState<PartnerDocument | null>(null);
  const invalidate = ['/admin/documents', ownerType === 'restaurant' ? '/admin/restaurants' : '/admin/riders'];
  const d = q.data;

  return (
    <div className="card">
      <div className="card-head">
        <h3>Documents</h3>
        {d && <DocsBadge summary={d.summary} />}
      </div>
      <QueryState isLoading={q.isLoading} error={q.error}>
        {d && (
          <div className="card-pad stack" style={{ gap: 12 }}>
            {!d.summary.complete && d.enforced && (
              <div className="alert warn">
                {ownerType === 'restaurant' ? 'This kitchen gets no orders' : 'This rider gets no deliveries'} until every required document is approved and in date.
              </div>
            )}
            {d.summary.complete && d.summary.validUntil && d.summary.validUntil !== '9999-12-31' && (
              <div className="small muted">Documents valid till {date(d.summary.validUntil)} (earliest licence expiry).</div>
            )}
            {d.requirements.map((req) => <DocRow key={req.type} req={req} doc={d.documents[req.type]} invalidate={invalidate} />)}
            <small className="muted">
              Partners upload these at <b>partner.fengle.in</b> with their login phone number.
            </small>
            {d.history.length > 0 && (
              <>
                <button className="linklike" style={{ alignSelf: 'flex-start' }} onClick={() => setShowHistory((v) => !v)}>
                  {showHistory ? 'Hide' : 'Show'} upload history ({d.history.length})
                </button>
                {showHistory && (
                  <div className="table-wrap">
                    <table className="tbl">
                      <thead><tr><th>Document</th><th>Status</th><th>Number</th><th>Expiry</th><th>Uploaded</th><th /></tr></thead>
                      <tbody>
                        {d.history.map((h) => (
                          <tr key={h.id}>
                            <td>{h.label}</td>
                            <td><DocStatusBadge doc={h} /></td>
                            <td className="mono small">{h.docNumber ?? '—'}</td>
                            <td className="small">{h.expiryDate ? date(h.expiryDate) : '—'}</td>
                            <td className="small nowrap">{dateTime(h.uploadedAt)}</td>
                            <td className="right"><button className="btn sm ghost" onClick={() => setViewing(h)}>View</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </QueryState>
      {viewing && <DocumentViewer doc={viewing} title={viewing.label} onClose={() => setViewing(null)} />}
    </div>
  );
}
