import { useCan } from '../auth';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, fetchBlob } from '../api/client';
import type { VerificationStatus } from '../api/types';
import { useAction } from '../lib/hooks';
import { Badge, Confirm, Modal, QueryState } from './ui';
import { dateTime } from '../lib/format';

interface Props {
  kind: 'restaurants' | 'riders';
  id: number | string;
  hasSelfie?: boolean;
  acceptedAt?: string | null;
  version?: number | null;
  verificationStatus?: VerificationStatus;
  deniedReason?: string | null;
}

/** The mini-badge used in list rows: did this partner upload their verification selfie? */
export function SelfieBadge({ hasSelfie, status }: { hasSelfie?: boolean; status?: VerificationStatus }) {
  if (hasSelfie === undefined) return <span className="muted">—</span>;
  if (!hasSelfie) {
    // An approved account with no selfie predates in-app verification: nothing to review.
    return status === 'approved' ? <Badge dot>No selfie (older account)</Badge> : <Badge tone="gold" dot>Not uploaded</Badge>;
  }
  if (status === 'approved') return <Badge tone="green" dot>Approved</Badge>;
  if (status === 'denied') return <Badge tone="red" dot>Denied</Badge>;
  return <Badge tone="gold" dot>Awaiting review</Badge>;
}

/**
 * Agreement + selfie verification card. The selfie is never a public URL (see the
 * backend's storage.service.js) — it's streamed to admins only, so it is fetched with
 * the Bearer token and shown through a temporary blob URL.
 */
export default function AgreementSelfie({ kind, id, hasSelfie, acceptedAt, version, verificationStatus, deniedReason }: Props) {
  const [zoom, setZoom] = useState(false);
  const [denying, setDenying] = useState(false);
  const review = useAction((v: { decision: 'approve' | 'deny'; reason?: string }) => api.post(`/admin/${kind}/${id}/verification`, v), {
    success: 'Verification updated', invalidate: [`/admin/${kind}`], onDone: () => setDenying(false),
  });
  const can = useCan();
  const img = useQuery({
    queryKey: ['agreement-selfie', kind, String(id)],
    queryFn: async () => URL.createObjectURL(await fetchBlob(`/admin/${kind}/${id}/agreement-selfie`)),
    enabled: hasSelfie === true,
    staleTime: Infinity,
    gcTime: 0,
  });

  // Release the object URL once nothing is showing it any more.
  const url = img.data;
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  return (
    <div className="card">
      <div className="card-head"><h3>Agreement &amp; selfie</h3><SelfieBadge hasSelfie={hasSelfie} status={verificationStatus} /></div>
      <div className="card-pad stack">
        <div className="row" style={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
          <dl className="kv" style={{ flex: '1 1 220px', minWidth: 0 }}>
            <dt>Accepted in app</dt><dd>{acceptedAt ? dateTime(acceptedAt) : 'Not yet'}</dd>
            <dt>Agreement version</dt><dd>{version ?? '—'}</dd>
          </dl>
          {hasSelfie && (
            <div style={{ flex: '0 0 auto' }}>
              <QueryState isLoading={img.isLoading} error={img.error}>
                {url && (
                  <button type="button" onClick={() => setZoom(true)} aria-label="Enlarge selfie"
                    style={{ border: 0, padding: 0, background: 'none', cursor: 'zoom-in', display: 'block' }}>
                    <img src={url} alt="Verification selfie"
                      style={{ width: 150, height: 200, objectFit: 'cover', borderRadius: 12, display: 'block' }} />
                  </button>
                )}
              </QueryState>
            </div>
          )}
        </div>
        {hasSelfie && verificationStatus === 'denied' && (
          <div className="alert error">Denied{deniedReason ? `: ${deniedReason}` : ''}. They must retake the photo before they can use the app.</div>
        )}
        {hasSelfie && verificationStatus === 'pending' && (
          <div className="alert warn">Waiting for your review. Until you approve it, they can't receive orders or use the app.</div>
        )}
        {hasSelfie && can('manage') && (
          <div className="row">
            {verificationStatus !== 'approved' && (
              <button className="btn primary" disabled={review.isPending} onClick={() => review.mutate({ decision: 'approve' })}>Approve</button>
            )}
            {verificationStatus !== 'denied' && (
              <button className="btn danger" disabled={review.isPending} onClick={() => setDenying(true)}>Deny</button>
            )}
          </div>
        )}
        {hasSelfie ? (
          <small className="muted">Click the photo to enlarge. Visible to admins only.</small>
        ) : (
          <div className="muted">
            {acceptedAt
              ? 'No selfie on file — this account was onboarded before in-app verification existed.'
              : 'The selfie has not been uploaded yet. The app stays locked until it is.'}
          </div>
        )}
      </div>
      {denying && (
        <Confirm title="Deny this photo?" danger confirmLabel="Deny" reasonLabel="Reason (shown to them in the app)"
          message="They'll be asked to retake their selfie, and can't use the app or receive orders until you approve the new one."
          busy={review.isPending} error={review.error} onConfirm={(reason) => review.mutate({ decision: 'deny', reason })} onClose={() => setDenying(false)} />
      )}
      {zoom && url && (
        <Modal title="Verification selfie" wide onClose={() => setZoom(false)}>
          <img src={url} alt="Verification selfie" style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 8 }} />
        </Modal>
      )}
    </div>
  );
}
