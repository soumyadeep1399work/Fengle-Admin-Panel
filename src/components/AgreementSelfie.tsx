import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchBlob } from '../api/client';
import { Badge, Modal, QueryState } from './ui';
import { dateTime } from '../lib/format';

interface Props {
  kind: 'restaurants' | 'riders';
  id: number | string;
  hasSelfie?: boolean;
  acceptedAt?: string | null;
  version?: number | null;
}

/** The mini-badge used in list rows: did this partner upload their verification selfie? */
export function SelfieBadge({ hasSelfie }: { hasSelfie?: boolean }) {
  if (hasSelfie === undefined) return <span className="muted">—</span>;
  return hasSelfie ? <Badge tone="green" dot>Uploaded</Badge> : <Badge tone="gold" dot>Not uploaded</Badge>;
}

/**
 * Agreement + selfie verification card. The selfie is never a public URL (see the
 * backend's storage.service.js) — it's streamed to admins only, so it is fetched with
 * the Bearer token and shown through a temporary blob URL.
 */
export default function AgreementSelfie({ kind, id, hasSelfie, acceptedAt, version }: Props) {
  const [zoom, setZoom] = useState(false);
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
      <div className="card-head"><h3>Agreement &amp; selfie</h3><SelfieBadge hasSelfie={hasSelfie} /></div>
      <div className="card-pad stack">
        <dl className="kv">
          <dt>Accepted in app</dt><dd>{acceptedAt ? dateTime(acceptedAt) : 'Not yet'}</dd>
          <dt>Agreement version</dt><dd>{version ?? '—'}</dd>
        </dl>
        {hasSelfie ? (
          <QueryState isLoading={img.isLoading} error={img.error}>
            {url && (
              <>
                <button type="button" onClick={() => setZoom(true)} aria-label="Enlarge selfie"
                  style={{ border: 0, padding: 0, background: 'none', cursor: 'zoom-in', alignSelf: 'flex-start' }}>
                  <img src={url} alt="Verification selfie" style={{ width: 220, maxWidth: '100%', borderRadius: 12, display: 'block' }} />
                </button>
                <small className="muted">Click the photo to enlarge. Visible to admins only.</small>
              </>
            )}
          </QueryState>
        ) : (
          <div className="muted">
            {acceptedAt
              ? 'No selfie on file — this account was onboarded before in-app verification existed.'
              : 'The selfie has not been uploaded yet. The app stays locked until it is.'}
          </div>
        )}
      </div>
      {zoom && url && (
        <Modal title="Verification selfie" wide onClose={() => setZoom(false)}>
          <img src={url} alt="Verification selfie" style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 8 }} />
        </Modal>
      )}
    </div>
  );
}
