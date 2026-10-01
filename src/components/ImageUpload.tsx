import { useRef, useState } from 'react';
import { api } from '../api/client';
import { errMsg } from './ui';

/** Uploads to POST /uploads/image (S3 on the live server) and hands back the public URL. */
export default function ImageUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function pick(file: File | undefined) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setErr('Image must be under 5 MB.');
    setBusy(true);
    setErr('');
    try {
      const fd = new FormData();
      fd.append('image', file);
      const { url } = await api.post<{ url: string }>('/uploads/image', fd);
      onChange(url);
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
      {value ? <img className="thumb lg" src={value} alt="" /> : <div className="thumb lg" />}
      <div className="stack" style={{ gap: 6, flex: 1 }}>
        <div className="row">
          <button type="button" className="btn sm" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Uploading…' : value ? 'Replace image' : 'Upload image'}</button>
          {value && <button type="button" className="btn sm ghost" onClick={() => onChange('')}>Remove</button>}
        </div>
        <small className="muted">JPEG, PNG or WebP, under 5 MB.</small>
        {err && <small style={{ color: 'var(--red)' }}>{err}</small>}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}
