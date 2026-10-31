import { listExercises, progressForExercise, lastTrainedExerciseId, prByExercise, isOwnExercise, muscleFocus, muscleName } from '../services/workouts.js';
import { addBodyWeight, listBodyWeights, deleteBodyMetric } from '../services/body.js';
import { saveSettings } from '../store.js';
import { delegate, forms, toast, esc, num, fmtNum, go } from '../utils/dom.js';
import { lineChart } from '../utils/chart.js';
import { formatShort, todayISO, formatMedium, formatRelativeDays } from '../utils/dates.js';
import { icons } from '../utils/icons.js';
import { bindExerciseEdit, openExerciseEditor } from '../utils/exercise-editor.js';
import { askConfirm } from '../utils/confirm-sheet.js';
import { openPicker } from '../utils/picker.js';
import { weightUnit, toKg, fromKg, fmtWeight, fmtVolume } from '../utils/units.js';
import { syncSegThumb } from '../utils/seg-swipe.js';

const METRICS = {
  e1rm: '1RM est.',
  adj: '1RM aj.',
  maxPeso: 'Peso máx.',
  volumen: 'Volumen',
};

const METRIC_DESCRIPTIONS = {
  e1rm: 'El máximo que podrías levantar en 1 repetición, calculado con tus series. Con solo 2 sesiones se ve una línea recta; la tendencia aparece desde la tercera.',
  adj: '1RM estimado ajustado por el esfuerzo real (RIR). «4 o más» es considerado un piso seguro de intensidad.',
  maxPeso: 'Carga máxima efectiva movida en cada sesión de entrenamiento.',
  volumen: 'Volumen total acumulado (series × repeticiones × peso) realizado en la sesión.',
};

let currentTab = 'ejercicio'; // 'ejercicio' | 'peso'
let metric = 'e1rm';
let view = null;

