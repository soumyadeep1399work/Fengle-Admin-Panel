import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { ApiError } from '../api/client';
import { STATUS_LABEL, STATUS_TONE } from '../lib/format';

export function Badge({ tone = '', children, dot }: { tone?: string; children: ReactNode; dot?: boolean }) {
  return <span className={`badge ${tone}`}>{dot && <span className="dot" />}{children}</span>;
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="muted">—</span>;
  return <Badge tone={STATUS_TONE[status] ?? ''} dot>{STATUS_LABEL[status] ?? status}</Badge>;
}

export function Spinner() { return <div className="spinner" aria-label="Loading" />; }

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="empty"><b>{title}</b>{children}</div>;
}

/** Error panel; a 404 from the Express fallback means the backend route isn't live yet. */
export function ErrorBox({ error }: { error: unknown }) {
  if (error instanceof ApiError && error.notBuilt) {
    return (
      <div className="alert warn" style={{ margin: 14 }}>
        This screen needs a backend endpoint that isn't deployed yet. It will start working once the backend update is live.
      </div>
    );
  }
  const msg = error instanceof Error ? error.message : 'Something went wrong';
  return <div className="alert error" style={{ margin: 14 }}>{msg}</div>;
}

export function QueryState({ isLoading, error, children }: { isLoading: boolean; error: unknown; children: ReactNode }) {
  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  return <>{children}</>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function Modal({ title, onClose, children, footer, wide }: {
  title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay center" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><h2>{title}</h2><button className="x-btn" onClick={onClose} aria-label="Close">×</button></div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Pager({ page, limit, total, count, onPage }: {
  page: number; limit: number; total?: number; count: number; onPage: (p: number) => void;
}) {
  const from = count === 0 ? 0 : (page - 1) * limit + 1;
  const to = (page - 1) * limit + count;
  const hasNext = total !== undefined ? to < total : count === limit;
  if (page === 1 && !hasNext) {
    return <div className="pager"><span className="muted small">{count} {count === 1 ? 'row' : 'rows'}</span></div>;
  }
  return (
    <div className="pager">
      <span className="muted small">{from}–{to}{total !== undefined ? ` of ${total}` : ''}</span>
      <div className="row">
        <button className="btn sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <button className="btn sm" disabled={!hasNext} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: {
  value: T; onChange: (v: T) => void; tabs: { value: T; label: string; count?: number }[];
}) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value}
          className={`tab ${value === t.value ? 'active' : ''}`} onClick={() => onChange(t.value)}>
          {t.label}{t.count !== undefined && <span className="count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Confirmation dialog with optional required reason text. */
export function Confirm({ title, message, confirmLabel = 'Confirm', danger, reasonLabel, busy, error, onConfirm, onClose }: {
  title: string; message: ReactNode; confirmLabel?: string; danger?: boolean; reasonLabel?: string;
  busy?: boolean; error?: unknown; onConfirm: (reason: string) => void; onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <Modal title={title} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Back</button>
      <button className={`btn ${danger ? 'danger solid' : 'primary'}`} disabled={busy || (!!reasonLabel && !reason.trim())}
        onClick={() => onConfirm(reason.trim())}>{busy ? 'Working…' : confirmLabel}</button>
    </>}>
      <div>{message}</div>
      {reasonLabel && (
        <Field label={reasonLabel}>
          <textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        </Field>
      )}
      {!!error && <div className="alert error">{error instanceof Error ? error.message : 'Failed'}</div>}
    </Modal>
  );
}

/* ---------- Toasts ---------- */
interface Toast { id: number; text: string; error?: boolean }
const ToastCtx = createContext<(text: string, error?: boolean) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, error?: boolean) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, error }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast ${t.error ? 'error' : ''}`}>{t.text}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

export function errMsg(e: unknown): string {
  if (e instanceof ApiError && e.notBuilt) return 'This action needs a backend update that is not live yet.';
  return e instanceof Error ? e.message : 'Something went wrong';
}

/** Debounces a value (search boxes). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
