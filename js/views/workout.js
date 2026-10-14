import {
  getActiveWorkout, startWorkout, finishWorkout, finishWorkoutSummary, deleteWorkout, listExercises, addExercise, muscleName, isOwnExercise,
  addSet, deleteSet, getWorkoutDetail, lastSessionSetsFor, prByExercise, GRUPOS,
  loadActiveRest, saveActiveRest, clearActiveRest
} from '../services/workouts.js';
import { getActiveAgent, saveMemory } from '../services/agent.js';
import { state } from '../store.js';
import { delegate, forms, changes, toast, esc, num, fmtNum, go } from '../utils/dom.js';
import { formatDuration, formatShort } from '../utils/dates.js';
import { icons } from '../utils/icons.js';
import { bindExerciseEdit, openExerciseEditor } from '../utils/exercise-editor.js';

let selectedEx = null;
let restEnd = 0;
let lastReps = 0;

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function smartRest(reps) {
  if (reps <= 5) return 180;  // 3:00 — Fuerza/Potencia
  if (reps <= 8) return 120;  // 2:00 — Fuerza-Hipertrofia
  if (reps <= 12) return 90;  // 1:30 — Hipertrofia
  return 60;                  // 1:00 — Resistencia
}

function restZoneLabel() {
  if (state.settings.descansoMode !== 'auto') return '';
  if (lastReps <= 5) return 'Fuerza · 3 min';
  if (lastReps <= 8) return 'Fuerza-Hipertrofia · 2 min';
  if (lastReps <= 12) return 'Hipertrofia · 1:30';
  return 'Resistencia · 1 min';
}

function restMarkup() {
  const left = Math.ceil((restEnd - Date.now()) / 1000);
  if (left <= 0) return '';
  const zone = restZoneLabel();
  return `<div class="rest">
    <span>${icons.clock({ size: 18, stroke: 'var(--primary)' })} Descanso <strong class="num">${mmss(left)}</strong></span>
    ${zone ? `<span class="rest-zone">${zone}</span>` : ''}
    <button class="btn btn-sm" data-action="skip-rest" type="button">Saltar</button>
  </div>`;
}

function prevSessionMarkup(prev, unidad) {
  if (!prev) {
    return `<div class="prev-session prev-session--empty">
      <span>${icons.dumbbell({ size: 14, stroke: 'var(--text-dim)' })} Primera vez · ¡sé el primero en marcar un PR!</span>
    </div>`;
  }
  const fecha = formatShort(prev.workout.fecha);
  const rows = prev.sets.map((s, i) => `
    <div class="prev-row">
      <span class="prev-row-n">S${i + 1}</span>
      <span class="prev-row-v">${fmtNum(s.peso)} <small>${esc(unidad)}</small> × <strong>${s.reps}</strong>${s.rpe ? `<span class="rpe-tag">RPE ${fmtNum(s.rpe)}</span>` : ''}</span>
    </div>`).join('');
  return `<div class="prev-session">
    <div class="prev-session-head">
      ${icons.clock({ size: 13, stroke: 'var(--primary)' })}
      <span>Sesión anterior <strong>${esc(fecha)}</strong></span>
    </div>
    <div class="prev-rows">${rows}</div>
  </div>`;
}

