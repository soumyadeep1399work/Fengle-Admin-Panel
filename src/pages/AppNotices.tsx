import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useCan } from '../auth';
import ImageUpload from '../components/ImageUpload';
import { Confirm, Empty, Field, Modal, QueryState, errMsg } from '../components/ui';
import { useAction } from '../lib/hooks';

type State = 'live' | 'scheduled' | 'ended' | 'hidden';
interface Notice {
  id: number;
  title: string;
  body: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_target: 'none' | 'coupons';
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  state: State;
}

const PATH = '/admin/app-notices';
const TITLE_MAX = 80;
const BODY_MAX = 500;
const CTA_MAX = 30;
const STATE: Record<State, { label: string; tone: string }> = {
  live: { label: 'Showing now', tone: 'green' },
  scheduled: { label: 'Scheduled', tone: 'blue' },
  ended: { label: 'Ended', tone: '' },
  hidden: { label: 'Hidden', tone: 'gold' },
};

// <input type="datetime-local"> works in the browser's local time; the server stores real instants (ISO).
const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : null);

export default function AppNotices() {
  const can = useCan()('manage');
  const { data, isLoading, error } = useQuery({ queryKey: [PATH], queryFn: () => api.get<{ notices: Notice[] }>(PATH) });
  const [editing, setEditing] = useState<Notice | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Notice | null>(null);
  const notices = data?.notices ?? [];
  const liveNow = notices.find((n) => n.state === 'live');

  const toggle = useAction((n: Notice) => api.patch(`${PATH}/${n.id}`, { is_active: !n.is_active }), { success: 'Notice updated', invalidate: [PATH] });
  const remove = useAction((n: Notice) => api.del(`${PATH}/${n.id}`), { success: 'Notice deleted', invalidate: [PATH], onDone: () => setDeleting(null) });

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Popup notice</h1>
          <p>An announcement that pops up for customers right after they log in: a new offer, a holiday closure, anything. When no notice is showing, customers see no popup at all.</p>
        </div>
        {can && <button className="btn primary" onClick={() => setEditing('new')}>+ New notice</button>}
      </div>

      <div className="alert info">
        {liveNow
          ? <>Customers currently see “<b>{liveNow.title}</b>”. Each customer sees it once. If you edit its wording, everyone sees it again. If several notices are live, only the newest shows.</>
          : 'No notice is showing, so customers see no popup.'}
      </div>

      <div className="card">
        <QueryState isLoading={isLoading} error={error}>
          {notices.length === 0 ? <Empty title="No notices yet" /> : (
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Notice</th><th>Status</th><th>When</th><th /></tr></thead>
                <tbody>
                  {notices.map((n) => (
                    <tr key={n.id}>
                      <td>
                        <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                          {n.image_url && <img className="thumb" src={n.image_url} alt="" />}
                          <div>
                            <div className="cell-main">{n.title}</div>
                            <div className="cell-sub">{n.body || 'No message'}{n.cta_target !== 'none' && n.cta_label ? ` · Button: ${n.cta_label}` : ''}</div>
                          </div>
                        </div>
                      </td>
                      <td><span className={`badge ${STATE[n.state].tone}`}>{STATE[n.state].label}</span></td>
                      <td className="small muted">{n.starts_at || n.ends_at ? `${when(n.starts_at) ?? 'Now'} → ${when(n.ends_at) ?? 'No end'}` : 'Until you hide it'}</td>
                      <td className="right nowrap">
                        {can && <>
                          <button className="btn sm ghost" onClick={() => setEditing(n)}>Edit</button>
                          <button className="btn sm ghost" disabled={toggle.isPending} onClick={() => toggle.mutate(n)}>{n.is_active ? 'Hide' : 'Show'}</button>
                          <button className="btn sm ghost" onClick={() => setDeleting(n)}>Delete</button>
                        </>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </QueryState>
      </div>

      {editing && <NoticeForm notice={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <Confirm title="Delete this notice?" danger confirmLabel="Delete" busy={remove.isPending} error={remove.error}
          message={<>“{deleting.title}” will be removed for good. To stop showing it but keep it, use <b>Hide</b> instead.</>}
          onConfirm={() => remove.mutate(deleting)} onClose={() => setDeleting(null)} />
      )}
    </div>
  );
}

function NoticeForm({ notice, onClose }: { notice?: Notice; onClose: () => void }) {
  const editing = !!notice;
  const [f, setF] = useState({
    title: notice?.title ?? '',
    body: notice?.body ?? '',
    image_url: notice?.image_url ?? '',
    cta_target: (notice?.cta_target ?? 'none') as 'none' | 'coupons',
    cta_label: notice?.cta_label ?? '',
    starts_at: toLocalInput(notice?.starts_at ?? null),
    ends_at: toLocalInput(notice?.ends_at ?? null),
  });
  const [err, setErr] = useState('');
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const save = useAction(async () => {
    const body = {
      title: f.title.trim(),
      body: f.body.trim(),
      image_url: f.image_url,
      cta_target: f.cta_target,
      cta_label: f.cta_target === 'none' ? '' : f.cta_label.trim(),
      starts_at: fromLocalInput(f.starts_at),
      ends_at: fromLocalInput(f.ends_at),
    };
    if (editing) await api.patch(`${PATH}/${notice.id}`, body);
    else await api.post(PATH, body);
  }, { success: editing ? 'Notice saved' : 'Notice posted', invalidate: [PATH], onDone: onClose });

  function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (!f.title.trim()) return setErr('Enter a title.');
    if (f.cta_target !== 'none' && !f.cta_label.trim()) return setErr('Enter the button text, or choose “No button”.');
    if (f.starts_at && f.ends_at && new Date(f.ends_at) <= new Date(f.starts_at)) return setErr('The end time must be after the start time.');
    save.mutate(undefined);
  }

  return (
    <Modal wide title={editing ? 'Edit notice' : 'New notice'} onClose={onClose} footer={<>
      <button className="btn" type="button" onClick={onClose}>Cancel</button>
      <button className="btn primary" form="notice-form" disabled={save.isPending}>{save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Post notice'}</button>
    </>}>
      <form id="notice-form" className="stack" onSubmit={submit}>
        <Field label="Title" hint={`${f.title.length}/${TITLE_MAX}`}>
          <input className="input" value={f.title} maxLength={TITLE_MAX} onChange={(e) => set('title', e.target.value)} autoFocus required />
        </Field>
        <Field label="Message (optional)" hint={`${f.body.length}/${BODY_MAX}`}>
          <textarea className="textarea" value={f.body} maxLength={BODY_MAX} onChange={(e) => set('body', e.target.value)} />
        </Field>
        <Field label="Picture (optional)" hint="A banner or offer graphic. Wide or square both work.">
          <ImageUpload value={f.image_url} onChange={(u) => set('image_url', u)} banner />
        </Field>
        <Field label="Button">
          <select className="input" value={f.cta_target} onChange={(e) => set('cta_target', e.target.value as 'none' | 'coupons')}>
            <option value="none">No button (just a “Got it” to close)</option>
            <option value="coupons">Open the Coupons screen</option>
          </select>
        </Field>
        {f.cta_target !== 'none' && (
          <Field label="Button text" hint={`${f.cta_label.length}/${CTA_MAX}, for example “See offers”`}>
            <input className="input" value={f.cta_label} maxLength={CTA_MAX} onChange={(e) => set('cta_label', e.target.value)} />
          </Field>
        )}
        <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
          <Field label="Show from (optional)" hint="Leave empty to show right away.">
            <input className="input" type="datetime-local" value={f.starts_at} onChange={(e) => set('starts_at', e.target.value)} />
          </Field>
          <Field label="Show until (optional)" hint="Leave empty to keep showing until you hide it.">
            <input className="input" type="datetime-local" value={f.ends_at} onChange={(e) => set('ends_at', e.target.value)} />
          </Field>
        </div>
        {(err || save.error) && <div className="alert error">{err || errMsg(save.error)}</div>}
      </form>
    </Modal>
  );
}
