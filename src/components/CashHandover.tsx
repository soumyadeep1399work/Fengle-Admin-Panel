import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../api/client';
import type { Rider } from '../api/types';
import { useAction } from '../lib/hooks';
import { money } from '../lib/format';
import { Field, Modal, errMsg } from './ui';

const nowLocal = () => {
  const d = new Date();
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Records COD cash a rider has handed to Fengle; it reduces what they owe. */
export default function CashHandover({ rider, onClose }: { rider: Rider; onClose: () => void }) {
  const owed = Number(rider.cod_outstanding ?? 0);
  const [amount, setAmount] = useState(owed > 0 ? String(owed) : '');
  const [receivedAt, setReceivedAt] = useState(nowLocal());
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState('');

  const save = useAction(() => api.post(`/admin/riders/${rider.id}/cash-handovers`, {
    amount: Number(amount),
    received_at: new Date(receivedAt).toISOString(),
    reference: reference.trim() || undefined,
    notes: notes.trim() || undefined,
  }), { success: `${money(Number(amount))} recorded`, invalidate: ['/admin/riders', '/admin/cash-handovers', '/admin/cod'], onDone: onClose });

  function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    const a = Number(amount);
    if (!(a > 0)) return setErr('Enter the amount received.');
    if (owed > 0 && a > owed) return setErr(`That's more than the ${money(owed)} this rider owes.`);
    if (new Date(receivedAt).getTime() > Date.now() + 60_000) return setErr('The received time can’t be in the future.');
    save.mutate(undefined);
  }

  const serverOutstanding = save.error instanceof ApiError ? (save.error.body as { outstanding?: number } | null)?.outstanding : undefined;

  return (
    <Modal title={`Cash from ${rider.name || 'rider'}`} onClose={onClose} footer={<>
      <button className="btn" type="button" onClick={onClose}>Cancel</button>
      <button className="btn primary" form="handover-form" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Record cash received'}</button>
    </>}>
      <form id="handover-form" className="stack" onSubmit={submit}>
        <div className="alert info">
          {owed > 0 ? <>This rider currently owes <b>{money(owed)}</b> in COD cash.</> : <>This rider doesn't owe any COD cash right now.</>}
        </div>
        <div className="grid-2">
          <Field label="Amount received (₹)"><input className="input" type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></Field>
          <Field label="Received at"><input className="input" type="datetime-local" value={receivedAt} max={nowLocal()} onChange={(e) => setReceivedAt(e.target.value)} /></Field>
        </div>
        <Field label="Reference (optional)" hint="e.g. UPI transaction ID or receipt number. Must be unique for this rider.">
          <input className="input" value={reference} maxLength={100} onChange={(e) => setReference(e.target.value)} />
        </Field>
        <Field label="Notes (optional)"><input className="input" value={notes} maxLength={255} onChange={(e) => setNotes(e.target.value)} /></Field>
        {(err || save.error) && (
          <div className="alert error">
            {err || errMsg(save.error)}
            {serverOutstanding !== undefined && <> They owe {money(serverOutstanding)}.</>}
          </div>
        )}
      </form>
    </Modal>
  );
}