export async function render(el) {
  const w = await getActiveWorkout();

  if (!w) {
    restEnd = 0;
    clearActiveRest();
    el.innerHTML = `
      <header class="page-head"><h1>Entreno</h1></header>
      <div class="empty">
        ${icons.dumbbell({ size: 42, stroke: 'var(--line-strong)' })}
        <p>No hay un entrenamiento en curso. Inicia una sesión cuando estés listo para levantar.</p>
        <button class="btn btn-primary" data-action="start" type="button">
          ${icons.plus({ size: 20 })} Iniciar entrenamiento
        </button>
      </div>`;
    delegate(el, { start: async (b) => { b.disabled = true; await startWorkout(); await render(el); } });
    return;
  }

  const [exs, detail] = await Promise.all([listExercises(), getWorkoutDetail(w.id)]);
  if (restEnd <= Date.now()) {
    const saved = await loadActiveRest();
    if (saved) {
      restEnd = saved.restEnd;
      lastReps = saved.lastReps || 0;
    } else {
      restEnd = 0;
    }
  }
  if (!exs.some((e) => e.id === selectedEx)) selectedEx = exs[0]?.id ?? null;
  const unidad = state.settings.unidad;

  state.activeWorkoutId = w.id;
  const currentExObj = exs.find((e) => e.id === selectedEx);
  state.activeExercise = currentExObj ? { id: currentExObj.id, nombre: currentExObj.nombre, grupo: currentExObj.grupo } : null;

  const [prev, pr] = await Promise.all([
    selectedEx ? lastSessionSetsFor(selectedEx) : null,
    selectedEx ? prByExercise(selectedEx) : null,
  ]);

  const curExSets = detail?.groups?.find((g) => g.exercise.id === selectedEx)?.sets || [];
  const nextSetNum = curExSets.length + 1;
  const lastSet = curExSets[curExSets.length - 1];
  const expectedPeso = lastSet?.peso ?? prev?.sets?.[0]?.peso ?? 0;
  const prevMark = prev?.sets?.[0] ? `${fmtNum(prev.sets[0].peso)} ${unidad} × ${prev.sets[0].reps}` : 'ninguna';

  // Inyección 2: Hueco explícito de la serie abierta y pendiente
  getActiveAgent()?.sendContext(
    `No lo digas en voz alta. ${currentExObj?.nombre}: serie ${nextSetNum} abierta y pendiente. Carga esperada: ${fmtNum(expectedPeso)} ${unidad}. Marca anterior: ${prevMark}. Si el atleta pide registrar serie, usa registrar_serie sobre esta serie ${nextSetNum}.`
  );

  el.innerHTML = `
    <header class="page-head">
      <h1>Entreno</h1>
      <p class="elapsed" id="elapsed">${formatDuration(Date.now() - w.startedAt)}</p>
    </header>

    <div id="rest">${restMarkup()}</div>

    <form class="form-card stack" data-form="set" style="margin-top:14px">
      <label class="field">
        <span>Ejercicio</span>
        <select name="exerciseId" data-change="exercise">
          ${exs.map((e) => `<option value="${e.id}" data-grupo="${esc(e.grupo)}" ${isOwnExercise(e) ? 'data-propio="1"' : ''} ${e.id === selectedEx ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('')}
        </select>
      </label>

      <div id="prev-session-panel">${prevSessionMarkup(prev, unidad)}</div>

      ${pr && pr.maxPeso > 0 ? `
        <div class="workout-pr-strip">
          <span class="workout-pr-chip">${icons.trophy({ size: 12 })} PR ${fmtNum(pr.maxPeso)} ${esc(unidad)}</span>
          <span class="workout-pr-chip workout-pr-chip--muted">${fmtNum(Math.round(pr.e1rmMax * 10) / 10)} 1RM est.</span>
          <span class="workout-pr-chip workout-pr-chip--muted">${pr.maxReps} reps máx.</span>
        </div>` : ''}

      <div class="grid-3">
        <label class="field"><span>Peso (${esc(unidad)})</span>
          <input name="peso" inputmode="decimal" autocomplete="off" required placeholder="0"></label>
        <label class="field"><span>Reps</span>
          <input name="reps" inputmode="numeric" pattern="[0-9]*" autocomplete="off" required placeholder="0"></label>
        <label class="field"><span>RPE</span>
          <input name="rpe" inputmode="decimal" autocomplete="off" placeholder="1–10"></label>
      </div>
      <button class="btn btn-primary btn-block" type="submit">
        ${icons.plus({ size: 18 })} Añadir serie
      </button>
    </form>

    ${detail.groups.map((g) => `
      <div class="group">
        <h3><i class="dot" data-g="${esc(g.exercise.grupo)}"></i>${esc(g.exercise.nombre)}${muscleName(g.exercise.grupo) ? `<span class="muscle">${esc(muscleName(g.exercise.grupo))}</span>` : ''}</h3>
        <ul class="sets">
          ${g.sets.map((s, i) => `
            <li>
              <span class="n">Serie ${i + 1}</span>
              <span class="v">${fmtNum(s.peso)} ${esc(unidad)} × ${s.reps}${s.rpe ? `<span class="rpe-tag">RPE ${fmtNum(s.rpe)}</span>` : ''}</span>
              <button class="btn-x" data-action="del-set" data-id="${s.id}" type="button" aria-label="Borrar serie ${i + 1}">
                ${icons.trash({ size: 15 })}
              </button>
            </li>`).join('')}
        </ul>
      </div>`).join('')}

    <details class="form-card" style="margin-top:26px">
      <summary>
        <span>Crear nuevo ejercicio</span>
        ${icons.plus({ size: 18, cls: 'muted' })}
      </summary>
      <form class="stack" data-form="exercise">
        <label class="field"><span>Nombre</span><input name="nombre" autocomplete="off" required></label>
        <label class="field"><span>Grupo muscular</span>
          <select name="grupo">${GRUPOS.map((x) => `<option>${x}</option>`).join('')}</select></label>
        <button class="btn btn-primary btn-block" type="submit">Guardar ejercicio</button>
      </form>
    </details>

    <div class="grid-2 workout-actions">
      <button class="btn btn-danger" data-action="discard" type="button">
        ${icons.x({ size: 16 })} Descartar
      </button>
      <button class="btn btn-primary" data-action="finish" type="button">
        ${icons.check({ size: 18 })} Terminar sesión
      </button>
    </div>
  `;

  await prefill(el, prev);
  startTicker(el, w);

  delegate(el, {
    'del-set': async (t) => {
      await deleteSet(Number(t.dataset.id));
      await render(el);
    },
    'skip-rest': () => {
      restEnd = 0;
      clearActiveRest();
      el.querySelector('#rest').innerHTML = '';
      getActiveAgent()?.cancelPendingCheckIn();
      getActiveAgent()?.muteMic();
    },
    finish: async () => {
      if (!confirm('¿Terminar este entrenamiento?')) return;
      const summary = await finishWorkoutSummary(w.id);
      if (summary.totalSets > 0) {
        const fechaStr = new Date().toLocaleDateString('es');
        await saveMemory(`Sesión completada el ${fechaStr}: ${summary.detalles}. Volumen total: ${summary.volumenTotal} ${state.settings.unidad} en ${summary.totalSets} series.`);
        getActiveAgent()?.sendContext(`La sesión de entrenamiento ha finalizado. Resumen: ${summary.totalSets} series, volumen total ${summary.volumenTotal} ${state.settings.unidad}.`);
      }
      await finishWorkout(w.id);
      state.activeWorkoutId = null;
      state.activeExercise = null;
      restEnd = 0;
      clearActiveRest();
      go(`/history/${w.id}`);
    },
    discard: async () => {
      if (!confirm('¿Descartar este entrenamiento y todas sus series?')) return;
      await deleteWorkout(w.id);
      state.activeWorkoutId = null;
      state.activeExercise = null;
      restEnd = 0;
      clearActiveRest();
      await render(el);
    }
  });

  changes(el, {
    exercise: async (t) => {
      selectedEx = Number(t.value);
      const curEx = exs.find((e) => e.id === selectedEx);
      state.activeExercise = curEx ? { id: curEx.id, nombre: curEx.nombre, grupo: curEx.grupo } : null;
      getActiveAgent()?.sendContext(`Ejercicio seleccionado: ${curEx?.nombre} (${curEx?.grupo}).`);
      // Actualizar panel sin re-render completo
      const [p, prData] = await Promise.all([lastSessionSetsFor(selectedEx), prByExercise(selectedEx)]);
      const panel = el.querySelector('#prev-session-panel');
      if (panel) panel.innerHTML = prevSessionMarkup(p, unidad);
      const strip = el.querySelector('.workout-pr-strip');
      if (strip && prData && prData.maxPeso > 0) {
        strip.innerHTML = `
          <span class="workout-pr-chip">${icons.trophy({ size: 12 })} PR ${fmtNum(prData.maxPeso)} ${esc(unidad)}</span>
          <span class="workout-pr-chip workout-pr-chip--muted">${fmtNum(Math.round(prData.e1rmMax * 10) / 10)} 1RM est.</span>
          <span class="workout-pr-chip workout-pr-chip--muted">${prData.maxReps} reps máx.</span>`;
      }
      await prefill(el, p);
    }
  });

  forms(el, {
    set: async (f) => {
      const exerciseId = Number(f.elements.exerciseId.value);
      const peso = num(f.elements.peso.value);
      const reps = parseInt(f.elements.reps.value, 10);
      const rpe = num(f.elements.rpe.value);
      if (!Number.isFinite(peso) || peso < 0 || !(reps > 0)) { toast('Revisa el peso y las repeticiones.'); return; }

      // Detectar nuevo PR de peso
      const prevPR = pr?.maxPeso ?? 0;

      const s = { workoutId: w.id, exerciseId, peso, reps };
      if (Number.isFinite(rpe)) s.rpe = rpe;
      await addSet(s);

      selectedEx = exerciseId;
      lastReps = reps;
      const restSecs = state.settings.descansoMode === 'auto'
        ? smartRest(reps)
        : state.settings.descanso;
      restEnd = Date.now() + restSecs * 1000;
      await saveActiveRest(restEnd, lastReps);

      // El descanso comenzó: abrir micrófono para interacción durante la pausa
      getActiveAgent()?.unmuteMic();

      if (peso > prevPR && prevPR > 0) {
        toast(`🏆 ¡Nuevo PR! ${fmtNum(peso)} ${state.settings.unidad}`);
      }

      await render(el);
    },
    exercise: async (f) => {
      try {
        selectedEx = await addExercise(f.elements.nombre.value, f.elements.grupo.value);
        await render(el);
        toast('Ejercicio guardado');
      } catch (e) { toast(e.message); }
    }
  });

  bindExerciseEdit(el, async (e) => {
    const id = Number(e.detail?.id);
    await openExerciseEditor(id, async (result) => {
      if (!result) return;
      if (result.deleted && selectedEx === result.id) selectedEx = null;
      else if (!result.deleted) selectedEx = result.id;
      await render(el);
      toast(result.deleted ? 'Ejercicio eliminado' : 'Ejercicio guardado');
    });
  });
}

async function prefill(el, prev) {
  const f = el.querySelector('form[data-form="set"]');
  if (!f || selectedEx == null) return;
  // Prellenar con la primera serie de la sesión anterior si los campos están vacíos
  if (prev?.sets?.length) {
    const first = prev.sets[0];
    if (!f.elements.peso.value) f.elements.peso.value = fmtNum(first.peso);
    if (!f.elements.reps.value) f.elements.reps.value = first.reps;
  }
}

function startTicker(el, w) {
  if (el._tickerId) clearInterval(el._tickerId);
  const tick = () => {
    const elapsed = el.querySelector('#elapsed');
    if (!elapsed) { clearInterval(el._tickerId); el._tickerId = null; return; }
    elapsed.textContent = formatDuration(Date.now() - w.startedAt);

    const left = restEnd > Date.now() ? Math.ceil((restEnd - Date.now()) / 1000) : 0;
    const rest = el.querySelector('#rest');
    if (rest) {
      if (left > 0) {
        const numEl = rest.querySelector('.num');
        if (numEl) numEl.textContent = mmss(left);
        else rest.innerHTML = restMarkup();
      } else if (rest.innerHTML) {
        rest.innerHTML = '';
      }
    }

    if (restEnd > 0 && left <= 0) {
      restEnd = 0;
      clearActiveRest();
      getActiveAgent()?.muteMic();
      const exName = state.activeExercise?.nombre || 'el ejercicio';
      const curSets = el.querySelectorAll('.group .sets li').length;
      getActiveAgent()?.triggerCheckIn(
        `El descanso terminó. Una frase: sigue ${exName}, serie ${curSets + 1}. Después escuchá.`
      );
    }
  };
  tick();
  el._tickerId = setInterval(tick, 1000);
}
