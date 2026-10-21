import {
  getActiveWorkout, startWorkout, finishWorkout, finishWorkoutSummary, deleteWorkout, listExercises, addExercise, muscleName, isOwnExercise, muscleFocus,
  deleteSet, getWorkoutDetail, lastSessionSetsFor, prByExercise, GRUPOS,
  loadActiveRest, saveActiveRest, clearActiveRest
} from '../services/workouts.js';
import { registerSet, setEffort, setTipo, skipRestClock, AVISO_DUPLICADA } from '../services/effort.js';
import { getActiveAgent, saveMemory } from '../services/agent.js';
import { state, saveSettings } from '../store.js';
import { delegate, forms, changes, toast, esc, num, go } from '../utils/dom.js';
import { formatDuration, formatShort } from '../utils/dates.js';
import { now } from '../utils/clock.js';
import { icons } from '../utils/icons.js';
import { bindExerciseEdit, openExerciseEditor } from '../utils/exercise-editor.js';
import { askConfirm } from '../utils/confirm-sheet.js';
import { effortTag, effortExtra, rirButtons } from '../utils/set-line.js';
import { weightUnit, toKg, fmtWeight, fmtVolume, unitSegHtml } from '../utils/units.js';
import { syncSegThumb } from '../utils/seg-swipe.js';
import { maybePromptBackup } from '../utils/backup-nudge.js';

let selectedEx = null;
let restEnd = 0;
let lastReps = 0;
let draftTipo = 'trabajo';
let draftRir = null;
let openEffortId = null;

document.addEventListener('bf-set', (e) => {
  if (!e.detail?.restEnd) return;
  restEnd = e.detail.restEnd;
  if (e.detail.lastReps) lastReps = e.detail.lastReps;
});

document.addEventListener('bf-exercise', (e) => {
  const id = Number(e.detail?.id);
  if (id) selectedEx = id;
});

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
  const left = Math.ceil((restEnd - now()) / 1000);
  if (left <= 0) return '';
  const zone = restZoneLabel();
  return `<div class="rest">
    <span>${icons.clock({ size: 18, stroke: 'var(--primary)' })} Descanso <strong class="num">${mmss(left)}</strong></span>
    ${zone ? `<span class="rest-zone">${zone}</span>` : ''}
    <button class="btn btn-sm" data-action="skip-rest" type="button">Saltar</button>
  </div>`;
}

function prevSessionMarkup(prev, unidad = weightUnit()) {
  if (!prev) {
    return `<div class="prev-session prev-session--empty">
      <span>${icons.dumbbell({ size: 14, stroke: 'var(--text-dim)' })} Primera vez · ¡sé el primero en marcar un PR!</span>
    </div>`;
  }
  const fecha = formatShort(prev.workout.fecha);
  const rows = prev.sets.map((s, i) => `
    <div class="prev-row">
      <span class="prev-row-n">S${i + 1}</span>
      <span class="prev-row-v"><span data-kg="${s.peso}">${fmtWeight(s.peso, unidad)}</span> <small data-unit>${esc(unidad)}</small> × <strong>${s.reps}</strong>${effortTag(s)}</span>
    </div>`).join('');
  return `<div class="prev-session">
    <div class="prev-session-head">
      ${icons.clock({ size: 13, stroke: 'var(--primary)' })}
      <span>Sesión anterior <strong>${esc(fecha)}</strong></span>
    </div>
    <div class="prev-rows">${rows}</div>
  </div>`;
}

