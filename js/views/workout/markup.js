/* Plantillas de la pantalla Entreno. Reciben datos y devuelven HTML; no escuchan nada. */
import { muscleName, muscleFocus, isOwnExercise } from '../../services/workouts.js';
import { restZone, workoutTitle } from '../../services/session-plan.js';
import { esc } from '../../utils/dom.js';
import { formatShort, formatWeekdayShort } from '../../utils/dates.js';
import { icons } from '../../utils/icons.js';
import { effortTag, effortExtra, rirButtons } from '../../utils/set-line.js';
import { fmtWeight, fmtVolume, unitSegHtml } from '../../utils/units.js';

export const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export const weightStep = (unidad) => (unidad === 'lb' ? '5' : '2,5');

const kgSpan = (peso, unidad) =>
  `<span data-kg="${peso}">${fmtWeight(peso, unidad)}</span> <span data-unit>${esc(unidad)}</span>`;

/* ---------- Sin entreno ---------- */

function repeatCard(pw, unidad) {
  const title = workoutTitle(pw.grupos);
  return `
    <div class="repeat-card">
      <div class="repeat-card-info">
        <p class="repeat-card-title">${esc(title)}</p>
        <p class="repeat-card-sub">
          <span class="muscle-dot" data-g="${esc(pw.grupos[0] || 'Otro')}" aria-hidden="true"></span>
          <span>${esc(formatWeekdayShort(pw.fecha))} · ${pw.totalSets} series · ${fmtVolume(pw.volumen, unidad)} ${esc(unidad)}</span>
        </p>
      </div>
      <button class="repeat-card-btn" data-action="repeat" data-id="${pw.id}" type="button" aria-label="Repetir entrenamiento de ${esc(title)}">
        ${icons.repeat({ size: 16 })} Repetir
      </button>
    </div>`;
}

export function idleMarkup(pastWorkouts, unidad) {
  return `
    <header class="page-head">
      <div class="page-head-row">
        <div>
          <h1>Entreno</h1>
          <p class="workout-status-idle">Sin entrenamiento en curso</p>
        </div>
        <a class="head-link" href="#/agent" aria-label="Bía">${icons.bot({ size: 22 })}</a>
      </div>
    </header>

    <div class="workout-empty-view">
      <button class="btn-start-hero" data-action="start" type="button" id="btn-start-empty">
        ${icons.plus({ size: 22 })} Iniciar entrenamiento vacío
      </button>
      ${pastWorkouts.length ? `
        <section class="repeat-section">
          <div class="repeat-section-head">
            <h2>O empieza desde uno anterior</h2>
            <p>Carga los mismos ejercicios y pesos de esa sesión.</p>
          </div>
          <div class="repeat-list">${pastWorkouts.map((pw) => repeatCard(pw, unidad)).join('')}</div>
        </section>
      ` : ''}
    </div>`;
}

/* ---------- Descanso ---------- */

const restClock = (left) => `<span>${icons.clock({ size: 18 })} Descanso <strong class="num">${mmss(left)}</strong></span>`;

/**
 * Aviso de descanso. En una rutina ofrece pasar al siguiente ejercicio o terminar;
 * fuera de ella, el tiempo, la zona (modo automático) y «Saltar».
 */
export function restMarkup({ left, nextExObj, isExCompleted, curExName, lastReps, autoRest }) {
  if (left <= 0) return '';
  if (nextExObj) {
    const hint = isExCompleted
      ? `Completaste las series de ${esc(curExName || 'este ejercicio')}`
      : `Siguiente en la rutina: ${esc(nextExObj.nombre)}`;
    return `<div class="rest rest--next-ex">
      <div class="rest-top">
        ${restClock(left)}
        <button class="btn btn-sm btn-primary" data-action="next-exercise" data-id="${nextExObj.id}" type="button">
          Pasar a ${esc(nextExObj.nombre)} ${icons.chevronRight({ size: 14 })}
        </button>
      </div>
      <p class="rest-next-hint">${hint}</p>
    </div>`;
  }
  if (isExCompleted) {
    return `<div class="rest rest--next-ex">
      <div class="rest-top">
        ${restClock(left)}
        <button class="btn btn-sm btn-primary" data-action="finish" type="button">
          ${icons.check({ size: 16 })} Terminar sesión
        </button>
      </div>
      <p class="rest-next-hint">Completaste todos los ejercicios de la rutina.</p>
    </div>`;
  }
  const zone = autoRest ? restZone(lastReps).label : '';
  return `<div class="rest">
    ${restClock(left)}
    ${zone ? `<span class="rest-zone">${zone}</span>` : ''}
    <button class="btn btn-sm" data-action="skip-rest" type="button">Saltar</button>
  </div>`;
}

/* ---------- Serie ---------- */

function refEffort(s) {
  if (s.tipo === 'calentamiento') return 'calentamiento';
  if (s.rir == null) return '';
  return s.rir === 0 ? 'al límite' : `sobraba ${s.rir}`;
}

