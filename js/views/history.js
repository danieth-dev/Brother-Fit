import {
  listWorkoutSummaries,
  getWorkoutDetail,
  deleteWorkout,
  deleteSet,
  updateSet,
  muscleName,
  muscleFocus,
} from '../services/workouts.js';
import { delegate, esc, go, toast } from '../utils/dom.js';
import {
  formatLong,
  formatMedium,
  formatDuration,
  parseISO,
  startOfWeekISO,
  addDays,
  todayISO,
} from '../utils/dates.js';
import { icons } from '../utils/icons.js';
import { askConfirm } from '../utils/confirm-sheet.js';
import { weightUnit, fmtWeight, fmtVolume } from '../utils/units.js';

let editingSetId = null;
let editDraft = { peso: 0, reps: 0, tipo: 'trabajo', rir: 1 };
let selectedFilter = 'Todos';

const FILTER_GROUPS = [
  'Todos',
  'Pecho',
  'Espalda',
  'Piernas',
  'Hombros',
  'Tríceps',
  'Bíceps',
  'Core',
  'Cardio',
];

export async function render(el, [id]) {
  if (!id) editingSetId = null;
  return id ? detail(el, Number(id)) : list(el);
}

function workoutTitle(w) {
  if (!w.grupos || !w.grupos.length) return 'Entrenamiento';
  const gs = w.grupos;
  if (gs.length === 1) return gs[0];
  if (gs.length === 2) return `${gs[0]} y ${gs[1]}`;
  if (gs.length === 3) return `${gs[0]}, ${gs[1]} y ${gs[2]}`;
  return `${gs[0]}, ${gs[1]} (+${gs.length - 2})`;
}

function formatWeekRange(mondayISO) {
  const currentWeekMonday = startOfWeekISO(todayISO());
  if (mondayISO === currentWeekMonday) return 'Esta semana';
  const mD = parseISO(mondayISO);
  const sD = parseISO(addDays(mondayISO, 6));
  const mMonth = mD.toLocaleDateString('es', { month: 'short' }).replace(/\./g, '');
  const sMonth = sD.toLocaleDateString('es', { month: 'short' }).replace(/\./g, '');
  if (mD.getMonth() === sD.getMonth()) {
    return `${mD.getDate()} – ${sD.getDate()} ${sMonth}`;
  }
  return `${mD.getDate()} ${mMonth} – ${sD.getDate()} ${sMonth}`;
}

function formatDateBox(fechaISO) {
  const d = parseISO(fechaISO);
  const dayNum = d.getDate();
  const dayName = d.toLocaleDateString('es', { weekday: 'short' }).replace(/\./g, '').slice(0, 3).toUpperCase();
  return { dayNum, dayName };
}

function workoutDots(w) {
  if (!w.grupos || !w.grupos.length) return '';
  return `<span class="history-card-dots">${w.grupos.slice(0, 3).map((g) => `<span class="history-card-dot muscle-dot" data-g="${esc(g)}" aria-hidden="true"></span>`).join('')}</span>`;
}

function workoutCard(w, unidad) {
  const { dayNum, dayName } = formatDateBox(w.fecha);
  const dots = workoutDots(w);
  const enCurso = !w.finishedAt
    ? '<span class="chip chip-warn history-card-active-chip">En curso</span>'
    : '';
  return `
    <a class="history-workout-card" href="#/history/${w.id}">
      <div class="history-card-date">
        <span class="history-card-daynum">${dayNum}</span>
        <span class="history-card-dayname">${esc(dayName)}</span>
      </div>
      <div class="history-card-main">
        <strong class="history-card-name">${esc(workoutTitle(w))}</strong>
        <div class="history-card-info">
          ${dots}
          <span>${w.totalSets} ${w.totalSets === 1 ? 'serie' : 'series'} · ${fmtVolume(w.volumen, unidad)} ${esc(unidad)}</span>
          ${enCurso}
        </div>
      </div>
      <span class="history-card-chev" aria-hidden="true">${icons.chevronRight({ size: 16 })}</span>
    </a>
  `;
}

