import { listExercises, progressForExercise, lastTrainedExerciseId, prByExercise, isOwnExercise, muscleFocus } from '../services/workouts.js';
import { addBodyWeight, listBodyWeights, deleteBodyMetric } from '../services/body.js';
import { saveSettings } from '../store.js';
import { delegate, forms, changes, toast, esc, num, fmtNum, go } from '../utils/dom.js';
import { lineChart } from '../utils/chart.js';
import { formatShort, todayISO } from '../utils/dates.js';
import { icons } from '../utils/icons.js';
import { bindExerciseEdit, openExerciseEditor } from '../utils/exercise-editor.js';
import { askConfirm } from '../utils/confirm-sheet.js';
import { weightUnit, toKg, fromKg, fmtWeight, fmtVolume, unitSegHtml } from '../utils/units.js';
import { syncSegThumb } from '../utils/seg-swipe.js';

const METRICS = { e1rm: '1RM est.', adj: '1RM aj.', maxPeso: 'Peso máx.', volumen: 'Volumen' };
let metric = 'e1rm';

/* Datos de la vista actual: actualizar unidad/métrica sin remount de los .seg. */
let view = null;

function trendChip(curr, prev) {
  if (!prev || prev === 0) return '';
  const pct = ((curr - prev) / prev) * 100;
  if (Math.abs(pct) < 0.5) return '<span class="trend-neutral">—</span>';
  if (pct > 0) return `<span class="trend-up">${icons.arrowUp({ size: 11 })} ${pct.toFixed(1)}%</span>`;
  return `<span class="trend-down">${icons.arrowDown({ size: 11 })} ${Math.abs(pct).toFixed(1)}%</span>`;
}

function adjCaption(sessions) {
  const days = sessions.filter((s) => s.adj != null);
  if (!days.length) return 'Todavía no hay series de trabajo con esfuerzo. Esta escala no se mezcla con el 1RM estimado.';
  const last = days[days.length - 1];
  const bits = ['Escala aparte del 1RM estimado. «4 o más» es un piso.'];
  if (last.adjFloor) bits.push('El último punto es un piso.');
  if (last.adjReliable === false) bits.push('El último punto no es fiable: pasan de 12 repeticiones efectivas.');
  return bits.join(' ');
}

function showW(kg, unidad) {
  return fromKg(kg, unidad);
}

function metricPoints(sessions, unidad) {
  return sessions
    .filter((s) => metric !== 'adj' || s.adj != null)
    .map((s) => {
      const raw = metric === 'adj' ? s.adj : s[metric];
      const shown = metric === 'volumen' || metric === 'maxPeso' || metric === 'e1rm' || metric === 'adj'
        ? fromKg(raw, unidad)
        : raw;
      return {
        label: formatShort(s.fecha),
        value: Math.round(shown * 10) / 10,
      };
    });
}

