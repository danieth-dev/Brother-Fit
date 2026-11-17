/* Chip de subida o bajada entre dos valores, compartido por las tablas de Progreso. */

const FLAT_PCT = 0.5;

const fmtPct = (pct) => Math.abs(pct).toFixed(1).replace('.', ',').replace(/,0$/, '');

export function trendBadge(curr, prev) {
  if (!prev || prev === 0) return '<span class="trend-badge trend-badge--neutral">—</span>';
  const pct = ((curr - prev) / prev) * 100;
  if (Math.abs(pct) < FLAT_PCT) return '<span class="trend-badge trend-badge--neutral">—</span>';
  return pct > 0
    ? `<span class="trend-badge trend-badge--up">↑ ${fmtPct(pct)}%</span>`
    : `<span class="trend-badge trend-badge--down">↓ ${fmtPct(pct)}%</span>`;
}
