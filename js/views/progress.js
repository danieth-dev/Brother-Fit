import { listExercises, progressForExercise, lastTrainedExerciseId, prByExercise } from '../services/workouts.js';
import { addBodyWeight, listBodyWeights, deleteBodyMetric } from '../services/body.js';
import { state } from '../store.js';
import { delegate, forms, changes, toast, esc, num, fmtNum, go } from '../utils/dom.js';
import { lineChart } from '../utils/chart.js';
import { formatShort, todayISO } from '../utils/dates.js';
import { icons } from '../utils/icons.js';

const METRICS = { e1rm: '1RM est.', maxPeso: 'Peso máx.', volumen: 'Volumen' };
let metric = 'e1rm';

function trendChip(curr, prev) {
  if (!prev || prev === 0) return '';
  const pct = ((curr - prev) / prev) * 100;
  if (Math.abs(pct) < 0.5) return '<span class="trend-neutral">—</span>';
  if (pct > 0) return `<span class="trend-up">${icons.arrowUp({ size: 11 })} ${pct.toFixed(1)}%</span>`;
  return `<span class="trend-down">${icons.arrowDown({ size: 11 })} ${Math.abs(pct).toFixed(1)}%</span>`;
}

function compareCard(sessions, unidad) {
  if (sessions.length < 2) return '';
  const last = sessions[sessions.length - 1];
  const prev = sessions[sessions.length - 2];
  const rows = [
    { label: '1RM est.', curr: last.e1rm, prev: prev.e1rm, unit: unidad },
    { label: 'Volumen', curr: last.volumen, prev: prev.volumen, unit: unidad },
    { label: 'Series', curr: last.series, prev: prev.series, unit: '' },
    { label: 'Peso máx.', curr: last.maxPeso, prev: prev.maxPeso, unit: unidad },
  ];
  return `
    <div class="compare-card">
      <div class="compare-card-head">
        <span class="compare-label">${esc(formatShort(prev.fecha))}</span>
        <span class="compare-arrow">→</span>
        <span class="compare-label compare-label--current">${esc(formatShort(last.fecha))}</span>
      </div>
      <div class="compare-rows">
        ${rows.map((r) => `
          <div class="compare-row">
            <span class="compare-row-name">${r.label}</span>
            <span class="compare-row-prev">${fmtNum(Math.round(r.prev * 10) / 10)} ${esc(r.unit)}</span>
            <span class="compare-row-arrow">→</span>
            <span class="compare-row-curr">${fmtNum(Math.round(r.curr * 10) / 10)} ${esc(r.unit)}</span>
            ${trendChip(r.curr, r.prev)}
          </div>`).join('')}
      </div>
    </div>`;
}

function sessionTable(sessions, unidad) {
  if (!sessions.length) return '';
  const rows = sessions.slice().reverse().map((s, i, arr) => {
    const prev = arr[i + 1];
    return `
      <div class="sess-row">
        <div class="sess-row-date">
          <strong>${esc(formatShort(s.fecha))}</strong>
          <small>${s.series} series</small>
        </div>
        <div class="sess-row-best">
          <span>${fmtNum(s.maxPeso)} ${esc(unidad)} × —</span>
          <small>${fmtNum(Math.round(s.volumen))} ${esc(unidad)} vol.</small>
        </div>
        <div class="sess-row-trend">
          ${trendChip(s.e1rm, prev?.e1rm)}
        </div>
      </div>`;
  });
  return `
    <h2 class="section-title">Historial de sesiones</h2>
    <div class="sess-table">${rows.join('')}</div>`;
}

