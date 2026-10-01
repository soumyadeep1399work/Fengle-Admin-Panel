import { useState } from 'react';

/** Minimal single-series column chart (7-day orders / GMV). */
export default function BarChart({ data, format }: {
  data: { label: string; value: number; title: string }[];
  format: (n: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 560, H = 190, padL = 8, padB = 26, padT = 22;
  const max = Math.max(1, ...data.map((d) => d.value));
  const slot = (W - padL * 2) / Math.max(1, data.length);
  const bw = Math.min(46, slot * 0.58);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="7-day chart">
      <line x1={padL} x2={W - padL} y1={H - padB} y2={H - padB} stroke="var(--border-strong)" />
      {data.map((d, i) => {
        const h = ((H - padB - padT) * d.value) / max;
        const x = padL + slot * i + (slot - bw) / 2;
        const y = H - padB - h;
        const on = hover === i;
        return (
          <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <rect x={padL + slot * i} y={padT} width={slot} height={H - padT - padB} fill="transparent" />
            <rect x={x} y={y} width={bw} height={Math.max(h, d.value > 0 ? 2 : 0)} rx={5}
              fill={on ? 'var(--primary-mid)' : 'var(--primary)'} opacity={hover === null || on ? 1 : 0.55} />
            {(on || data.length <= 7) && (
              <text x={x + bw / 2} y={y - 6} textAnchor="middle" fontSize="11" fontWeight={700} fill="var(--ink)">{format(d.value)}</text>
            )}
            <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">{d.label}</text>
            <title>{d.title}</title>
          </g>
        );
      })}
    </svg>
  );
}
