import { useState, type FormEvent } from 'react';
import { api } from '../api/client';
import type { AdminAccount } from '../api/types';
import { useAuth } from '../auth';
import { Confirm, Empty, Field, Modal, QueryState, errMsg } from '../components/ui';
import { useAction, useList } from '../lib/hooks';
import { ago, bool, date } from '../lib/format';
import { ROLES, roleLabel, type Role } from '../lib/permissions';

const MIN_PASSWORD = 10;
const ROLE_TONE: Record<string, string> = { super_admin: 'violet', ops: 'blue', support: 'gold' };

export default function Admins() {
  const { admin: me } = useAuth();
  const { data, isLoading, error } = useList<AdminAccount>('/admin/admins', 'admins');
  const [editing, setEditing] = useState<AdminAccount | 'new' | null>(null);
  const [toggling, setToggling] = useState<AdminAccount | null>(null);

  const toggle = useAction((a: AdminAccount) => api.patch(`/admin/admins/${a.id}`, { is_active: !bool(a.is_active) }), {
    success: 'Admin updated', invalidate: ['/admin/admins'], onDone: () => setToggling(null),
  });

  const rows = data?.rows ?? [];

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Admins</h1>
          <p>People who can sign in to this panel, and what each of them is allowed to do.</p>
        </div>
        <button className="btn primary" onClick={() => setEditing('new')}>+ Add admin</button>
      </div>

      <div className="grid-3">
        {ROLES.map((r) => (
          <div key={r.value} className="card card-pad stack" style={{ gap: 6 }}>
            <span className={`badge ${ROLE_TONE[r.value]}`} style={{ alignSelf: 'flex-start' }}>{r.label}</span>
            <div className="small muted">{r.summary}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <QueryState isLoading={isLoading} error={error}>
          {rows.length === 0 ? <Empty title="No admins" /> : (
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Admin</th><th>Role</th><th>Status</th><th>Last sign-in</th><th>Added</th><th /></tr></thead>
                <tbody>
                  {rows.map((a) => {
                    const isMe = a.id === me?.id;
                    return (
                      <tr key={a.id}>
                        <td>
                          <div className="cell-main">{a.name}{isMe && <span className="badge" style={{ marginLeft: 6 }}>You</span>}</div>
                          <div className="cell-sub">{a.email}</div>
                        </td>
                        <td><span className={`badge ${ROLE_TONE[a.role] ?? ''}`}>{roleLabel(a.role)}</span></td>
                        <td>{bool(a.is_active ?? true) ? <span className="badge green">Active</span> : <span className="badge red">Disabled</span>}</td>
                        <td className="small">{a.last_login_at ? ago(a.last_login_at) : <span className="muted">Never</span>}</td>
                        <td className="small muted nowrap">{date(a.created_at)}</td>
                        <td className="right nowrap">
                          <button className="btn sm ghost" onClick={() => setEditing(a)}>Edit</button>
                          {!isMe && <button className="btn sm ghost" onClick={() => setToggling(a)}>{bool(a.is_active ?? true) ? 'Disable' : 'Enable'}</button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </QueryState>
      </div>

      {editing && <AdminForm account={editing === 'new' ? undefined : editing} isMe={editing !== 'new' && editing.id === me?.id} onClose={() => setEditing(null)} />}
      {toggling && (
        <Confirm title={`${bool(toggling.is_active ?? true) ? 'Disable' : 'Enable'} ${toggling.name}?`} danger={bool(toggling.is_active ?? true)}
          confirmLabel={bool(toggling.is_active ?? true) ? 'Disable' : 'Enable'}
          message={bool(toggling.is_active ?? true)
            ? 'They are signed out and can no longer sign in. Their past actions stay on record, and you can enable them again later.'
            : 'They can sign in again with their existing password and role.'}
          busy={toggle.isPending} error={toggle.error} onConfirm={() => toggle.mutate(toggling)} onClose={() => setToggling(null)} />
      )}
    </div>
  );
}

function RolePicker({ value, onChange, disabled }: { value: Role; onChange: (r: Role) => void; disabled?: boolean }) {
  return (
    <div className="stack" style={{ gap: 6 }}>
      {ROLES.map((r) => (
        <label key={r.value} className="check" style={{ alignItems: 'flex-start', opacity: disabled ? 0.6 : 1 }}>
          <input type="radio" name="role" checked={value === r.value} disabled={disabled} onChange={() => onChange(r.value)} style={{ marginTop: 3 }} />
          <span>{r.label} <span className="muted" style={{ fontWeight: 500 }}>— {r.summary}</span></span>
        </label>
      ))}
    </div>
  );
}

function AdminForm({ account, isMe, onClose }: { account?: AdminAccount; isMe: boolean; onClose: () => void }) {
  const editing = !!account;
  const [f, setF] = useState({
    name: account?.name ?? '',
    email: account?.email ?? '',
    role: (account?.role ?? 'support') as Role,
    password: '',
  });
  const [err, setErr] = useState('');
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const save = useAction(async () => {
    if (!editing) {
      await api.post('/admin/admins', { name: f.name.trim(), email: f.email.trim().toLowerCase(), password: f.password, role: f.role });
      return;
    }
    // Send only what changed: the backend refuses a role change on your own account.
    const body: Record<string, unknown> = {};
    if (f.name.trim() !== account.name) body.name = f.name.trim();
    if (f.role !== account.role) body.role = f.role;
    if (f.password) body.password = f.password;
    if (Object.keys(body).length > 0) await api.patch(`/admin/admins/${account.id}`, body);
  }, { success: editing ? 'Admin saved' : 'Admin added', invalidate: ['/admin/admins'], onDone: onClose });

  function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (!f.name.trim()) return setErr('Enter their name.');
    if (!editing && !/^\S+@\S+\.\S+$/.test(f.email.trim())) return setErr('Enter a valid email address.');
    if ((!editing || f.password) && f.password.length < MIN_PASSWORD) return setErr(`The password must be at least ${MIN_PASSWORD} characters.`);
    save.mutate(undefined);
  }

  return (
    <Modal title={editing ? `Edit ${account.name}` : 'Add admin'} onClose={onClose} footer={<>
      <button className="btn" type="button" onClick={onClose}>Cancel</button>
      <button className="btn primary" form="admin-form" disabled={save.isPending}>{save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add admin'}</button>
    </>}>
      <form id="admin-form" className="stack" onSubmit={submit}>
        <Field label="Name"><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} required autoFocus={!editing} /></Field>
        <Field label="Email" hint={editing ? 'The sign-in email can’t be changed.' : 'They sign in with this.'}>
          <input className="input" type="email" autoComplete="off" value={f.email} onChange={(e) => set('email', e.target.value)} disabled={editing} required />
        </Field>
        <Field label="Role" hint={isMe ? 'You can’t change your own role.' : undefined}>
          <RolePicker value={f.role} onChange={(r) => set('role', r)} disabled={isMe} />
        </Field>
        <Field label={editing ? 'Reset password (optional)' : 'Temporary password'}
          hint={editing ? 'Leave blank to keep their current password.' : `At least ${MIN_PASSWORD} characters. Share it privately and ask them to change it after signing in.`}>
          <input className="input" type="text" autoComplete="off" spellCheck={false} value={f.password} onChange={(e) => set('password', e.target.value)} />
        </Field>
        {(err || save.error) && <div className="alert error">{err || errMsg(save.error)}</div>}
      </form>
    </Modal>
  );
}

/** Any admin can change their own password (opened from the sidebar). */
export function ChangePassword({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [err, setErr] = useState('');
  const save = useAction(() => api.post('/admin/me/password', { current_password: current, new_password: next }), {
    success: 'Password changed', onDone: onClose,
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (next.length < MIN_PASSWORD) return setErr(`The new password must be at least ${MIN_PASSWORD} characters.`);
    if (next !== again) return setErr('The two new passwords don’t match.');
    if (next === current) return setErr('Choose a password different from the current one.');
    save.mutate(undefined);
  }

  return (
    <Modal title="Change my password" onClose={onClose} footer={<>
      <button className="btn" type="button" onClick={onClose}>Cancel</button>
      <button className="btn primary" form="pw-form" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Change password'}</button>
    </>}>
      <form id="pw-form" className="stack" onSubmit={submit}>
        <Field label="Current password"><input className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoFocus /></Field>
        <Field label="New password" hint={`At least ${MIN_PASSWORD} characters.`}><input className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required /></Field>
        <Field label="New password again"><input className="input" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required /></Field>
        {(err || save.error) && <div className="alert error">{err || errMsg(save.error)}</div>}
      </form>
    </Modal>
  );
}