function compareCard(sessions, unidad) {
  if (sessions.length < 2) return '';
  const last = sessions[sessions.length - 1];
  const prev = sessions[sessions.length - 2];
  const rows = [
    { label: '1RM est.', curr: showW(last.e1rm, unidad), prev: showW(prev.e1rm, unidad), unit: unidad, rawCurr: last.e1rm, rawPrev: prev.e1rm },
  ];
  if (last.adj != null && prev.adj != null) {
    rows.push({ label: '1RM aj.', curr: showW(last.adj, unidad), prev: showW(prev.adj, unidad), unit: unidad, rawCurr: last.adj, rawPrev: prev.adj });
  }
  rows.push(
    { label: 'Volumen', curr: showW(last.volumen, unidad), prev: showW(prev.volumen, unidad), unit: unidad, rawCurr: last.volumen, rawPrev: prev.volumen },
    { label: 'Series', curr: last.series, prev: prev.series, unit: '', rawCurr: last.series, rawPrev: prev.series },
    { label: 'Peso máx.', curr: showW(last.maxPeso, unidad), prev: showW(prev.maxPeso, unidad), unit: unidad, rawCurr: last.maxPeso, rawPrev: prev.maxPeso },
  );
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
            ${trendChip(r.rawCurr, r.rawPrev)}
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
          <span>${fmtWeight(s.maxPeso, unidad)} ${esc(unidad)} × —</span>
          <small>${fmtVolume(s.volumen, unidad)} ${esc(unidad)} vol.</small>
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

function prBadgesHtml(pr, unidad) {
  return `
    <div class="pr-badges">
      <div class="pr-badge pr-badge--gold">
        ${icons.trophy({ size: 16, stroke: 'var(--primary-ink)' })}
        <div>
          <span class="pr-badge-val">${fmtWeight(pr.maxPeso, unidad)}<small> ${esc(unidad)}</small></span>
          <span class="pr-badge-label">PR Peso</span>
        </div>
      </div>
      <div class="pr-badge">
        ${icons.trendUp({ size: 16, stroke: 'var(--green)' })}
        <div>
          <span class="pr-badge-val">${fmtWeight(pr.e1rmMax, unidad)}<small> ${esc(unidad)}</small></span>
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
    </div>`;
}

function bodyListHtml(body, unidad) {
  if (!body.length) return '';
  return `
    <div class="list" id="body-list" style="margin-top:12px">
      ${body.slice(-5).reverse().map((b) => `
        <div class="row">
          <div>
            <strong class="num">${fmtWeight(b.peso, unidad)} ${esc(unidad)}</strong>
            <small>${esc(formatShort(b.fecha))}</small>
          </div>
          <button class="btn-x" data-action="del-body" data-id="${b.id}" type="button" aria-label="Borrar registro">
            ${icons.trash({ size: 16 })}
          </button>
        </div>`).join('')}
    </div>`;
}

function setChart(slot, html) {
  if (!slot) return;
  slot.innerHTML = html;
}

/* Solo números/gráficos: kg/lb y métricas no se destruyen. */
function applyUnitLive(root, next, pesoKg) {
  if (!view) return;
  view.unidad = next;

  root.querySelectorAll('.unit-seg [data-unidad]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.unidad === next));
  });
  const unitSeg = root.querySelector('.unit-seg');
  if (unitSeg) requestAnimationFrame(() => syncSegThumb(unitSeg));

  const input = root.querySelector('form[data-form="body"] input[name="peso"]');
  if (input && pesoKg != null) input.value = fmtWeight(pesoKg, next);

  const { sessions, body, pr } = view;
  const prSlot = root.querySelector('#pr-slot');
  if (prSlot) prSlot.innerHTML = prBadgesHtml(pr, next);

  const compareSlot = root.querySelector('#compare-slot');
  if (compareSlot) compareSlot.innerHTML = compareCard(sessions, next);

  setChart(root.querySelector('#metric-chart'), lineChart(metricPoints(sessions, next), {
    desc: `${METRICS[metric]} por sesión`,
  }));

  const sessSlot = root.querySelector('#sess-slot');
  if (sessSlot) sessSlot.innerHTML = sessionTable(sessions, next);

  const bodyPoints = body.slice(-30).map((b) => ({
    label: formatShort(b.fecha),
    value: Math.round(fromKg(b.peso, next) * 10) / 10,
  }));
  setChart(root.querySelector('#body-chart'), lineChart(bodyPoints, { desc: 'Peso corporal en el tiempo' }));

  const listSlot = root.querySelector('#body-list-slot');
  if (listSlot) listSlot.innerHTML = bodyListHtml(body, next);
}

function applyMetricLive(root) {
  if (!view) return;
  const { sessions, unidad } = view;

  root.querySelectorAll('.metric-seg [data-metric]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.metric === metric));
  });
  const metricSeg = root.querySelector('.metric-seg');
  if (metricSeg) requestAnimationFrame(() => syncSegThumb(metricSeg));

  setChart(root.querySelector('#metric-chart'), lineChart(metricPoints(sessions, unidad), {
    desc: `${METRICS[metric]} por sesión`,
  }));

  const note = root.querySelector('#adj-note');
  if (note) {
    if (metric === 'adj') {
      note.hidden = false;
      note.textContent = adjCaption(sessions);
    } else {
      note.hidden = true;
      note.textContent = '';
    }
  }
}

