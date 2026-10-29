import { useState } from 'react';
import type { RiderBankAccount, RiderBankHistoryRow } from '../api/types';
import { ago, dateTime } from '../lib/format';
import { Badge, useToast } from './ui';

const RECENT_DAYS = 7;

/** "•••• 1234" for the part of the number that is safe to show everyone. */
const masked = (last4: string) => `•••• ${last4}`;

function CopyValue({ label, value }: { label: string; value: string }) {
  const toast = useToast();
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      toast(`${label} copied.`);
    } catch {
      toast('Couldn’t copy. Select the text and copy it by hand.', true);
    }
  }
  return <button type="button" className="btn sm" onClick={copy}>Copy</button>;
}

function Line({ label, children, copy }: { label: string; children: React.ReactNode; copy?: string }) {
  return (
    <div className="row between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border, #eee)' }}>
      <div>
        <div className="muted small">{label}</div>
        <div style={{ fontWeight: 700, wordBreak: 'break-all' }}>{children}</div>
      </div>
      {copy && <CopyValue label={label} value={copy} />}
    </div>
  );
}

/** Where a rider's weekly payout goes: the account they added in the Rider app, with who-changed-what history. */
export default function RiderBankCard({ account, history }: { account: RiderBankAccount | null | undefined; history: RiderBankHistoryRow[] | undefined }) {
  const [showHistory, setShowHistory] = useState(false);
  const [now] = useState(() => Date.now());

  if (account === undefined) return null; // the backend doesn't send it yet

  if (!account) {
    return (
      <div className="card card-pad">
        <div className="row between">
          <h3 style={{ margin: 0 }}>Payout account</h3>
          <Badge tone="gold" dot>Not added</Badge>
        </div>
        <p className="muted small" style={{ marginBottom: 0 }}>This rider hasn’t added bank details in the Rider app yet, so there is nowhere to send their weekly payout.</p>
      </div>
    );
  }

  const full = account.account_number;
  const changedChanges = (history ?? []).filter((h) => h.action === 'update');
  const recentChange = changedChanges.find((h) => now - new Date(h.created_at).getTime() < RECENT_DAYS * 864e5);

  return (
    <div className="card card-pad stack">
      <div className="row between">
        <h3 style={{ margin: 0 }}>Payout account</h3>
        {recentChange ? <Badge tone="gold" dot>Changed {ago(recentChange.created_at)}</Badge> : <Badge tone="green" dot>Added</Badge>}
      </div>
      {recentChange && (
        <div className="alert warn">The rider changed this payout account {ago(recentChange.created_at)}. Confirm with them before sending the next payout.</div>
      )}
      <div>
        <Line label="Account holder" copy={account.account_holder_name}>{account.account_holder_name}</Line>
        <Line label="Account number" copy={full ?? undefined}>{full ?? masked(account.account_number_last4)}</Line>
        <Line label="IFSC" copy={account.ifsc}>{account.ifsc}{account.bank_name ? ` · ${account.bank_name}` : ''}</Line>
        {account.upi_id && <Line label="UPI ID" copy={account.upi_id}>{account.upi_id}</Line>}
      </div>
      {account.account_number_unavailable
        ? <div className="alert error">The full account number can’t be read (the server’s encryption key is missing). Ask the rider to save their bank details again.</div>
        : !full && <small className="muted">The full account number is visible to Operations and Super admin only.</small>}
      <small className="muted">Last updated {dateTime(account.updated_at)}</small>

      {(history ?? []).length > 0 && (
        <div>
          <button type="button" className="linklike" onClick={() => setShowHistory((v) => !v)}>
            {showHistory ? 'Hide' : 'Show'} change history ({history!.length})
          </button>
          {showHistory && (
            <div className="table-wrap" style={{ marginTop: 8 }}>
              <table className="tbl">
                <thead><tr><th>When</th><th>What</th><th>Account</th><th>IFSC</th></tr></thead>
                <tbody>
                  {history!.map((h) => (
                    <tr key={h.id}>
                      <td className="nowrap">{dateTime(h.created_at)}</td>
                      <td>{h.action === 'create' ? 'Added' : 'Changed'}{h.changed_by ? ` by ${h.changed_by}` : ''}</td>
                      <td>{h.before ? `${masked(h.before.account_number_last4)} → ` : ''}{h.after ? masked(h.after.account_number_last4) : '—'}</td>
                      <td>{h.before && h.before.ifsc !== h.after?.ifsc ? `${h.before.ifsc} → ` : ''}{h.after?.ifsc ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function BankBadge({ has }: { has?: boolean }) {
  if (has === undefined) return <span className="muted">—</span>;
  return has ? <Badge tone="green" dot>Added</Badge> : <Badge tone="gold" dot>Missing</Badge>;
}