/* La sesión anterior del ejercicio en tarjetas; la que toca superar va marcada. */
export function setRefMarkup(prev, curSets, unidad) {
  const sets = prev?.sets || [];
  if (!sets.length) {
    return `<div class="set-ref-card-wrap set-ref-card-wrap--empty" id="set-ref">
      <p class="set-ref--empty">Primera vez con este ejercicio. Establece tu marca.</p>
    </div>`;
  }
  const past = curSets.length >= sets.length;
  const cards = sets.map((s, i) => {
    const isTarget = i === curSets.length;
    const effort = refEffort(s);
    return `
      <div class="set-ref-card ${isTarget ? 'is-target' : ''}">
        <span class="ref-card-num">Serie ${i + 1}</span>
        <span class="ref-card-reps ${isTarget ? 'text-primary' : ''}">${s.reps}</span>
        <span class="ref-card-detail">${kgSpan(s.peso, unidad)}</span>
        ${effort ? `<span class="ref-card-detail muted">${effort}</span>` : ''}
      </div>`;
  }).join('');
  return `<div class="set-ref-card-wrap" id="set-ref">
    <div class="set-ref-card-head">
      <span>Última vez · <strong>${esc(formatShort(prev.workout.fecha))}</strong></span>
      ${past ? '<span class="set-ref-badge-done">Completada</span>' : ''}
    </div>
    <div class="set-ref-cards">${cards}</div>
    ${past ? `<p class="set-ref-note">Ya pasaste la sesión anterior (${sets.length} series).</p>` : ''}
  </div>`;
}

function exerciseHeading(ex) {
  const grupo = muscleName(ex.grupo);
  const foco = muscleFocus(ex.nombre);
  const muscle = grupo
    ? `<span class="muscle">${esc(grupo)}${foco ? `<span class="muscle-focus">${esc(foco)}</span>` : ''}</span>`
    : '';
  return `<h3><i class="dot" data-g="${esc(grupo || ex.grupo)}"></i>${esc(ex.nombre)}${muscle}</h3>`;
}

export function todayLogMarkup(groups, unidad, { open, openEffortId }) {
  const n = groups.reduce((sum, g) => sum + g.sets.length, 0);
  if (!n) return '';
  return `<details class="today-log"${open ? ' open' : ''}>
    <summary>
      <span>Series de hoy</span>
      <span class="today-log-meta"><span class="section-count">${n}</span>${icons.chevronDown({ size: 18, cls: 'muted' })}</span>
    </summary>
    ${groups.map((g) => `
      <div class="group">
        ${exerciseHeading(g.exercise)}
        <ul class="sets">
          ${g.sets.map((s, i) => `
            <li>
              <span class="n">Serie ${i + 1}</span>
              <span class="v">${kgSpan(s.peso, unidad)} × ${s.reps}${effortTag(s)}</span>
              <button class="btn-x" data-action="del-set" data-id="${s.id}" type="button" aria-label="Borrar serie ${i + 1} de ${esc(g.exercise.nombre)}">
                ${icons.trash({ size: 15 })}
              </button>
              ${effortExtra(s, openEffortId)}
            </li>`).join('')}
        </ul>
      </div>`).join('')}
  </details>`;
}

function routineBar(w, routineIdx, groups, selectedEx, exs) {
  const total = w.routineExercises.length;
  const dots = w.routineExercises.map((id) => {
    const done = groups.some((g) => g.exercise.id === id && g.sets.length > 0);
    const name = exs.find((e) => e.id === id)?.nombre || '';
    return `<span class="routine-dot ${done ? 'is-done' : ''} ${id === selectedEx ? 'is-cur' : ''}" title="${esc(name)}" aria-hidden="true"></span>`;
  }).join('');
  return `
    <div class="routine-progress-bar">
      <div class="routine-progress-info">
        <span class="routine-tag">${icons.repeat({ size: 12 })} ${esc(w.routineTitle || 'Rutina')}</span>
        <span class="routine-step">${routineIdx >= 0 ? `Ejercicio ${routineIdx + 1} de ${total}` : 'Ejercicio adicional'}</span>
      </div>
      <div class="routine-dots">${dots}</div>
    </div>`;
}

function exerciseOption(e, { selectedEx, todayIds }) {
  const grupo = muscleName(e.grupo) || e.grupo;
  const foco = muscleFocus(e.nombre);
  const attrs = [
    `value="${e.id}"`,
    `data-grupo="${esc(grupo)}"`,
    todayIds.has(e.id) ? 'data-hoy="1"' : '',
    foco ? `data-foco="${esc(foco)}"` : '',
    isOwnExercise(e) ? 'data-propio="1"' : '',
    e.id === selectedEx ? 'selected' : '',
  ].filter(Boolean).join(' ');
  return `<option ${attrs}>${esc(e.nombre)}</option>`;
}

