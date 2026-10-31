/* Gráfico de línea en SVG puro con sombreado de área y valores sobre los puntos. points = [{ label, value }]. */
import { esc, fmtNum } from './dom.js';

export function lineChart(points, { height = 190, desc = 'Gráfico de evolución', unit = '', showValues = true } = {}) {
  if (!points.length) return '<p class="muted" style="text-align:center;padding:24px 0">Aún no hay datos para graficar.</p>';

  const W = 460, H = height, L = 46, R = 22, T = 26, B = 28;
  const vals = points.map((p) => p.value);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.18;
  const lo = min - pad, hi = max + pad;

  const x = (i) => (points.length === 1 ? L + (W - L - R) / 2 : L + (i * (W - L - R)) / (points.length - 1));
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);

  if (points.length === 1) {
    const cx = x(0).toFixed(1);
    const cy = y(points[0].value).toFixed(1);
    const valStr = `${fmtNum(points[0].value)}${unit ? ' ' + esc(unit) : ''}`;
    const yy = y(points[0].value).toFixed(1);
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(desc)}">
      <line class="grid" x1="${L}" x2="${W - R}" y1="${T + (H - T - B) * 0.2}" y2="${T + (H - T - B) * 0.2}"/>
      <line class="grid" x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}"/>
      <line class="grid" x1="${L}" x2="${W - R}" y1="${T + (H - T - B) * 0.8}" y2="${T + (H - T - B) * 0.8}"/>
      <text class="grid-label" x="${L - 6}" y="${(+yy + 4).toFixed(1)}" text-anchor="end">${fmtNum(points[0].value)}</text>
      <circle class="pt pt--single" cx="${cx}" cy="${cy}" r="6.5"/>
      <text class="val-text" x="${cx}" y="${(+cy - 12).toFixed(1)}" text-anchor="middle">${valStr}</text>
      <text class="x-label" x="${cx}" y="${H - 8}" text-anchor="middle">${esc(points[0].label)}</text>
    </svg>`;
  }

  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const last = points.length - 1;
  const area = `${line} L${x(last).toFixed(1)} ${H - B} L${x(0).toFixed(1)} ${H - B} Z`;

  const ticks = [max, (max + min) / 2, min].map((v) => {
    const yy = y(v).toFixed(1);
    return `<line class="grid" x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}"/>` +
           `<text class="grid-label" x="${L - 6}" y="${(+yy + 4).toFixed(1)}" text-anchor="end">${fmtNum(Math.round(v * 10) / 10)}</text>`;
  }).join('');

  const dots = points.length <= 30
    ? points.map((p, i) => `<circle class="pt" cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="5"/>`).join('')
    : `<circle class="pt" cx="${x(last).toFixed(1)}" cy="${y(points[last].value).toFixed(1)}" r="5.5"/>`;

  // Valores sobre los puntos (evitando empastes)
  let valLabels = '';
  if (showValues) {
    const shouldShow = (i) => {
      if (points.length <= 6) return true;
      if (i === 0 || i === last) return true;
      if (points[i].value === max) return true;
      return false;
    };
    valLabels = points.map((p, i) => {
      if (!shouldShow(i)) return '';
      const cx = x(i);
      const cy = y(p.value);
      const anchor = i === 0 ? 'start' : (i === last ? 'end' : 'middle');
      const dx = i === 0 ? cx + 4 : (i === last ? cx - 4 : cx);
      const str = `${fmtNum(p.value)}${unit ? ' ' + esc(unit) : ''}`;
      return `<text class="val-text" x="${dx.toFixed(1)}" y="${(cy - 10).toFixed(1)}" text-anchor="${anchor}">${str}</text>`;
    }).join('');
  }

  // Etiquetas X
  const xl = points.length <= 6
    ? points.map((p, i) => `<text class="x-label" x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="${i === 0 ? 'start' : (i === last ? 'end' : 'middle')}">${esc(p.label)}</text>`).join('')
    : `<text class="x-label" x="${L}" y="${H - 8}">${esc(points[0].label)}</text><text class="x-label" x="${W - R}" y="${H - 8}" text-anchor="end">${esc(points[last].label)}</text>`;

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(desc)}">
    ${ticks}<path class="area" d="${area}"/><path class="line" d="${line}"/>${dots}${valLabels}${xl}</svg>`;
}