export async function render(el, [idParam] = []) {
  const exs = await listExercises();
  const exId = Number(idParam) || (await lastTrainedExerciseId()) || exs[0]?.id;
  const [prog, body, pr] = await Promise.all([
    exId ? progressForExercise(exId) : { sessions: [], pr: 0 },
    listBodyWeights(),
    exId ? prByExercise(exId) : { maxPeso: 0, maxReps: 0, e1rmMax: 0 },
  ]);
  const unidad = state.settings.unidad;
  const sessions = prog.sessions.slice(-20);
  const points = sessions.map((s) => ({ label: formatShort(s.fecha), value: Math.round(s[metric] * 10) / 10 }));
  const bodyPoints = body.slice(-30).map((b) => ({ label: formatShort(b.fecha), value: b.peso }));

  el.innerHTML = `
    <header class="page-head"><h1>Progreso</h1></header>

    <label class="field">
      <span>Ejercicio seleccionado</span>
      <select data-change="exercise">
        ${exs.map((e) => `<option value="${e.id}" ${e.id === exId ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('')}
      </select>
    </label>

    ${prog.sessions.length ? `
      <!-- PR BADGES -->
      <div class="pr-badges">
        <div class="pr-badge pr-badge--gold">
          ${icons.trophy({ size: 16, stroke: 'var(--primary-ink)' })}
          <div>
            <span class="pr-badge-val">${fmtNum(pr.maxPeso)}<small> ${esc(unidad)}</small></span>
            <span class="pr-badge-label">PR Peso</span>
          </div>
        </div>
        <div class="pr-badge">
          ${icons.trendUp({ size: 16, stroke: 'var(--green)' })}
          <div>
            <span class="pr-badge-val">${fmtNum(Math.round(pr.e1rmMax * 10) / 10)}<small> ${esc(unidad)}</small></span>
            <span class="pr-badge-label">Mejor 1RM</span>
          </div>
        </div>
        <div class="pr-badge">
          ${icons.activity({ size: 16, stroke: 'var(--blue)' })}
          <div>
            <span class="pr-badge-val">${pr.maxReps}<small> reps</small></span>
            <span class="pr-badge-label">Más reps</span>
          </div>
        </div>
      </div>

      <!-- COMPARATIVA ÚLTIMA VS ANTERIOR -->
      ${compareCard(sessions, unidad)}

      <!-- GRÁFICO -->
      <div class="seg" role="group" aria-label="Métrica del gráfico" style="margin:16px 0 10px">
        ${Object.entries(METRICS).map(([k, label]) =>
          `<button type="button" data-action="metric" data-metric="${k}" aria-pressed="${k === metric}">${label}</button>`).join('')}
      </div>
      ${lineChart(points, { desc: `${METRICS[metric]} por sesión` })}

      <!-- TABLA DE SESIONES CON TENDENCIAS -->
      ${sessionTable(sessions, unidad)}`

      : `<div class="empty">
          ${icons.dumbbell({ size: 40, stroke: 'var(--line-strong)' })}
          <p>Todavía no hay series registradas de este ejercicio.</p>
          <a class="btn btn-primary" href="#/workout">${icons.plus({ size: 18 })} Ir a entrenar</a>
        </div>`}

    <h2 class="section-title">Peso corporal</h2>
    ${lineChart(bodyPoints, { desc: 'Peso corporal en el tiempo' })}
    <form class="form-card stack" data-form="body" style="margin-top:14px">
      <div class="grid-2">
        <label class="field"><span>Día</span><input type="date" name="fecha" value="${todayISO()}" max="${todayISO()}" required></label>
        <label class="field"><span>Peso (${esc(unidad)})</span><input name="peso" inputmode="decimal" autocomplete="off" required placeholder="0"></label>
      </div>
      <button class="btn btn-primary btn-block" type="submit">
        ${icons.plus({ size: 18 })} Guardar peso corporal
      </button>
    </form>
    ${body.length ? `
      <div class="list" style="margin-top:12px">
        ${body.slice(-5).reverse().map((b) => `
          <div class="row">
            <div>
              <strong class="num">${fmtNum(b.peso)} ${esc(unidad)}</strong>
              <small>${esc(formatShort(b.fecha))}</small>
            </div>
            <button class="btn-x" data-action="del-body" data-id="${b.id}" type="button" aria-label="Borrar registro">
              ${icons.trash({ size: 16 })}
            </button>
          </div>`).join('')}
      </div>` : ''}
  `;

  changes(el, { exercise: (t) => go(`/progress/${t.value}`) });

  delegate(el, {
    metric: async (t) => { metric = t.dataset.metric; await render(el, [exId]); },
    'del-body': async (t) => {
      await deleteBodyMetric(Number(t.dataset.id));
      await render(el, [exId]);
    }
  });

  forms(el, {
    body: async (f) => {
      const peso = num(f.elements.peso.value);
      if (!(peso > 0)) { toast('Escribe un peso válido.'); return; }
      await addBodyWeight({ fecha: f.elements.fecha.value, peso });
      await render(el, [exId]);
      toast('Peso corporal guardado');
    }
  });
}
