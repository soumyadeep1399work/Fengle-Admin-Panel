import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, download } from '../api/client';
import type { CashHandover, CodReconciliation, Rider } from '../api/types';
import { Empty, Pager, QueryState, Tabs, errMsg, useToast } from '../components/ui';
import { date, dateTime, money, num } from '../lib/format';

const LIMIT = 50;
const FLAG: Record<string, { label: string; tone: string }> = {
  short: { label: 'Short', tone: 'red' },
  excess: { label: 'Excess', tone: 'gold' },
  unexpected_collection: { label: 'Collected on cancelled', tone: 'red' },
};

function todayStr(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const tone = (v: unknown) => (Number(v) < 0 ? 'var(--red)' : Number(v) > 0 ? 'var(--gold-ink)' : undefined);

export default function CodCash() {
  const toast = useToast();
  const [tab, setTab] = useState<'reconciliation' | 'handovers'>('reconciliation');
  const [from, setFrom] = useState(todayStr(-29));
  const [to, setTo] = useState(todayStr());
  const [riderId, setRiderId] = useState('');
  const [flagged, setFlagged] = useState(false);
  const [page, setPage] = useState(1);
  const filters = { from: from || undefined, to: to || undefined, rider_id: riderId || undefined };

  const riders = useQuery({
    queryKey: ['/admin/riders', 'cod-picker'],
    queryFn: () => api.get<{ riders: Rider[] }>('/admin/riders', { limit: 500 }),
    staleTime: 60_000,
  });
  const recon = useQuery({
    queryKey: ['/admin/cod/reconciliation', filters, flagged, page],
    queryFn: () => api.get<CodReconciliation>('/admin/cod/reconciliation', { ...filters, flagged: flagged || undefined, page, limit: LIMIT }),
    enabled: tab === 'reconciliation',
  });
  const handoverQ = useQuery({
    queryKey: ['/admin/cash-handovers', filters, page],
    queryFn: () => api.get<{ handovers: CashHandover[]; total: number; total_amount: number }>('/admin/cash-handovers', { ...filters, page, limit: LIMIT }),
    enabled: tab === 'handovers',
  });
  const handovers = { ...handoverQ, data: handoverQ.data ? { rows: handoverQ.data.handovers, total: handoverQ.data.total } : undefined };
  const handoverTotal = handoverQ.data?.total_amount;

  async function exportCsv(view: 'orders' | 'riders') {
    try {
      await download('/admin/cod/reconciliation.csv', { ...filters, view, flagged: flagged || undefined }, `fengle-cod-${view}-${from || 'all'}-to-${to || 'now'}.csv`);
    } catch (e) {
      toast(errMsg(e), true);
    }
  }

  const t = recon.data?.totals ?? {};

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>COD cash</h1>
          <p>Cash riders collected on delivery, what they handed to Fengle, and anything that doesn't add up.</p>
        </div>
      </div>

      <div className="card">
        <Tabs value={tab} onChange={(v) => { setTab(v); setPage(1); }} tabs={[
          { value: 'reconciliation', label: 'Reconciliation' },
          { value: 'handovers', label: 'Cash handovers' },
        ]} />
        <div className="toolbar">
          <label className="row small muted">From <input className="input" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} /></label>
          <label className="row small muted">To <input className="input" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} /></label>
          <select className="select" value={riderId} onChange={(e) => { setRiderId(e.target.value); setPage(1); }} aria-label="Rider">
            <option value="">All riders</option>
            {(riders.data?.riders ?? []).map((r) => <option key={r.id} value={r.id}>{r.name || 'Unnamed'} · {r.phone}</option>)}
          </select>
          {tab === 'reconciliation' && (
            <label className="check small"><input type="checkbox" checked={flagged} onChange={(e) => { setFlagged(e.target.checked); setPage(1); }} /> Only problems</label>
          )}
          {(from || to) && <button className="btn ghost sm" onClick={() => { setFrom(''); setTo(''); setPage(1); }}>All time</button>}
          {tab === 'reconciliation' && (
            <div className="row" style={{ marginLeft: 'auto' }}>
              <button className="btn sm" onClick={() => exportCsv('riders')}>Export riders CSV</button>
              <button className="btn sm" onClick={() => exportCsv('orders')}>Export orders CSV</button>
            </div>
          )}
        </div>

        {tab === 'reconciliation' ? (
          <QueryState isLoading={recon.isLoading} error={recon.error}>
            {recon.data && (
              <div className="stack" style={{ padding: 14 }}>
                <div className="grid-4">
                  <div className="card stat"><div className="label">Expected</div><div className="value">{money(t.expected)}</div><div className="sub">{num(t.delivered_cod_orders ?? 0)} COD deliveries</div></div>
                  <div className="card stat"><div className="label">Collected</div><div className="value">{money(t.collected)}</div><div className="sub">As confirmed by riders</div></div>
                  <div className="card stat"><div className="label">Handed over</div><div className="value">{money(t.handed_over)}</div><div className="sub">In this period</div></div>
                  <div className={`card stat ${Number(t.outstanding) > 0 ? '' : 'accent'}`}><div className="label">Riders owe now</div><div className="value" style={{ color: Number(t.outstanding) > 0 ? 'var(--red)' : undefined }}>{money(t.outstanding)}</div><div className="sub">{Number(t.flagged_orders ?? 0) > 0 ? `${num(t.flagged_orders)} orders don't match` : 'All orders match'}</div></div>
                </div>

                <div className="card">
                  <div className="card-head"><h3>By rider</h3><span className="muted small">"Owes now" is today's balance, not just this period</span></div>
                  {recon.data.riders.length === 0 ? <Empty title="No COD activity in this period" /> : (
                    <div className="table-wrap">
                      <table className="tbl">
                        <thead><tr><th>Rider</th><th className="num">COD orders</th><th className="num">Expected</th><th className="num">Collected</th><th className="num">Difference</th><th className="num">Handed over</th><th className="num">Owes now</th></tr></thead>
                        <tbody>
                          {recon.data.riders.map((r) => (
                            <tr key={r.rider_id}>
                              <td><Link className="cell-main" to={`/riders/${r.rider_id}`}>{r.rider_name || `Rider #${r.rider_id}`}</Link><div className="cell-sub">{r.rider_phone}</div></td>
                              <td className="num">{num(r.delivered_cod_orders)}{r.flagged_orders > 0 && <div className="cell-sub" style={{ color: 'var(--red)' }}>{r.flagged_orders} flagged</div>}</td>
                              <td className="num">{money(r.expected)}</td>
                              <td className="num">{money(r.collected)}</td>
                              <td className="num" style={{ color: tone(r.difference), fontWeight: 700 }}>{Number(r.difference) === 0 ? '—' : money(r.difference)}</td>
                              <td className="num">{money(r.handed_over)}</td>
                              <td className="num cell-main" style={{ color: Number(r.outstanding) > 0 ? 'var(--red)' : undefined }}>{money(r.outstanding)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="card">
                  <div className="card-head"><h3>By order</h3><span className="muted small">Difference = collected − expected</span></div>
                  {recon.data.orders.length === 0 ? <Empty title={flagged ? 'No problems found' : 'No COD orders in this period'} /> : (
                    <div className="table-wrap">
                      <table className="tbl">
                        <thead><tr><th>Order</th><th>Status</th><th>Rider</th><th className="num">Expected</th><th className="num">Collected</th><th className="num">Difference</th><th>Check</th></tr></thead>
                        <tbody>
                          {recon.data.orders.map((o) => (
                            <tr key={o.order_id}>
                              <td><Link className="cell-main" to={`/orders/${o.order_id}`}>#{o.order_id}</Link><div className="cell-sub">{dateTime(o.closed_at)}</div></td>
                              <td><span className={`badge ${o.status === 'delivered' ? 'green' : 'red'}`}>{o.status === 'delivered' ? 'Delivered' : 'Cancelled'}</span>{Number(o.refunded) > 0 && <div className="cell-sub">Refunded {money(o.refunded)}</div>}</td>
                              <td className="small">{o.rider_id ? <Link to={`/riders/${o.rider_id}`}>{o.rider_name || `#${o.rider_id}`}</Link> : '—'}</td>
                              <td className="num">{money(o.expected)}</td>
                              <td className="num">{money(o.collected)}</td>
                              <td className="num" style={{ color: tone(o.difference), fontWeight: 700 }}>{Number(o.difference) === 0 ? '—' : money(o.difference)}</td>
                              <td>{o.flag ? <span className={`badge ${FLAG[o.flag]?.tone ?? ''}`}>{FLAG[o.flag]?.label ?? o.flag}</span> : <span className="badge green">OK</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <Pager page={page} limit={LIMIT} total={recon.data.total_orders} count={recon.data.orders.length} onPage={setPage} />
                </div>
              </div>
            )}
          </QueryState>
        ) : (
          <QueryState isLoading={handovers.isLoading} error={handovers.error}>
            {(handovers.data?.rows.length ?? 0) === 0 ? <Empty title="No cash handovers in this period">Record one from a rider's page.</Empty> : (
              <>
                {handoverTotal !== undefined && <div className="pager"><span className="small">Total received: <b>{money(handoverTotal)}</b></span></div>}
                <div className="table-wrap">
                  <table className="tbl">
                    <thead><tr><th>Received</th><th>Rider</th><th className="num">Amount</th><th>Reference</th><th>Notes</th><th>Recorded by</th><th className="num">Rider balance after</th></tr></thead>
                    <tbody>
                      {handovers.data!.rows.map((h) => (
                        <tr key={h.id}>
                          <td className="nowrap">{dateTime(h.received_at)}<div className="cell-sub">{date(h.created_at)}</div></td>
                          <td><Link to={`/riders/${h.rider_id}`}>{h.rider_name || `Rider #${h.rider_id}`}</Link></td>
                          <td className="num cell-main">{money(h.amount)}</td>
                          <td className="mono small">{h.reference || '—'}</td>
                          <td className="small muted">{h.notes || '—'}</td>
                          <td className="small">{h.received_by_admin_name || (h.received_by_admin_id ? `Admin #${h.received_by_admin_id}` : '—')}</td>
                          <td className="num">{money(h.balance_after)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <Pager page={page} limit={LIMIT} total={handovers.data?.total} count={handovers.data?.rows.length ?? 0} onPage={setPage} />
          </QueryState>
        )}
      </div>
    </div>
  );
}