async function list(el) {
  const items = await listWorkoutSummaries();
  const unidad = weightUnit();

  const filteredItems = selectedFilter === 'Todos'
    ? items
    : items.filter((w) => w.grupos && w.grupos.includes(selectedFilter));

  // Agrupamiento cronológico por semana (lunes como inicio de semana ISO)
  const weeksMap = new Map();
  for (const w of filteredItems) {
    const weekStart = startOfWeekISO(w.fecha);
    if (!weeksMap.has(weekStart)) {
      weeksMap.set(weekStart, []);
    }
    weeksMap.get(weekStart).push(w);
  }

  const weeksHtml = Array.from(weeksMap.entries()).map(([weekStart, weekWorkouts]) => {
    const count = weekWorkouts.length;
    const totalVol = weekWorkouts.reduce((acc, w) => acc + (w.volumen || 0), 0);
    const title = formatWeekRange(weekStart);
    const cards = weekWorkouts.map((w) => workoutCard(w, unidad)).join('');
    return `
      <section class="history-week-section">
        <div class="history-week-head">
          <h2 class="history-week-title">${esc(title)}</h2>
          <span class="history-week-meta">${count} ${count === 1 ? 'entreno' : 'entrenos'} · ${fmtVolume(totalVol, unidad)} ${esc(unidad)}</span>
        </div>
        <div class="history-cards-list">
          ${cards}
        </div>
      </section>
    `;
  }).join('');

  const emptyHtml = items.length === 0
    ? `
      <div class="empty history-empty">
        ${icons.dumbbell({ size: 40, stroke: 'var(--line-strong)' })}
        <p>Aquí aparecerán tus entrenamientos completados.</p>
        <a class="btn btn-primary" href="#/workout">${icons.plus({ size: 18 })} Iniciar entrenamiento</a>
      </div>`
    : filteredItems.length === 0
    ? `
      <div class="empty history-empty">
        ${icons.dumbbell({ size: 40, stroke: 'var(--line-strong)' })}
        <p>No tienes entrenamientos de <strong>${esc(selectedFilter)}</strong> en el historial.</p>
        <button class="btn btn-secondary" data-action="reset-filter" type="button">Ver todos los entrenamientos</button>
      </div>`
    : '';

  el.innerHTML = `
    <!-- ═══ 1. CABECERA HISTORIAL ═══ -->
    <div class="history-head">
      <a class="head-back" href="#/" aria-label="Volver a Inicio">${icons.chevronLeft({ size: 24 })}</a>
      <h1 class="history-title">Historial</h1>
    </div>

    <!-- ═══ 2. BARRA DE FILTROS POR GRUPO MUSCULAR ═══ -->
    <div class="history-filters-outer">
      <div class="history-filters-scroll" role="tablist" aria-label="Filtrar por grupo muscular">
        ${FILTER_GROUPS.map((g) => `
          <button class="history-filter-pill ${selectedFilter === g ? 'is-active' : ''}"
                  data-action="filter-group"
                  data-group="${esc(g)}"
                  type="button"
                  role="tab"
                  aria-selected="${selectedFilter === g}">
            ${esc(g)}
          </button>
        `).join('')}
      </div>
      <div class="history-filters-fade" aria-hidden="true"></div>
    </div>

    <!-- ═══ 3. LISTADO AGRUPADO POR SEMANAS O ESTADO VACÍO ═══ -->
    ${filteredItems.length ? `
      <div class="history-weeks-container">
        ${weeksHtml}
      </div>`
      : emptyHtml}
  `;

  delegate(el, {
    'filter-group': (btn) => {
      selectedFilter = btn.dataset.group || 'Todos';
      list(el);
    },
    'reset-filter': () => {
      selectedFilter = 'Todos';
      list(el);
    },
  });
}