function trendBadge(curr, prev) {
  if (!prev || prev === 0) return '<span class="trend-badge trend-badge--neutral">—</span>';
  const pct = ((curr - prev) / prev) * 100;
  if (Math.abs(pct) < 0.5) return '<span class="trend-badge trend-badge--neutral">—</span>';
  if (pct > 0) {
    return `<span class="trend-badge trend-badge--up">↑ ${pct.toFixed(1).replace('.', ',')}%</span>`;
  }
  return `<span class="trend-badge trend-badge--down">↓ ${Math.abs(pct).toFixed(1).replace('.', ',')}%</span>`;
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

function compareCardHtml(sessions, unidad) {
  if (sessions.length < 2) return '';
  const last = sessions[sessions.length - 1];
  const prev = sessions[sessions.length - 2];
  const rows = [
    { label: '1RM estimado', curr: showW(last.e1rm, unidad), prev: showW(prev.e1rm, unidad), unit: unidad, rawCurr: last.e1rm, rawPrev: prev.e1rm },
  ];
  if (last.adj != null && prev.adj != null) {
    rows.push({ label: '1RM ajustado', curr: showW(last.adj, unidad), prev: showW(prev.adj, unidad), unit: unidad, rawCurr: last.adj, rawPrev: prev.adj });
  }
  rows.push(
    { label: 'Volumen', curr: showW(last.volumen, unidad), prev: showW(prev.volumen, unidad), unit: unidad, rawCurr: last.volumen, rawPrev: prev.volumen },
    { label: 'Series', curr: last.series, prev: prev.series, unit: '', rawCurr: last.series, rawPrev: prev.series },
    { label: 'Peso máx.', curr: showW(last.maxPeso, unidad), prev: showW(prev.maxPeso, unidad), unit: unidad, rawCurr: last.maxPeso, rawPrev: prev.maxPeso },
  );

  return `
    <section>
      <h2 style="margin: 0 4px 10px; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted)">
        Última sesión vs anterior
      </h2>
      <div class="compare-card">
        <div class="compare-card-head">
          <span>${esc(formatShort(prev.fecha))}</span>
          <span>→</span>
          <strong>${esc(formatShort(last.fecha))}</strong>
        </div>
        <div class="compare-table">
          ${rows.map((r) => `
            <div class="compare-row">
              <span class="compare-row-name">${r.label}</span>
              <span class="compare-row-vals">
                <span>${fmtNum(Math.round(r.prev * 10) / 10)}</span>
                <span style="color:var(--muted)"> → </span>
                <strong>${fmtNum(Math.round(r.curr * 10) / 10)} ${esc(r.unit)}</strong>
              </span>
              <span class="compare-row-chip">
                ${trendBadge(r.rawCurr, r.rawPrev)}
              </span>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
  `;
}

function prBadgesHtml(pr, unidad) {
  return `
    <div class="pr-grid">
      <div class="pr-card pr-card--gold">
        <span class="pr-card-icon" style="color: var(--primary)">
          ${icons.crown({ size: 20 })}
        </span>
        <p class="pr-card-val">${fmtWeight(pr.maxPeso, unidad)} <span class="pr-card-unit">${esc(unidad)}</span></p>
        <p class="pr-card-label">Récord de peso</p>
      </div>

      <div class="pr-card">
        <span class="pr-card-icon" style="color: var(--green)">
          ${icons.trendUp({ size: 20 })}
        </span>
        <p class="pr-card-val">${fmtWeight(pr.e1rmMax, unidad)} <span class="pr-card-unit">${esc(unidad)}</span></p>
        <p class="pr-card-label">Mejor 1RM</p>
      </div>

      <div class="pr-card">
        <span class="pr-card-icon" style="color: var(--blue)">
          ${icons.pulse({ size: 20 })}
        </span>
        <p class="pr-card-val">${pr.maxReps} <span class="pr-card-unit">reps</span></p>
        <p class="pr-card-label">Más repeticiones</p>
      </div>
    </div>
  `;
}

function sessionTableHtml(sessions, unidad) {
  if (!sessions.length) return '';
  const rows = sessions.slice().reverse().map((s, i, arr) => {
    const prev = arr[i + 1];
    const maxStr = s.maxPeso > 0 ? `${fmtWeight(s.maxPeso, unidad)} ${esc(unidad)} máx.` : 'Sin peso';
    return `
      <div class="sess-item">
        <div>
          <span class="sess-item-date">${esc(formatShort(s.fecha))}</span>
          <span class="sess-item-sub">${s.series} ${s.series === 1 ? 'serie' : 'series'} · ${fmtVolume(s.volumen, unidad)} ${esc(unidad)} de volumen</span>
        </div>
        <div class="sess-item-right">
          <span class="sess-item-max">${maxStr}</span>
          ${trendBadge(s.e1rm, prev?.e1rm)}
        </div>
      </div>
    `;
  });

  return `
    <section>
      <h2 style="margin: 0 4px 10px; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted)">
        Historial de sesiones
      </h2>
      <div class="sess-card">${rows.join('')}</div>
    </section>
  `;
}

function chartCardHtml(sessions, unidad) {
  if (!sessions.length) return '';
  const points = metricPoints(sessions, unidad);
  const lastVal = points[points.length - 1]?.value ?? 0;
  const prevVal = points[points.length - 2]?.value ?? null;
  const unitStr = metric === 'series' ? '' : unidad;

  return `
    <section>
      <h2 style="margin: 0 4px 10px; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted)">
        Evolución
      </h2>

      <div class="seg metric-seg" role="group" aria-label="Métrica del gráfico">
        ${Object.entries(METRICS).map(([k, label]) =>
          `<button type="button" data-action="metric" data-metric="${k}" aria-pressed="${k === metric}">${label}</button>`
        ).join('')}
      </div>

      <div class="chart-card">
        <div class="chart-card-head">
          <span class="chart-card-title">${METRICS[metric]}</span>
          <div class="chart-card-val-wrap">
            <span class="chart-card-val">${fmtNum(lastVal)} ${esc(unitStr)}</span>
            ${prevVal != null ? trendBadge(lastVal, prevVal) : ''}
          </div>
        </div>

        <div id="metric-chart">
          ${lineChart(points, { desc: `${METRICS[metric]} por sesión`, unit: unitStr })}
        </div>

        <p class="chart-card-note">
          ${esc(METRIC_DESCRIPTIONS[metric] || '')}
        </p>
      </div>
    </section>
  `;
}

function bodySectionHtml(body, unidad) {
  const latest = body[body.length - 1];
  const latestWeight = latest ? fmtWeight(latest.peso, unidad) : '';
  const relTime = latest ? formatRelativeDays(latest.fecha) : '';
  const dateFmt = latest ? formatShort(latest.fecha) : '';

  const bodyPoints = body.slice(-30).map((b) => ({
    label: formatShort(b.fecha),
    value: Math.round(fromKg(b.peso, unidad) * 10) / 10,
  }));

  const todayFmt = formatMedium(todayISO());

  return `
    <div id="body-tab-pane">
      <!-- Tarjeta Último registro -->
      ${latest ? `
        <div class="body-hero-card">
          <p class="body-hero-sub">Último registro</p>
          <p class="body-hero-val">
            ${esc(latestWeight)} <span class="body-hero-unit">${esc(unidad)}</span>
          </p>
          <p class="body-hero-rel">${esc(dateFmt)} · ${esc(relTime)}</p>
        </div>
      ` : ''}

      <!-- Gráfico de peso corporal -->
      <div class="chart-card" style="margin-top:0">
        <div class="chart-card-head">
          <span class="chart-card-title">Tendencia de peso</span>
          ${latest ? `<span class="chart-card-val">${esc(latestWeight)} ${esc(unidad)}</span>` : ''}
        </div>
        <div id="body-chart">
          ${lineChart(bodyPoints, { height: 180, desc: 'Peso corporal en el tiempo', unit: unidad })}
        </div>
        ${body.length <= 1 ? `
          <p class="chart-card-note">Con un solo registro no hay tendencia. Añade otro para ver cómo cambia.</p>
        ` : `
          <p class="chart-card-note">Historial de pesajes recientes en ${esc(unidad)}.</p>
        `}
      </div>

      <!-- Formulario Registrar Peso -->
      <section>
        <h2 style="margin: 0 4px 10px; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted)">
          Registrar peso
        </h2>
        <form class="body-form-card" data-form="body">
          <div class="body-date-row">
            <span class="body-date-label">
              ${icons.calendar({ size: 19, stroke: 'var(--muted)' })}
              <span id="body-date-text">Hoy · ${todayFmt}</span>
            </span>
            <button type="button" class="body-change-date-btn" data-action="toggle-date-input">
              Cambiar día
            </button>
          </div>

          <div class="body-date-input-wrap" id="body-date-input-wrap" hidden>
            <input type="date" name="fecha" id="body-date-field" value="${todayISO()}" max="${todayISO()}">
          </div>

          <div class="body-input-row">
            <input 
              name="peso" 
              id="body-peso-input"
              inputmode="decimal" 
              autocomplete="off" 
              placeholder="${latestWeight || '0,0'}" 
              aria-label="Peso corporal" 
              class="body-weight-input"
            >
            <div class="seg unit-seg" role="group" aria-label="Unidad">
              <button type="button" data-action="unit-toggle" data-unit="kg" aria-pressed="${unidad === 'kg'}">KG</button>
              <button type="button" data-action="unit-toggle" data-unit="lb" aria-pressed="${unidad === 'lb'}">LB</button>
            </div>
          </div>

          <button type="submit" class="body-save-btn btn-block" id="btn-save-body" disabled>
            Escribe tu peso
          </button>
        </form>
      </section>

      <!-- Historial de pesajes -->
      <section>
        <h2 style="margin: 0 4px 10px; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted)">
          Historial
        </h2>
        <div class="body-history-card" id="body-list-slot">
          ${body.length ? body.slice(-12).reverse().map((b) => `
            <div class="body-history-item">
              <div>
                <span class="body-history-val">${fmtWeight(b.peso, unidad)} ${esc(unidad)}</span>
                <span class="body-history-date">${esc(formatShort(b.fecha))}</span>
              </div>
              <button class="body-del-btn" data-action="del-body" data-id="${b.id}" type="button" aria-label="Borrar registro">
                ${icons.trash({ size: 18 })}
              </button>
            </div>
          `).join('') : `
            <div style="padding:24px 16px;text-align:center;color:var(--muted);font-size:14px">
              No hay registros de peso corporal todavía.
            </div>
          `}
        </div>
      </section>
    </div>
  `;
}

function updateProgressView(el) {
  if (!view) return;
  const { currentEx, exs, sessions, body, pr, unidad } = view;

  const exPane = el.querySelector('#pane-ejercicio');
  const pesoPane = el.querySelector('#pane-peso');

  if (exPane) exPane.hidden = currentTab !== 'ejercicio';
  if (pesoPane) pesoPane.hidden = currentTab !== 'peso';

  el.querySelectorAll('.progress-tab-btn').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.tab === currentTab));
  });

  const tabsSeg = el.querySelector('.progress-tabs');
  if (tabsSeg) requestAnimationFrame(() => syncSegThumb(tabsSeg));

  if (currentTab === 'ejercicio') {
    const cardSlot = el.querySelector('#ex-card-slot');
    if (cardSlot && currentEx) {
      const gName = muscleName(currentEx.grupo) || currentEx.grupo;
      const fName = muscleFocus(currentEx.nombre);
      cardSlot.innerHTML = `
        <button type="button" class="progress-ex-card" data-action="open-picker" aria-label="Cambiar ejercicio, actualmente ${esc(currentEx.nombre)}">
          <span>
            <span class="progress-ex-card-tag">Ejercicio</span>
            <span class="progress-ex-card-title">${esc(currentEx.nombre)}</span>
            <span class="progress-ex-card-sub">
              <span aria-hidden="true" style="width: 8px; height: 8px; border-radius: 4px; background: var(--primary); display: inline-block"></span>
              <strong>${esc(gName)}</strong> ${fName ? `· ${esc(fName)}` : ''}
            </span>
          </span>
          <span class="progress-ex-card-icon">
            ${icons.chevronsUpDown({ size: 22 })}
          </span>
        </button>
      `;
    }

    const prSlot = el.querySelector('#pr-slot');
    if (prSlot) prSlot.innerHTML = prBadgesHtml(pr, unidad);

    const compareSlot = el.querySelector('#compare-slot');
    if (compareSlot) compareSlot.innerHTML = compareCardHtml(sessions, unidad);

    const chartCardSlot = el.querySelector('#chart-card-slot');
    if (chartCardSlot) {
      chartCardSlot.innerHTML = chartCardHtml(sessions, unidad);
      const metricSeg = chartCardSlot.querySelector('.metric-seg');
      if (metricSeg) requestAnimationFrame(() => syncSegThumb(metricSeg));
    }

    const sessSlot = el.querySelector('#sess-slot');
    if (sessSlot) sessSlot.innerHTML = sessionTableHtml(sessions, unidad);
  } else {
    if (pesoPane) {
      pesoPane.innerHTML = bodySectionHtml(body, unidad);
      const unitSeg = pesoPane.querySelector('.unit-seg');
      if (unitSeg) requestAnimationFrame(() => syncSegThumb(unitSeg));
      setupBodyInputListener(pesoPane);
    }
  }
}

function setupBodyInputListener(root) {
  const input = root.querySelector('#body-peso-input');
  const btn = root.querySelector('#btn-save-body');
  if (!input || !btn) return;

  const updateState = () => {
    const val = num(input.value);
    const valid = Number.isFinite(val) && val > 0 && val < 600;
    btn.disabled = !valid;
    btn.textContent = valid ? '+ Guardar peso corporal' : 'Escribe tu peso';
  };

  input.addEventListener('input', updateState);
  updateState();
}

export async function render(el, [idParam] = []) {
  const exs = await listExercises();
  const exId = Number(idParam) || (await lastTrainedExerciseId()) || exs[0]?.id;
  const currentEx = exs.find((e) => e.id === exId) || exs[0];

  const [prog, body, pr] = await Promise.all([
    exId ? progressForExercise(exId) : { sessions: [], pr: 0 },
    listBodyWeights(),
    exId ? prByExercise(exId) : { maxPeso: 0, maxReps: 0, e1rmMax: 0 },
  ]);
  const unidad = weightUnit();
  const sessions = prog.sessions.slice(-20);

  view = { currentEx, exId, exs, sessions, body, pr, unidad };

  el.innerHTML = `
    <header class="page-head" style="margin-bottom:12px">
      <h1>Progreso</h1>
    </header>

    <!-- Conmutador de 2 Pestañas: Ejercicio vs Peso Corporal -->
    <div class="seg progress-tabs" role="group" aria-label="Qué quieres ver">
      <button type="button" class="progress-tab-btn" data-action="switch-tab" data-tab="ejercicio" aria-pressed="${currentTab === 'ejercicio'}">
        Ejercicio
      </button>
      <button type="button" class="progress-tab-btn" data-action="switch-tab" data-tab="peso" aria-pressed="${currentTab === 'peso'}">
        Peso corporal
      </button>
    </div>

    <!-- Pestaña Ejercicio -->
    <div id="pane-ejercicio" ${currentTab !== 'ejercicio' ? 'hidden' : ''}>
      <!-- Hidden native select for picker.js synchronization -->
      <select id="progress-native-select" data-change="exercise" style="position:absolute;opacity:0;pointer-events:none;width:0;height:0" tabindex="-1" aria-hidden="true">
        ${exs.map((e) => `<option value="${e.id}" data-grupo="${esc(muscleName(e.grupo) || e.grupo)}" ${muscleFocus(e.nombre) ? `data-foco="${esc(muscleFocus(e.nombre))}"` : ''} ${isOwnExercise(e) ? 'data-propio="1"' : ''} ${e.id === exId ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('')}
      </select>

      <div id="ex-card-slot"></div>

      ${sessions.length ? `
        <div id="pr-slot"></div>
        <div id="compare-slot"></div>
        <div id="chart-card-slot"></div>
        <div id="sess-slot"></div>
      ` : `
        <div class="empty">
          ${icons.dumbbell({ size: 40, stroke: 'var(--line-strong)' })}
          <p>Todavía no hay series registradas de este ejercicio.</p>
          <a class="btn btn-primary" href="#/workout">${icons.plus({ size: 18 })} Ir a entrenar</a>
        </div>
      `}
    </div>

    <!-- Pestaña Peso Corporal -->
    <div id="pane-peso" ${currentTab !== 'peso' ? 'hidden' : ''}>
      ${bodySectionHtml(body, unidad)}
    </div>
  `;

  updateProgressView(el);

  // Delegación de eventos
  delegate(el, {
    'switch-tab': (t) => {
      const next = t.dataset.tab;
      if (!next || next === currentTab) return;
      currentTab = next;
      updateProgressView(el);
    },
    'open-picker': (t) => {
      const select = el.querySelector('#progress-native-select');
      if (!select) return;
      openPicker(select, 'Ejercicio', t);
    },
    'unit-toggle': async (t) => {
      const next = t.dataset.unit === 'lb' ? 'lb' : 'kg';
      const prev = weightUnit();
      if (next === prev) return;
      await saveSettings({ unidad: next });
      view.unidad = next;
      updateProgressView(el);
      toast(`Unidad cambiada a ${next.toUpperCase()}`);
    },
    metric: (t) => {
      const next = t.dataset.metric;
      if (!next || next === metric) return;
      metric = next;
      const chartCardSlot = el.querySelector('#chart-card-slot');
      if (chartCardSlot && view) {
        chartCardSlot.innerHTML = chartCardHtml(view.sessions, view.unidad);
        const metricSeg = chartCardSlot.querySelector('.metric-seg');
        if (metricSeg) requestAnimationFrame(() => syncSegThumb(metricSeg));
      }
    },
    'toggle-date-input': () => {
      const wrap = el.querySelector('#body-date-input-wrap');
      if (wrap) wrap.hidden = !wrap.hidden;
    },
    'del-body': async (t) => {
      const ok = await askConfirm({
        title: 'Borrar peso',
        body: 'Se eliminará este registro de peso corporal del historial.',
      });
      if (!ok) return;
      await deleteBodyMetric(Number(t.dataset.id));
      const body = await listBodyWeights();
      view.body = body;
      updateProgressView(el);
      toast('Registro de peso eliminado');
    },
  });

  // Listener para cambio en el selector de ejercicios
  const select = el.querySelector('#progress-native-select');
  if (select) {
    select.addEventListener('change', () => {
      go(`/progress/${select.value}`);
    });
  }

  // Formulario de peso corporal
  forms(el, {
    body: async (f) => {
      const rawVal = num(f.elements.peso?.value);
      if (!(rawVal > 0) || rawVal > 600) {
        toast('Escribe un peso válido.');
        return;
      }
      const pesoKg = toKg(rawVal, view.unidad);
      const fecha = f.elements.fecha?.value || todayISO();
      await addBodyWeight({ fecha, peso: pesoKg });
      const body = await listBodyWeights();
      view.body = body;
      updateProgressView(el);
      toast('Peso corporal guardado con éxito');
    },
  });

  // Editor y creador de ejercicios
  bindExerciseEdit(el, async (e) => {
    const id = Number(e.detail?.id);
    await openExerciseEditor(id, async (result) => {
      if (!result) return;
      if (result.deleted && result.id === exId) go('/progress');
      else await render(el, [String(exId)]);
      toast(result.deleted ? 'Ejercicio eliminado' : 'Ejercicio guardado');
    });
  });

  el.addEventListener('exercise-created', async (e) => {
    const { id, nombre } = e.detail;
    await render(el, [String(id)]);
    toast(`Ejercicio creado: «${nombre}»`);
  });
}
