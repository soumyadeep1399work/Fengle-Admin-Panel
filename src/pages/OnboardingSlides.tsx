import { useState, type FormEvent } from 'react';
import { api } from '../api/client';
import { useCan } from '../auth';
import ImageUpload from '../components/ImageUpload';
import { Confirm, Empty, Field, Modal, QueryState, errMsg } from '../components/ui';
import { useAction } from '../lib/hooks';
import { useQuery } from '@tanstack/react-query';

interface Slide {
  id: number;
  image_url: string;
  headline: string;
  body: string | null;
  sort_order: number;
  is_active: boolean;
}

const HEADLINE_MAX = 80;
const BODY_MAX = 200;
const PATH = '/admin/onboarding-slides';

export default function OnboardingSlides() {
  const can = useCan()('manage');
  const { data, isLoading, error } = useQuery({
    queryKey: [PATH],
    queryFn: () => api.get<{ slides: Slide[]; max_active: number }>(PATH),
  });
  const [editing, setEditing] = useState<Slide | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Slide | null>(null);

  const slides = data?.slides ?? [];
  const maxActive = data?.max_active ?? 5;
  const activeCount = slides.filter((s) => s.is_active).length;

  const toggle = useAction((s: Slide) => api.patch(`${PATH}/${s.id}`, { is_active: !s.is_active }), {
    success: 'Slide updated', invalidate: [PATH],
  });
  const move = useAction((vars: { index: number; by: -1 | 1 }) => {
    const ids = slides.map((s) => s.id);
    const j = vars.index + vars.by;
    [ids[vars.index], ids[j]] = [ids[j], ids[vars.index]];
    return api.post(`${PATH}/reorder`, { ids });
  }, { invalidate: [PATH] });
  const remove = useAction((s: Slide) => api.del(`${PATH}/${s.id}`), {
    success: 'Slide deleted', invalidate: [PATH], onDone: () => setDeleting(null),
  });

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Intro slides</h1>
          <p>The pictures customers see the first time they open the app, before they enter their phone number. Up to {maxActive} slides, shown in this order.</p>
        </div>
        {can && <button className="btn primary" onClick={() => setEditing('new')}>+ Add slide</button>}
      </div>

      <div className="alert info">
        {slides.length === 0
          ? 'No slides yet, so customers see the three built-in Fengle slides. Add your own and they replace those.'
          : `${activeCount} of ${maxActive} slides are showing. Changes reach the app within a minute or two. Hidden slides are kept but not shown.`}
      </div>

      <QueryState isLoading={isLoading} error={error}>
        {slides.length === 0 ? <Empty title="No slides yet" /> : (
          <div className="grid-3">
            {slides.map((s, i) => (
              <div key={s.id} className="card stack" style={{ gap: 0, overflow: 'hidden', opacity: s.is_active ? 1 : 0.6 }}>
                <div style={{ position: 'relative', aspectRatio: '9 / 14', background: 'var(--grey-tint)' }}>
                  <img src={s.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  <span className="badge" style={{ position: 'absolute', top: 10, left: 10 }}>Slide {i + 1}</span>
                  {!s.is_active && <span className="badge gold" style={{ position: 'absolute', top: 10, right: 10 }}>Hidden</span>}
                </div>
                <div className="card-pad stack" style={{ gap: 6 }}>
                  <div className="cell-main">{s.headline}</div>
                  <div className="small muted">{s.body || 'No text under the headline.'}</div>
                  {can && (
                    <div className="row" style={{ marginTop: 6 }}>
                      <button className="btn sm" disabled={i === 0 || move.isPending} onClick={() => move.mutate({ index: i, by: -1 })} aria-label="Move earlier">↑</button>
                      <button className="btn sm" disabled={i === slides.length - 1 || move.isPending} onClick={() => move.mutate({ index: i, by: 1 })} aria-label="Move later">↓</button>
                      <button className="btn sm ghost" onClick={() => setEditing(s)}>Edit</button>
                      <button className="btn sm ghost" disabled={toggle.isPending} onClick={() => toggle.mutate(s)}>{s.is_active ? 'Hide' : 'Show'}</button>
                      <button className="btn sm ghost" onClick={() => setDeleting(s)}>Delete</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </QueryState>

      {editing && <SlideForm slide={editing === 'new' ? undefined : editing} activeFull={activeCount >= maxActive} maxActive={maxActive} onClose={() => setEditing(null)} />}
      {deleting && (
        <Confirm title="Delete this slide?" danger confirmLabel="Delete" busy={remove.isPending} error={remove.error}
          message={<>“{deleting.headline}” will be removed for good. To keep it for later, use <b>Hide</b> instead.</>}
          onConfirm={() => remove.mutate(deleting)} onClose={() => setDeleting(null)} />
      )}
    </div>
  );
}

function SlideForm({ slide, activeFull, maxActive, onClose }: { slide?: Slide; activeFull: boolean; maxActive: number; onClose: () => void }) {
  const editing = !!slide;
  const [f, setF] = useState({ image_url: slide?.image_url ?? '', headline: slide?.headline ?? '', body: slide?.body ?? '' });
  const [err, setErr] = useState('');
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  // A new slide starts showing, so it can't be added while the maximum is already showing.
  const blocked = !editing && activeFull;

  const save = useAction(async () => {
    const body = { image_url: f.image_url, headline: f.headline.trim(), body: f.body.trim() };
    if (editing) await api.patch(`${PATH}/${slide.id}`, body);
    else await api.post(PATH, body);
  }, { success: editing ? 'Slide saved' : 'Slide added', invalidate: [PATH], onDone: onClose });

  function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (!f.image_url) return setErr('Upload a picture for this slide.');
    if (!f.headline.trim()) return setErr('Enter a headline.');
    save.mutate(undefined);
  }

  return (
    <Modal title={editing ? 'Edit slide' : 'Add slide'} onClose={onClose} footer={<>
      <button className="btn" type="button" onClick={onClose}>Cancel</button>
      <button className="btn primary" form="slide-form" disabled={save.isPending || blocked}>{save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add slide'}</button>
    </>}>
      <form id="slide-form" className="stack" onSubmit={submit}>
        {blocked && <div className="alert warn">{maxActive} slides are already showing. Hide or delete one first.</div>}
        <Field label="Picture" hint="Portrait works best, about 1080 × 1920 px. It fills the whole screen, with a dark fade at the bottom for the text.">
          <ImageUpload value={f.image_url} onChange={(u) => set('image_url', u)} banner />
        </Field>
        <Field label="Headline" hint={`${f.headline.length}/${HEADLINE_MAX}`}>
          <input className="input" value={f.headline} maxLength={HEADLINE_MAX} onChange={(e) => set('headline', e.target.value)} required />
        </Field>
        <Field label="Text under the headline (optional)" hint={`${f.body.length}/${BODY_MAX}`}>
          <textarea className="textarea" value={f.body} maxLength={BODY_MAX} onChange={(e) => set('body', e.target.value)} />
        </Field>
        {(err || save.error) && <div className="alert error">{err || errMsg(save.error)}</div>}
      </form>
    </Modal>
  );
}