export async function render(el, [idParam] = []) {
  const exs = await listExercises();
  const exId = Number(idParam) || (await lastTrainedExerciseId()) || exs[0]?.id;
  const [prog, body, pr] = await Promise.all([
    exId ? progressForExercise(exId) : { sessions: [], pr: 0 },
    listBodyWeights(),
    exId ? prByExercise(exId) : { maxPeso: 0, maxReps: 0, e1rmMax: 0 },
  ]);
  const unidad = weightUnit();
  const sessions = prog.sessions.slice(-20);
  view = { exId, sessions, body, pr, unidad };

  const points = metricPoints(sessions, unidad);
  const adjNote = metric === 'adj' ? adjCaption(sessions) : '';
  const bodyPoints = body.slice(-30).map((b) => ({
    label: formatShort(b.fecha),
    value: Math.round(fromKg(b.peso, unidad) * 10) / 10,
  }));

  el.innerHTML = `
    <header class="page-head"><h1>Progreso</h1></header>

    <label class="field">
      <span>Ejercicio seleccionado</span>
      <select data-change="exercise">
        ${exs.map((e) => `<option value="${e.id}" data-grupo="${esc(e.grupo)}" ${muscleFocus(e.nombre) ? `data-foco="${esc(muscleFocus(e.nombre))}"` : ''} ${isOwnExercise(e) ? 'data-propio="1"' : ''} ${e.id === exId ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('')}
      </select>
    </label>

    ${prog.sessions.length ? `
      <div id="pr-slot">${prBadgesHtml(pr, unidad)}</div>
      <div id="compare-slot">${compareCard(sessions, unidad)}</div>

      <div class="seg metric-seg" role="group" aria-label="Métrica del gráfico" style="margin:16px 0 10px">
        ${Object.entries(METRICS).map(([k, label]) =>
          `<button type="button" data-action="metric" data-metric="${k}" aria-pressed="${k === metric}">${label}</button>`).join('')}
      </div>
      <div id="metric-chart">${lineChart(points, { desc: `${METRICS[metric]} por sesión` })}</div>
      <p class="muted effort-note" id="adj-note" ${metric === 'adj' ? '' : 'hidden'}>${esc(adjNote)}</p>

      <div id="sess-slot">${sessionTable(sessions, unidad)}</div>`

      : `<div class="empty">
          ${icons.dumbbell({ size: 40, stroke: 'var(--line-strong)' })}
          <p>Todavía no hay series registradas de este ejercicio.</p>
          <a class="btn btn-primary" href="#/workout">${icons.plus({ size: 18 })} Ir a entrenar</a>
        </div>`}

    <h2 class="section-title">Peso corporal</h2>
    <div id="body-chart">${lineChart(bodyPoints, { desc: 'Peso corporal en el tiempo' })}</div>
    <form class="form-card stack" data-form="body">
      <div class="grid-2">
        <label class="field"><span>Día</span><input type="date" name="fecha" value="${todayISO()}" max="${todayISO()}" required></label>
        <div class="field">
          <span>Peso ${unitSegHtml(unidad)}</span>
          <input name="peso" inputmode="decimal" autocomplete="off" required placeholder="0" aria-label="Peso corporal">
        </div>
      </div>
      <button class="btn btn-primary btn-block" type="submit">
        ${icons.plus({ size: 18 })} Guardar peso corporal
      </button>
    </form>
    <div id="body-list-slot">${bodyListHtml(body, unidad)}</div>
  `;

  changes(el, { exercise: (t) => go(`/progress/${t.value}`) });

  delegate(el, {
    unidad: async (t) => {
      const next = t.dataset.unidad === 'lb' ? 'lb' : 'kg';
      const prev = weightUnit();
      if (next === prev) return;
      const input = el.querySelector('form[data-form="body"] input[name="peso"]');
      const raw = num(input?.value);
      const kg = Number.isFinite(raw) ? toKg(raw, prev) : null;
      await saveSettings({ unidad: next });
      applyUnitLive(el, next, Number.isFinite(kg) ? kg : null);
    },
    metric: (t) => {
      const next = t.dataset.metric;
      if (!next || next === metric) return;
      metric = next;
      applyMetricLive(el);
    },
    'del-body': async (t) => {
      const ok = await askConfirm({
        title: 'Borrar peso',
        body: 'Se quita este registro de peso corporal.',
      });
      if (!ok) return;
      await deleteBodyMetric(Number(t.dataset.id));
      await render(el, [exId]);
    }
  });

  forms(el, {
    body: async (f) => {
      const peso = toKg(num(f.elements.peso.value));
      if (!(peso > 0) || peso > 600) { toast('Escribe un peso válido.'); return; }
      await addBodyWeight({ fecha: f.elements.fecha.value, peso });
      await render(el, [exId]);
      toast('Peso corporal guardado');
    }
  });

  bindExerciseEdit(el, async (e) => {
    const id = Number(e.detail?.id);
    await openExerciseEditor(id, async (result) => {
      if (!result) return;
      if (result.deleted && result.id === exId) go('/progress');
      else await render(el, [String(exId)]);
      toast(result.deleted ? 'Ejercicio eliminado' : 'Ejercicio guardado');
    });
  });
}