/* Cambia kg/lb sin repintar Entreno (si no, parpadea Trabajo/Calentamiento). */
function applyUnitLive(root, next, pesoKg) {
  root.querySelectorAll('.unit-seg [data-unidad]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.unidad === next));
  });
  const unitSeg = root.querySelector('.unit-seg');
  if (unitSeg) {
    requestAnimationFrame(() => syncSegThumb(unitSeg));
  }
  const input = root.querySelector('input[name="peso"]');
  if (input && pesoKg != null) input.value = fmtWeight(pesoKg, next);
  root.querySelectorAll('[data-kg]').forEach((n) => {
    const k = Number(n.dataset.kg);
    if (Number.isFinite(k)) n.textContent = fmtWeight(k, next);
  });
  root.querySelectorAll('[data-unit]').forEach((n) => { n.textContent = next; });
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
  if (restEnd <= now()) {
    const saved = await loadActiveRest();
    if (saved) {
      restEnd = saved.restEnd;
      lastReps = saved.lastReps || 0;
    } else {
      restEnd = 0;
    }
  }
  if (state.activeExercise && exs.some((e) => e.id === state.activeExercise.id)) {
    selectedEx = state.activeExercise.id;
  } else if (!exs.some((e) => e.id === selectedEx)) {
    selectedEx = exs[0]?.id ?? null;
  }
  const unidad = weightUnit();

  state.activeWorkoutId = w.id;
  const currentExObj = exs.find((e) => e.id === selectedEx);
  state.activeExercise = currentExObj ? { id: currentExObj.id, nombre: currentExObj.nombre, grupo: currentExObj.grupo } : null;

  const [prev, pr] = await Promise.all([
    selectedEx ? lastSessionSetsFor(selectedEx) : null,
    selectedEx ? prByExercise(selectedEx) : null,
  ]);

  const curExSets = detail?.groups?.find((g) => g.exercise.id === selectedEx)?.sets || [];
  const nextSetNum = curExSets.length + 1;

  getActiveAgent()?.sendContext(
    `Si no nombra otro, la serie abierta es ${currentExObj?.nombre}, número ${nextSetNum}. No lo digas. Si nombra un ejercicio, usa ese.`
  );

  el.innerHTML = `
    <header class="page-head">
      <h1>Entreno</h1>
      <p class="elapsed" id="elapsed">${formatDuration(now() - w.startedAt)}</p>
    </header>

    <div id="rest">${restMarkup()}</div>

    <form class="form-card stack" data-form="set" style="margin-top:14px">
      <label class="field">
        <span>Ejercicio</span>
        <select name="exerciseId" data-change="exercise">
          ${exs.map((e) => `<option value="${e.id}" data-grupo="${esc(e.grupo)}" ${muscleFocus(e.nombre) ? `data-foco="${esc(muscleFocus(e.nombre))}"` : ''} ${isOwnExercise(e) ? 'data-propio="1"' : ''} ${e.id === selectedEx ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('')}
        </select>
      </label>

      <div id="prev-session-panel">${prevSessionMarkup(prev, unidad)}</div>

      ${pr && pr.maxPeso > 0 ? `
        <div class="workout-pr-strip">
          <span class="workout-pr-chip">${icons.trophy({ size: 12 })} PR <span data-kg="${pr.maxPeso}">${fmtWeight(pr.maxPeso, unidad)}</span> <span data-unit>${esc(unidad)}</span></span>
          <span class="workout-pr-chip workout-pr-chip--muted"><span data-kg="${pr.e1rmMax}">${fmtWeight(pr.e1rmMax, unidad)}</span> 1RM est.</span>
          <span class="workout-pr-chip workout-pr-chip--muted">${pr.maxReps} reps máx.</span>
        </div>` : ''}

      <div class="grid-2">
        <div class="field">
          <span>Peso ${unitSegHtml(unidad)}</span>
          <input name="peso" inputmode="decimal" autocomplete="off" required placeholder="0" aria-label="Peso">
        </div>
        <label class="field"><span>Reps</span>
          <input name="reps" inputmode="numeric" pattern="[0-9]*" autocomplete="off" required placeholder="0"></label>
      </div>
      <div class="seg" role="group" aria-label="Tipo de serie">
        <button type="button" data-action="draft-tipo" data-tipo="trabajo" aria-pressed="${draftTipo === 'trabajo'}">Trabajo</button>
        <button type="button" data-action="draft-tipo" data-tipo="calentamiento" aria-pressed="${draftTipo === 'calentamiento'}">Calentamiento</button>
      </div>
      <div id="rir-pick" class="stack">
        <span class="effort-label">¿Cuántas repeticiones más podrías haber hecho?</span>
        <span class="effort-hint" id="effort-hint">${draftTipo === 'trabajo' ? 'Obligatorio · 0 es no salía otra' : 'Los calentamientos no llevan esfuerzo'}</span>
        ${rirButtons('', { action: 'draft-rir', pressed: draftRir, disabled: draftTipo !== 'trabajo' })}
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
              <span class="v"><span data-kg="${s.peso}">${fmtWeight(s.peso, unidad)}</span> <span data-unit>${esc(unidad)}</span> × ${s.reps}${effortTag(s)}</span>
              <button class="btn-x" data-action="del-set" data-id="${s.id}" type="button" aria-label="Borrar serie ${i + 1}">
                ${icons.trash({ size: 15 })}
              </button>
              ${effortExtra(s, openEffortId)}
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
    unidad: async (t) => {
      const next = t.dataset.unidad === 'lb' ? 'lb' : 'kg';
      const prev = weightUnit();
      if (next === prev) return;
      const input = el.querySelector('input[name="peso"]');
      const raw = num(input?.value);
      const kg = Number.isFinite(raw) ? toKg(raw, prev) : null;
      await saveSettings({ unidad: next });
      applyUnitLive(el, next, Number.isFinite(kg) ? kg : null);
    },
    'del-set': async (t) => {
      const ok = await askConfirm({
        title: 'Borrar serie',
        body: 'Se quitará esta serie del entreno.',
      });
      if (!ok) return;
      await deleteSet(Number(t.dataset.id));
      await render(el);
    },
    'skip-rest': async () => {
      restEnd = 0;
      await skipRestClock();
      el.querySelector('#rest').innerHTML = '';
      getActiveAgent()?.cancelPendingCheckIn();
      getActiveAgent()?.muteMic();
    },
    'draft-tipo': (t) => {
      draftTipo = t.dataset.tipo === 'calentamiento' ? 'calentamiento' : 'trabajo';
      if (draftTipo === 'calentamiento') draftRir = null;
      const warm = draftTipo === 'calentamiento';
      el.querySelectorAll('[data-action="draft-tipo"]').forEach((b) => {
        b.setAttribute('aria-pressed', String(b === t));
      });
      el.querySelectorAll('[data-action="draft-rir"]').forEach((b) => {
        b.disabled = warm;
        b.setAttribute('aria-pressed', String(!warm && Number(b.dataset.rir) === draftRir));
      });
      const hint = el.querySelector('#effort-hint');
      if (hint) hint.textContent = warm ? 'Los calentamientos no llevan esfuerzo' : 'Obligatorio · 0 es no salía otra';
    },
    'draft-rir': (t) => {
      draftRir = Number(t.dataset.rir);
      el.querySelectorAll('[data-action="draft-rir"]').forEach((b) => {
        b.setAttribute('aria-pressed', String(Number(b.dataset.rir) === draftRir));
      });
    },
    'effort-open': async (t) => {
      const id = Number(t.dataset.id);
      openEffortId = openEffortId === id ? null : id;
      await render(el);
    },
    'effort-rir': async (t) => {
      const res = await setEffort(Number(t.dataset.id), Number(t.dataset.rir));
      if (!res?.ok) { toast('No se pudo anotar el esfuerzo.', { tone: 'danger' }); return; }
      openEffortId = null;
      await render(el);
    },
    'set-tipo': async (t) => {
      await setTipo(Number(t.dataset.id), t.dataset.tipo);
      openEffortId = null;
      await render(el);
    },
    finish: async () => {
      const ok = await askConfirm({
        title: 'Terminar sesión',
        body: 'Se cierra este entrenamiento.',
        confirmLabel: 'Terminar',
        danger: false,
      });
      if (!ok) return;
      const summary = await finishWorkoutSummary(w.id);
      if (summary.totalSets > 0) {
        const fechaStr = new Date().toLocaleDateString('es');
        const u = weightUnit();
        const volShow = fmtVolume(summary.volumenTotal, u);
        await saveMemory(`Sesión completada el ${fechaStr}: ${summary.detalles}. Volumen total: ${volShow} ${u} en ${summary.totalSets} series.`);
        getActiveAgent()?.sendContext(`La sesión de entrenamiento ha finalizado. Resumen: ${summary.totalSets} series, volumen total ${volShow} ${u}.`);
      }
      await finishWorkout(w.id);
      state.activeWorkoutId = null;
      state.activeExercise = null;
      restEnd = 0;
      clearActiveRest();
      await maybePromptBackup();
      go(`/history/${w.id}`);
    },
    discard: async () => {
      const ok = await askConfirm({
        title: 'Descartar entrenamiento',
        body: 'Se borran este entreno y todas sus series. No se puede deshacer.',
        confirmLabel: 'Descartar',
      });
      if (!ok) return;
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
      const u = weightUnit();
      if (panel) panel.innerHTML = prevSessionMarkup(p, u);
      const strip = el.querySelector('.workout-pr-strip');
      if (strip && prData && prData.maxPeso > 0) {
        strip.innerHTML = `
          <span class="workout-pr-chip">${icons.trophy({ size: 12 })} PR <span data-kg="${prData.maxPeso}">${fmtWeight(prData.maxPeso, u)}</span> <span data-unit>${esc(u)}</span></span>
          <span class="workout-pr-chip workout-pr-chip--muted"><span data-kg="${prData.e1rmMax}">${fmtWeight(prData.e1rmMax, u)}</span> 1RM est.</span>
          <span class="workout-pr-chip workout-pr-chip--muted">${prData.maxReps} reps máx.</span>`;
      }
      await prefill(el, p);
    }
  });

  forms(el, {
    set: async (f) => {
      const exerciseId = Number(f.elements.exerciseId.value);
      const pesoUi = num(f.elements.peso.value);
      const peso = toKg(pesoUi);
      const reps = parseInt(f.elements.reps.value, 10);
      if (!Number.isFinite(peso) || peso < 0 || peso > 600 || !(reps > 0)) {
        toast('Revisa el peso y las repeticiones.', { tone: 'warn' });
        return;
      }
      if (draftTipo === 'trabajo' && (draftRir == null || !Number.isFinite(draftRir))) {
        toast('Elige el esfuerzo (0–4).', { tone: 'warn' });
        el.querySelector('#rir-pick')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        return;
      }

      const prevPR = pr?.maxPeso ?? 0;
      const restSecs = state.settings.descansoMode === 'auto'
        ? smartRest(reps)
        : state.settings.descanso;
      const nextRest = now() + restSecs * 1000;
      const saved = await registerSet({
        workoutId: w.id,
        exerciseId,
        peso,
        reps,
        tipo: draftTipo,
        rir: draftTipo === 'trabajo' ? draftRir : undefined,
        restEnd: nextRest,
      }, { guard: true, abrirPregunta: false });
      if (saved?.duplicada) { toast(saved.aviso || AVISO_DUPLICADA); return; }

      restEnd = nextRest;
      selectedEx = exerciseId;
      lastReps = reps;
      await saveActiveRest(restEnd, lastReps);
      draftTipo = 'trabajo';
      draftRir = null;

      // El descanso comenzó: abrir micrófono para interacción durante la pausa
      getActiveAgent()?.unmuteMic();

      if (saved?.aviso) toast(saved.aviso);
      else if (peso > prevPR && prevPR > 0) toast(`🏆 ¡Nuevo PR! ${fmtWeight(peso)} ${weightUnit()}`);

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
    if (!f.elements.peso.value) f.elements.peso.value = fmtWeight(first.peso);
    if (!f.elements.reps.value) f.elements.reps.value = first.reps;
  }
}

function startTicker(el, w) {
  if (el._tickerId) clearInterval(el._tickerId);
  const tick = () => {
    const elapsed = el.querySelector('#elapsed');
    if (!elapsed) { clearInterval(el._tickerId); el._tickerId = null; return; }
    elapsed.textContent = formatDuration(now() - w.startedAt);

    const left = restEnd > now() ? Math.ceil((restEnd - now()) / 1000) : 0;
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
