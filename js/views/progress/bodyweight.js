/* Progreso de un ejercicio de peso corporal: récords, comparativa, métricas de la gráfica e
 * historial en repeticiones. La carga estimada solo aparece si se puede estimar
 * (services/bodyweight.js). Usa las mismas piezas visuales que el progreso con pesas. */
import { esc, fmtNum } from '../../utils/dom.js';
import { formatShort } from '../../utils/dates.js';
import { icons } from '../../utils/icons.js';
import { fmtWeight, fromKg } from '../../utils/units.js';
import { trendBadge } from './trend.js';

const DESCRIPTIONS = {
  repsMax: 'Las repeticiones de tu mejor serie de cada sesión. Es la medida exacta: no estima nada.',
  repsTotal: 'Todas las repeticiones de trabajo de la sesión, sin calentamientos.',
  extra: 'El peso que añadiste sobre tu cuerpo (lastre). 0 es solo tu cuerpo.',
  carga: 'Estimada: tu peso corporal de cada fecha más el peso añadido.',
};

/** Métricas de la gráfica: las de peso solo si hay lastre o carga estimable. */
export function bodyweightMetrics(bw) {
  const m = { repsMax: 'Reps máx.', repsTotal: 'Reps totales' };
  if (bw.records.extraMax > 0) m.extra = 'Añadido';
  if (bw.records.cargaMax != null) m.carga = 'Carga est.';
  return m;
}

export const bodyweightDescription = (metric) => DESCRIPTIONS[metric] || '';

const isWeightMetric = (metric) => metric === 'extra' || metric === 'carga';

export const bodyweightUnit = (metric, unidad) => (isWeightMetric(metric) ? unidad : 'reps');

export function bodyweightPoints(sessions, metric, unidad) {
  return sessions
    .filter((s) => s[metric] != null)
    .map((s) => ({
      label: formatShort(s.fecha),
      value: isWeightMetric(metric) ? Math.round(fromKg(s[metric], unidad) * 10) / 10 : s[metric],
    }));
}

function card({ icon, tone, value, unit, label, gold = false }) {
  return `
    <div class="pr-card${gold ? ' pr-card--gold' : ''}">
      <span class="pr-card-icon pr-card-icon--${tone}">${icon}</span>
      <p class="pr-card-val">${value} <span class="pr-card-unit">${esc(unit)}</span></p>
      <p class="pr-card-label">${label}</p>
    </div>`;
}

/* Récords: más reps en una serie, el lastre máximo (o más reps en una sesión) y la carga estimada. */
export function bodyweightRecordsHtml(bw, unidad) {
  const { records, bodyKg } = bw;
  const cards = [card({ icon: icons.crown({ size: 20 }), tone: 'primary', value: records.repsSerie, unit: 'reps', label: 'Más reps en una serie', gold: true })];
  const sesion = card({ icon: icons.trendUp({ size: 20 }), tone: 'green', value: records.repsSesion, unit: 'reps', label: 'Más reps en una sesión' });
  if (records.extraMax > 0) {
    cards.push(card({ icon: icons.plus({ size: 20 }), tone: 'green', value: `+${fmtWeight(records.extraMax, unidad)}`, unit: unidad, label: 'Peso añadido máx.' }));
  } else {
    cards.push(sesion);
  }
  if (records.cargaMax != null) {
    cards.push(card({ icon: icons.pulse({ size: 20 }), tone: 'blue', value: `≈ ${fmtWeight(records.cargaMax, unidad)}`, unit: unidad, label: 'Carga estimada' }));
  } else if (records.extraMax > 0) {
    cards.push(sesion);
  }
  const note = records.cargaMax != null && bodyKg
    ? `<p class="pr-note">Carga estimada: levantas todo tu cuerpo. Usa tu peso corporal de cada fecha (el último: ${fmtWeight(bodyKg, unidad)} ${esc(unidad)}) más el peso añadido.</p>`
    : '';
  return `<div class="pr-grid${cards.length === 2 ? ' pr-grid--2' : ''}">${cards.join('')}</div>${note}`;
}

function row(label, prev, curr, unit, rawPrev = prev, rawCurr = curr) {
  return `
    <div class="compare-row">
      <span class="compare-row-name">${label}</span>
      <span class="compare-row-vals">
        <span>${prev}</span>
        <span class="compare-arrow"> → </span>
        <strong>${curr}${unit ? ` ${esc(unit)}` : ''}</strong>
      </span>
      <span class="compare-row-chip">${trendBadge(rawCurr, rawPrev)}</span>
    </div>`;
}

export function bodyweightCompareHtml(sessions, unidad) {
  if (sessions.length < 2) return '';
  const last = sessions[sessions.length - 1];
  const prev = sessions[sessions.length - 2];
  const kg = (v) => fmtNum(Math.round(fromKg(v, unidad) * 10) / 10);
  const rows = [
    row('Reps máx.', prev.repsMax, last.repsMax, ''),
    row('Reps totales', prev.repsTotal, last.repsTotal, ''),
    row('Series', prev.series, last.series, ''),
  ];
  if (prev.extra > 0 || last.extra > 0) rows.push(row('Peso añadido', kg(prev.extra), kg(last.extra), unidad, prev.extra, last.extra));
  if (prev.carga != null && last.carga != null) rows.push(row('Carga est.', kg(prev.carga), kg(last.carga), unidad, prev.carga, last.carga));
  return `
    <section>
      <h2 class="progress-section-label">Última sesión vs anterior</h2>
      <div class="compare-card">
        <div class="compare-card-head">
          <span>${esc(formatShort(prev.fecha))}</span>
          <span>→</span>
          <strong>${esc(formatShort(last.fecha))}</strong>
        </div>
        <div class="compare-table">${rows.join('')}</div>
      </div>
    </section>`;
}

export function bodyweightSessionsHtml(sessions, unidad) {
  if (!sessions.length) return '';
  const rows = sessions.slice().reverse().map((s, i, arr) => {
    const load = s.extra > 0 ? `peso corporal + ${fmtWeight(s.extra, unidad)} ${esc(unidad)}` : 'peso corporal';
    return `
      <div class="sess-item">
        <div>
          <span class="sess-item-date">${esc(formatShort(s.fecha))}</span>
          <span class="sess-item-sub">${s.series} ${s.series === 1 ? 'serie' : 'series'} · ${s.repsTotal} reps · ${load}</span>
        </div>
        <div class="sess-item-right">
          <span class="sess-item-max">${s.repsMax} reps máx.</span>
          ${trendBadge(s.repsMax, arr[i + 1]?.repsMax)}
        </div>
      </div>`;
  });
  return `
    <section>
      <h2 class="progress-section-label">Historial de sesiones</h2>
      <div class="sess-card">${rows.join('')}</div>
    </section>`;
}
