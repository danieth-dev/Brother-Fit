/* Gráfico de línea en SVG puro. points = [{ label, value }]. */
import { esc, fmtNum } from './dom.js';

export function lineChart(points, { height = 190, desc = 'Gráfico de evolución' } = {}) {
  if (!points.length) return '<p class="muted">Aún no hay datos para graficar.</p>';

  const W = 340, H = height, L = 40, R = 12, T = 14, B = 26;
  const vals = points.map((p) => p.value);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.15;
  const lo = min - pad, hi = max + pad;

  const x = (i) => (points.length === 1 ? L + (W - L - R) / 2 : L + (i * (W - L - R)) / (points.length - 1));
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);

  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const last = points.length - 1;
  const area = `${line} L${x(last).toFixed(1)} ${H - B} L${x(0).toFixed(1)} ${H - B} Z`;

  const ticks = [max, (max + min) / 2, min].map((v) => {
    const yy = y(v).toFixed(1);
    return `<line class="grid" x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}"/>` +
           `<text x="${L - 6}" y="${(+yy + 3).toFixed(1)}" text-anchor="end">${fmtNum(Math.round(v * 10) / 10)}</text>`;
  }).join('');

  const dots = points.length <= 30
    ? points.map((p, i) => `<circle class="pt" cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="3.5"/>`).join('')
    : `<circle class="pt" cx="${x(last).toFixed(1)}" cy="${y(points[last].value).toFixed(1)}" r="4"/>`;

  const xl = points.length > 1
    ? `<text x="${L}" y="${H - 8}">${esc(points[0].label)}</text><text x="${W - R}" y="${H - 8}" text-anchor="end">${esc(points[last].label)}</text>`
    : `<text x="${x(0)}" y="${H - 8}" text-anchor="middle">${esc(points[0].label)}</text>`;

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(desc)}">
    ${ticks}<path class="area" d="${area}"/><path class="line" d="${line}"/>${dots}${xl}</svg>`;
}