function setBadgeHtml(s) {
  if (s.tipo === 'calentamiento') {
    return `<span class="workout-set-badge tag-warm">calentamiento</span>`;
  }
  if (s.rpe != null && s.rpe !== '') {
    const rir = 10 - Number(s.rpe);
    if (rir === 0) return `<span class="workout-set-badge tag-limit">al límite</span>`;
    if (rir === 1) return `<span class="workout-set-badge tag-rir">te sobraba 1</span>`;
    if (rir >= 4) return `<span class="workout-set-badge tag-rir">sobraban 4+</span>`;
    return `<span class="workout-set-badge tag-rir">sobraban ${rir}</span>`;
  }
  return `<span class="workout-set-badge tag-missing">falta esfuerzo</span>`;
}

async function detail(el, id) {
  const d = await getWorkoutDetail(id);
  if (!d) {
    el.innerHTML = `
      <div class="empty">
        <p>No encontramos ese entrenamiento.</p>
        <a class="btn" href="#/history">${icons.chevronLeft({ size: 18 })} Volver al historial</a>
      </div>`;
    return;
  }
  const unidad = weightUnit();
  const { workout: w } = d;

  el.innerHTML = `
    <!-- ═══ 1. CABECERA MODERNA CON REGRESO Y MENÚ DE OPCIONES ═══ -->
    <div class="workout-detail-head">
      <div class="workout-detail-head-left">
        <a class="head-back" href="#/history" aria-label="Volver al historial">${icons.chevronLeft({ size: 24 })}</a>
        <div>
          <h1 class="workout-detail-title">${esc(formatLong(w.fecha))}</h1>
          <p class="workout-detail-sub">${esc(workoutTitle(w))} · <span class="workout-detail-duration">${w.duracion ? formatDuration(w.duracion) : 'En curso'}</span> de duración</p>
        </div>
      </div>
      <div class="workout-detail-head-right">
        <button class="btn-x workout-detail-menu-btn" data-action="menu-workout" type="button" aria-label="Más opciones: borrar entrenamiento" title="Más opciones">
          ${icons.dots({ size: 22 })}
        </button>
      </div>
    </div>

    <!-- ═══ 2. TARJETA UNIFICADA DE 3 MÉTRICAS ═══ -->
    <div class="workout-detail-metrics">
      <div>
        <p class="workout-detail-metric-val">${d.totalSets}</p>
        <p class="workout-detail-metric-lbl">${d.totalSets === 1 ? 'serie' : 'series'}</p>
      </div>
      <div>
        <p class="workout-detail-metric-val">${d.groups.length}</p>
        <p class="workout-detail-metric-lbl">${d.groups.length === 1 ? 'ejercicio' : 'ejercicios'}</p>
      </div>
      <div>
        <p class="workout-detail-metric-val">${fmtVolume(d.volumen, unidad)}</p>
        <p class="workout-detail-metric-lbl">${esc(unidad)} de volumen</p>
      </div>
    </div>

    <!-- ═══ 3. TARJETAS DE EJERCICIOS CON CABECERA TÁCTICA ═══ -->
    ${d.groups.length ? d.groups.map((g) => {
      const gName = muscleName(g.exercise.grupo) || g.exercise.grupo;
      const focus = muscleFocus(g.exercise.nombre);
      const subInfo = `${esc(gName)}${focus ? ` · ${esc(focus)}` : ''}`;

      return `
        <div class="workout-ex-card">
          <div class="workout-ex-card-head">
            <div class="workout-ex-title-wrap">
              <p class="workout-ex-title">
                <span class="dot" data-g="${esc(gName)}" aria-hidden="true"></span>
                ${esc(g.exercise.nombre)}
              </p>
              <p class="workout-ex-sub">${subInfo}</p>
            </div>
            <a href="#/progress/${g.exercise.id}" class="workout-ex-progress-link" title="Ver progreso de ${esc(g.exercise.nombre)}">
              Ver progreso ${icons.chevronRight({ size: 14 })}
            </a>
          </div>

          <!-- ═══ 4 & 5. FILAS DE SERIES Y EDITOR INLINE ═══ -->
          <div class="workout-sets-table">
            ${g.sets.map((s, i) => {
              const isEditing = editingSetId === s.id;
              const weightDisplay = s.peso === 0
                ? `Sin peso × ${s.reps}`
                : `${fmtWeight(s.peso, unidad)} ${esc(unidad)} × ${s.reps}`;

              return `
                <div class="workout-set-wrap">
                  <button type="button" class="workout-set-row-btn ${isEditing ? 'is-active' : ''}" data-action="toggle-edit-set" data-id="${s.id}" aria-expanded="${isEditing}">
                    <span class="workout-set-n">Serie ${i + 1}</span>
                    <span class="workout-set-val">${weightDisplay}</span>
                    ${setBadgeHtml(s)}
                    <span class="workout-set-chev" aria-hidden="true">${icons.chevronRight({ size: 16 })}</span>
                  </button>

                  ${isEditing ? `
                    <div class="set-inline-editor" id="set-editor-${s.id}">
                      <div class="editor-steppers-grid">
                        <div class="editor-stepper">
                          <button type="button" class="stepper-btn" data-action="step-weight" data-delta="-2.5" aria-label="Restar peso">−</button>
                          <div class="stepper-display">
                            <input type="text" inputmode="decimal" autocomplete="off" class="stepper-input" id="edit-peso-input" value="${editDraft.peso}">
                            <span class="stepper-unit">${esc(unidad)}</span>
                          </div>
                          <button type="button" class="stepper-btn" data-action="step-weight" data-delta="2.5" aria-label="Sumar peso">+</button>
                        </div>

                        <div class="editor-stepper">
                          <button type="button" class="stepper-btn" data-action="step-reps" data-delta="-1" aria-label="Restar repeticiones">−</button>
                          <div class="stepper-display">
                            <input type="text" inputmode="numeric" autocomplete="off" class="stepper-input" id="edit-reps-input" value="${editDraft.reps}">
                            <span class="stepper-unit">reps</span>
                          </div>
                          <button type="button" class="stepper-btn" data-action="step-reps" data-delta="1" aria-label="Sumar repeticiones">+</button>
                        </div>
                      </div>

                      <div class="editor-tipo-bar" role="group" aria-label="Tipo de serie">
                        <button type="button" class="editor-tipo-btn" data-action="edit-tipo" data-tipo="trabajo" aria-pressed="${editDraft.tipo === 'trabajo'}">Trabajo</button>
                        <button type="button" class="editor-tipo-btn" data-action="edit-tipo" data-tipo="calentamiento" aria-pressed="${editDraft.tipo === 'calentamiento'}">Calentamiento</button>
                      </div>

                      <div class="editor-effort-wrap" id="editor-effort-wrap" style="display: ${editDraft.tipo === 'calentamiento' ? 'none' : 'block'};">
                        <p class="editor-effort-label">¿Cuántas más podías hacer?</p>
                        <div class="editor-rir-grid" role="group" aria-label="Esfuerzo RIR">
                          ${[0, 1, 2, 3, 4].map((r) => `
                            <button type="button" class="editor-rir-btn" data-action="edit-rir" data-rir="${r}" aria-pressed="${editDraft.rir === r}">
                              ${r === 4 ? '4+' : r}
                            </button>
                          `).join('')}
                        </div>
                      </div>

                      <div class="editor-actions-row">
                        <button type="button" class="btn-text-danger" data-action="del-set" data-id="${s.id}">Eliminar serie</button>
                        <button type="button" class="editor-save-btn" data-action="save-set" data-id="${s.id}">Guardar cambios</button>
                      </div>
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('') : '<div class="empty"><p>Este entrenamiento no tiene series.</p></div>'}
  `;

  // Attach live input typing listeners if editor is active
  const pesoInp = el.querySelector('#edit-peso-input');
  if (pesoInp) {
    pesoInp.addEventListener('input', () => { editDraft.peso = Number(pesoInp.value) || 0; });
  }
  const repsInp = el.querySelector('#edit-reps-input');
  if (repsInp) {
    repsInp.addEventListener('input', () => { editDraft.reps = Number(repsInp.value) || 1; });
  }

  const handleToggleEditSet = async (btn) => {
    const sid = Number(btn.dataset.id);
    if (editingSetId === sid) {
      editingSetId = null;
    } else {
      editingSetId = sid;
      const targetSet = d.groups.flatMap((g) => g.sets).find((s) => s.id === sid);
      if (targetSet) {
        editDraft = {
          peso: targetSet.peso,
          reps: targetSet.reps,
          tipo: targetSet.tipo || 'trabajo',
          rir: targetSet.rpe != null ? 10 - Number(targetSet.rpe) : 1,
        };
      }
    }
    await detail(el, id);
  };

  delegate(el, {
    'toggle-edit-set': handleToggleEditSet,
    toggleEditSet: handleToggleEditSet,

    'step-weight': (btn) => {
      const delta = Number(btn.dataset.delta);
      const input = el.querySelector('#edit-peso-input');
      const current = Number(input?.value || editDraft.peso || 0);
      const next = Math.max(0, Math.round((current + delta) * 10) / 10);
      editDraft.peso = next;
      if (input) input.value = next;
    },

    'step-reps': (btn) => {
      const delta = Number(btn.dataset.delta);
      const input = el.querySelector('#edit-reps-input');
      const current = Number(input?.value || editDraft.reps || 1);
      const next = Math.max(1, Math.round(current + delta));
      editDraft.reps = next;
      if (input) input.value = next;
    },

    'edit-tipo': (btn) => {
      editDraft.tipo = btn.dataset.tipo === 'calentamiento' ? 'calentamiento' : 'trabajo';
      el.querySelectorAll('[data-action="edit-tipo"]').forEach((b) => {
        b.setAttribute('aria-pressed', b.dataset.tipo === editDraft.tipo ? 'true' : 'false');
      });
      const effortWrap = el.querySelector('#editor-effort-wrap');
      if (effortWrap) effortWrap.style.display = editDraft.tipo === 'calentamiento' ? 'none' : 'block';
    },

    'edit-rir': (btn) => {
      editDraft.rir = Number(btn.dataset.rir);
      el.querySelectorAll('[data-action="edit-rir"]').forEach((b) => {
        b.setAttribute('aria-pressed', Number(b.dataset.rir) === editDraft.rir ? 'true' : 'false');
      });
    },

    'save-set': async (btn) => {
      const sid = Number(btn.dataset.id);
      const pesoInput = el.querySelector('#edit-peso-input');
      const repsInput = el.querySelector('#edit-reps-input');
      const finalPeso = pesoInput ? Number(pesoInput.value) : editDraft.peso;
      const finalReps = repsInput ? Number(repsInput.value) : editDraft.reps;

      if (Number.isNaN(finalPeso) || finalPeso < 0) {
        toast('El peso no es válido', { tone: 'warn' });
        return;
      }
      if (Number.isNaN(finalReps) || finalReps <= 0) {
        toast('Las repeticiones deben ser al menos 1', { tone: 'warn' });
        return;
      }

      btn.disabled = true;
      await updateSet(sid, {
        peso: finalPeso,
        reps: finalReps,
        tipo: editDraft.tipo,
        rir: editDraft.tipo === 'calentamiento' ? null : editDraft.rir,
      });

      editingSetId = null;
      toast('Serie actualizada');
      await detail(el, id);
    },

    'del-set': async (btn) => {
      const sid = Number(btn.dataset.id);
      const ok = await askConfirm({
        title: '¿Eliminar serie?',
        body: 'Esta serie se eliminará del entrenamiento y se recalcularán las métricas.',
        confirmLabel: 'Eliminar serie',
        confirmDanger: true,
      });
      if (!ok) return;

      await deleteSet(sid);
      editingSetId = null;
      toast('Serie eliminada');
      await detail(el, id);
    },

    'menu-workout': async () => {
      const ok = await askConfirm({
        title: '¿Borrar entrenamiento?',
        body: 'Se eliminarán este entrenamiento y todas sus series. Esta acción no se puede deshacer.',
        confirmLabel: 'Borrar entrenamiento',
        confirmDanger: true,
      });
      if (!ok) return;
      await deleteWorkout(id);
      toast('Entrenamiento eliminado');
      go('/history');
    },
  });
}