function weightCard(unidad) {
  return `
    <div class="workout-input-card">
      <div class="input-card-head">
        <span>Peso</span>
        ${unitSegHtml(unidad)}
      </div>
      <div class="input-card-display">
        <input name="peso" class="big-num-input" inputmode="decimal" autocomplete="off" required placeholder="0" aria-label="Peso">
        <span class="input-card-unit" data-unit>${esc(unidad)}</span>
      </div>
      <div class="input-card-actions">
        <button type="button" class="stepper-step-btn" data-action="step-peso" data-dir="-1" aria-label="Bajar peso">
          <span data-step-peso-down>−${weightStep(unidad)}</span>
        </button>
        <button type="button" class="stepper-step-btn" data-action="step-peso" data-dir="1" aria-label="Subir peso">
          <span data-step-peso-up>+${weightStep(unidad)}</span>
        </button>
      </div>
    </div>`;
}

const REPS_CARD = `
  <div class="workout-input-card">
    <div class="input-card-head">
      <span>Repeticiones</span>
    </div>
    <div class="input-card-display">
      <input name="reps" class="big-num-input" inputmode="numeric" pattern="[0-9]*" autocomplete="off" required placeholder="0" aria-label="Repeticiones">
      <span class="input-card-unit">reps</span>
    </div>
    <div class="input-card-actions">
      <button type="button" class="stepper-step-btn" data-action="step-reps" data-dir="-1" aria-label="Bajar repeticiones">−1</button>
      <button type="button" class="stepper-step-btn" data-action="step-reps" data-dir="1" aria-label="Subir repeticiones">+1</button>
    </div>
  </div>`;

function effortPicker(draftTipo, draftRir) {
  const warm = draftTipo !== 'trabajo';
  return `
    <div id="rir-pick" class="stack">
      <span class="effort-label">¿Cuántas más podrías haber hecho?</span>
      ${rirButtons('', { action: 'draft-rir', pressed: draftRir, disabled: warm })}
      <div class="rir-scale-legend" id="rir-scale-legend" ${warm ? 'hidden' : ''}>
        <span class="rir-legend-left">0 = al límite, no salía otra</span>
        <span class="rir-legend-right">Sobrado</span>
      </div>
    </div>`;
}

/**
 * Pantalla con entreno en curso.
 * v: { w, exs, orderedExs, groups, selectedEx, todayIds, routineIdx, inRoutine, nextSetNum,
 *      targetSet, prev, curExSets, unidad, elapsed, restHtml, draftTipo, draftRir, todayLog }
 */
export function activeMarkup(v) {
  const target = v.targetSet
    ? `<p class="workout-set-target">A superar: <strong>${kgSpan(v.targetSet.peso, v.unidad)} × ${v.targetSet.reps}</strong></p>`
    : '<p class="workout-set-target">Primera sesión</p>';
  return `
    <header class="page-head">
      <div class="page-head-row">
        <h1>Entreno</h1>
        <a class="head-link" href="#/agent" aria-label="Bía">${icons.bot({ size: 22 })}</a>
      </div>
      <p class="workout-status"><span class="status-dot" aria-hidden="true"></span>En curso · <span class="elapsed" id="elapsed">${v.elapsed}</span></p>
    </header>

    ${v.inRoutine ? routineBar(v.w, v.routineIdx, v.groups, v.selectedEx, v.exs) : ''}

    <div id="rest">${v.restHtml}</div>

    <form class="form-card stack set-form" data-form="set">
      <label class="field">
        <span>Ejercicio</span>
        <select name="exerciseId" data-change="exercise">
          ${v.orderedExs.map((e) => exerciseOption(e, v)).join('')}
        </select>
      </label>

      <div class="workout-set-header">
        <div class="workout-set-title-wrap">
          <span class="workout-set-title">Serie ${v.nextSetNum}</span>
          ${target}
        </div>
        <div class="seg tipo-seg" role="group" aria-label="Tipo de serie" id="draft-tipo-seg">
          <button type="button" data-action="draft-tipo" data-tipo="trabajo" aria-pressed="${v.draftTipo === 'trabajo'}">Trabajo</button>
          <button type="button" data-action="draft-tipo" data-tipo="calentamiento" aria-pressed="${v.draftTipo === 'calentamiento'}">Calentamiento</button>
        </div>
      </div>

      ${setRefMarkup(v.prev, v.curExSets, v.unidad)}

      <div class="workout-inputs-grid">
        ${weightCard(v.unidad)}
        ${REPS_CARD}
      </div>

      ${effortPicker(v.draftTipo, v.draftRir)}

      <button class="btn btn-primary btn-block btn-lg set-submit" type="submit" data-set-submit data-n="${v.nextSetNum}">
        ${icons.plus({ size: 18 })} Guardar serie ${v.nextSetNum}
      </button>
    </form>

    ${v.todayLog}

    <div class="workout-end">
      <button class="btn btn-outline btn-block" data-action="finish" type="button">
        ${icons.check({ size: 20 })} Terminar sesión
      </button>
      <button class="btn-text-danger" data-action="discard" type="button">Descartar entreno</button>
    </div>`;
}

