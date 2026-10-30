import {
  getActiveWorkout, startWorkout, finishWorkout, finishWorkoutSummary, deleteWorkout, listExercises, muscleName, isOwnExercise, muscleFocus,
  deleteSet, getWorkoutDetail, lastSessionSetsFor, prByExercise,
  loadActiveRest, saveActiveRest, clearActiveRest
} from '../services/workouts.js';
import { registerSet, setEffort, setTipo, skipRestClock, AVISO_DUPLICADA } from '../services/effort.js';
import { getActiveAgent, saveMemory } from '../services/agent.js';
import { creatineSummary } from '../services/creatine.js';
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
let todayLogOpen = false;

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

function kgReps(set, unidad) {
  return `<span data-kg="${set.peso}">${fmtWeight(set.peso, unidad)}</span> <span data-unit>${esc(unidad)}</span> × ${set.reps}`;
}

/* Sesión anterior completa: lo que hiciste en tarjetas horizontales compactas. */
function setRefMarkup(prev, curSets, unidad) {
  const sets = prev?.sets || [];
  if (!sets.length) {
    return `<div class="set-ref-card-wrap set-ref-card-wrap--empty" id="set-ref">
      <p class="set-ref--empty">Primera vez con este ejercicio · ¡Establece tu marca!</p>
    </div>`;
  }
  const past = curSets.length >= sets.length;
  const targetIndex = curSets.length;
  const fecha = formatShort(prev.workout.fecha);
  const note = past ? `<p class="set-ref-note">🏆 Ya pasaste la sesión anterior (${sets.length} series)</p>` : '';
  return `<div class="set-ref-card-wrap" id="set-ref">
    <div class="set-ref-card-head">
      <span>Última vez · <strong>${esc(fecha)}</strong></span>
      ${past ? '<span class="set-ref-badge-done">Completada</span>' : ''}
    </div>
    <div class="set-ref-cards">
      ${sets.map((s, i) => {
        const isTarget = i === targetIndex;
        const effortText = s.tipo === 'calentamiento' ? 'calentamiento' : (s.rir != null ? (s.rir === 0 ? 'al límite' : `sobraba ${s.rir}`) : '');
        return `
          <div class="set-ref-card ${isTarget ? 'is-target' : ''}">
            <span class="ref-card-num">Serie ${i + 1}</span>
            <span class="ref-card-reps ${isTarget ? 'text-primary' : ''}">${s.reps}</span>
            <span class="ref-card-detail">
              <span data-kg="${s.peso}">${fmtWeight(s.peso, unidad)}</span> <span data-unit>${esc(unidad)}</span>
            </span>
            ${effortText ? `<span class="ref-card-detail muted">${effortText}</span>` : ''}
          </div>
        `;
      }).join('')}
    </div>
    ${note}
  </div>`;
}

function todayLogMarkup(groups, unidad) {
  const n = groups.reduce((sum, g) => sum + g.sets.length, 0);
  if (!n) return '';
  return `<details class="today-log"${todayLogOpen ? ' open' : ''}>
    <summary>
      <span>Series de hoy</span>
      <span class="today-log-meta"><span class="section-count">${n}</span>${icons.chevronDown({ size: 18, cls: 'muted' })}</span>
    </summary>
    ${groups.map((g) => `
      <div class="group">
        <h3><i class="dot" data-g="${esc(muscleName(g.exercise.grupo) || g.exercise.grupo)}"></i>${esc(g.exercise.nombre)}${muscleName(g.exercise.grupo) ? `<span class="muscle">${esc(muscleName(g.exercise.grupo))}${muscleFocus(g.exercise.nombre) ? `<span class="muscle-focus">${esc(muscleFocus(g.exercise.nombre))}</span>` : ''}</span>` : ''}</h3>
        <ul class="sets">
          ${g.sets.map((s, i) => `
            <li>
              <span class="n">Serie ${i + 1}</span>
              <span class="v"><span data-kg="${s.peso}">${fmtWeight(s.peso, unidad)}</span> <span data-unit>${esc(unidad)}</span> × ${s.reps}${effortTag(s)}</span>
              <button class="btn-x" data-action="del-set" data-id="${s.id}" type="button" aria-label="Borrar serie ${i + 1} de ${esc(g.exercise.nombre)}">
                ${icons.trash({ size: 15 })}
              </button>
              ${effortExtra(s, openEffortId)}
            </li>`).join('')}
        </ul>
      </div>`).join('')}
  </details>`;
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
  const stepDown = root.querySelector('[data-step-peso-down]');
  if (stepDown) stepDown.textContent = `−${next === 'lb' ? '5' : '2,5'}`;
  const stepUp = root.querySelector('[data-step-peso-up]');
  if (stepUp) stepUp.textContent = `+${next === 'lb' ? '5' : '2,5'}`;
}

export async function render(el) {
  const w = await getActiveWorkout();

  if (!w) {
    restEnd = 0;
    todayLogOpen = false;
    clearActiveRest();
    el.innerHTML = `
      <header class="page-head">
        <div class="page-head-row">
          <h1>Entreno</h1>
          <a class="head-link" href="#/agent" aria-label="Fit">${icons.bot({ size: 22 })}</a>
        </div>
      </header>
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
  const prevSets = prev?.sets || [];
  const targetSet = prevSets[curExSets.length] || prevSets[prevSets.length - 1];
  const todayRank = new Map((detail?.groups || []).map((g, i) => [g.exercise.id, i]));
  const orderedExs = exs.map((e, i) => ({ e, i })).sort((a, b) => {
    const ra = todayRank.has(a.e.id) ? todayRank.get(a.e.id) : 1e9;
    const rb = todayRank.has(b.e.id) ? todayRank.get(b.e.id) : 1e9;
    if (ra !== rb) return ra - rb;
    return a.i - b.i;
  }).map(({ e }) => e);

  getActiveAgent()?.sendContext(
    `Si no nombra otro, la serie abierta es ${currentExObj?.nombre}, número ${nextSetNum}. No lo digas. Si nombra un ejercicio, usa ese.`
  );

  el.innerHTML = `
    <header class="page-head">
      <div class="page-head-row">
        <h1>Entreno</h1>
        <a class="head-link" href="#/agent" aria-label="Fit">${icons.bot({ size: 22 })}</a>
      </div>
      <p class="elapsed" id="elapsed">${formatDuration(now() - w.startedAt)}</p>
    </header>

    <div id="rest">${restMarkup()}</div>

    <form class="form-card stack" data-form="set" style="margin-top:14px">
      <label class="field">
        <span>Ejercicio</span>
        <select name="exerciseId" data-change="exercise">
          ${orderedExs.map((e) => `<option value="${e.id}" data-grupo="${esc(muscleName(e.grupo) || e.grupo)}" ${todayRank.has(e.id) ? 'data-hoy="1"' : ''} ${muscleFocus(e.nombre) ? `data-foco="${esc(muscleFocus(e.nombre))}"` : ''} ${isOwnExercise(e) ? 'data-propio="1"' : ''} ${e.id === selectedEx ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('')}
        </select>
      </label>

      <div class="workout-set-header">
        <div>
          <span class="workout-set-title">Serie ${nextSetNum}</span>
          ${targetSet ? `
            <p class="workout-set-target">A superar: <strong><span data-kg="${targetSet.peso}">${fmtWeight(targetSet.peso, unidad)}</span> <span data-unit>${esc(unidad)}</span> × ${targetSet.reps}</strong></p>
          ` : `
            <p class="workout-set-target">Primera sesión · <span class="muted">Establece tu marca</span></p>
          `}
        </div>
        <div class="seg tipo-seg" role="group" aria-label="Tipo de serie" id="draft-tipo-seg">
          <button type="button" data-action="draft-tipo" data-tipo="trabajo" aria-pressed="${draftTipo === 'trabajo'}">Trabajo</button>
          <button type="button" data-action="draft-tipo" data-tipo="calentamiento" aria-pressed="${draftTipo === 'calentamiento'}">Calentamiento</button>
        </div>
      </div>

      ${setRefMarkup(prev, curExSets, unidad)}

      <div class="workout-inputs-grid">
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
              <span data-step-peso-down>−${unidad === 'lb' ? '5' : '2,5'}</span>
            </button>
            <button type="button" class="stepper-step-btn" data-action="step-peso" data-dir="1" aria-label="Subir peso">
              <span data-step-peso-up>+${unidad === 'lb' ? '5' : '2,5'}</span>
            </button>
          </div>
        </div>

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
        </div>
      </div>

      <div id="rir-pick" class="stack">
        <div class="rir-head-row">
          <span class="effort-label">¿Cuántas más podrías haber hecho?</span>
          <span class="rir-optional-tag">${draftTipo === 'trabajo' ? 'Opcional' : 'No aplica'}</span>
        </div>
        ${rirButtons('', { action: 'draft-rir', pressed: draftRir, disabled: draftTipo !== 'trabajo' })}
        <div class="rir-scale-legend" id="rir-scale-legend" ${draftTipo !== 'trabajo' ? 'hidden' : ''}>
          <span class="rir-legend-left">0 = al límite, no salía otra</span>
          <span class="rir-legend-right">Sobrado</span>
        </div>
      </div>

      <button class="btn btn-primary btn-block btn-lg" type="submit">
        ${icons.plus({ size: 18 })} Guardar serie ${nextSetNum}
      </button>
    </form>

    ${todayLogMarkup(detail.groups, unidad)}

    <div class="grid-2 workout-actions">
      <button class="btn btn-danger" data-action="discard" type="button">
        ${icons.x({ size: 16 })} Descartar
      </button>
      <button class="btn btn-primary" data-action="finish" type="button">
        ${icons.check({ size: 18 })} Terminar sesión
      </button>
    </div>
  `;

  el.querySelector('.today-log')?.addEventListener('toggle', (e) => {
    todayLogOpen = e.currentTarget.open;
  });

  let sessionPr = pr;
  await prefill(el, prev, curExSets);
  startTicker(el, w);
  const tipoSeg = el.querySelector('#draft-tipo-seg');
  if (tipoSeg) requestAnimationFrame(() => syncSegThumb(tipoSeg));

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
    'step-peso': (t) => {
      const dir = Number(t.dataset.dir || 1);
      const input = el.querySelector('input[name="peso"]');
      if (!input) return;
      const step = weightUnit() === 'lb' ? 5 : 2.5;
      let curr = parseFloat(input.value);
      if (isNaN(curr) || curr < 0) curr = 0;
      let next = Math.max(0, Math.round((curr + dir * step) * 100) / 100);
      input.value = next;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    },
    'step-reps': (t) => {
      const dir = Number(t.dataset.dir || 1);
      const input = el.querySelector('input[name="reps"]');
      if (!input) return;
      let curr = parseInt(input.value, 10);
      if (isNaN(curr) || curr < 0) curr = 0;
      let next = Math.max(0, curr + dir);
      input.value = next === 0 ? '' : next;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
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
      const seg = el.querySelector('#draft-tipo-seg');
      el.querySelectorAll('[data-action="draft-tipo"]').forEach((b) => {
        b.setAttribute('aria-pressed', String(b === t));
      });
      if (seg) syncSegThumb(seg);
      el.querySelectorAll('[data-action="draft-rir"]').forEach((b) => {
        b.disabled = warm;
        b.setAttribute('aria-pressed', String(!warm && Number(b.dataset.rir) === draftRir));
      });
      const legend = el.querySelector('#rir-scale-legend');
      if (legend) legend.hidden = warm;
      const opt = el.querySelector('.rir-optional-tag');
      if (opt) opt.textContent = warm ? 'No aplica' : 'Opcional';
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
        let cierre = `La sesión de entrenamiento ha finalizado. Resumen: ${summary.totalSets} series, volumen total ${volShow} ${u}.`;
        const cr = await creatineSummary();
        if (!cr.tomadaHoy) {
          cierre += ' Creatina de hoy: no tomada. Al despedirte, dilo en una sola frase y no lo repitas.';
        }
        getActiveAgent()?.sendContext(cierre);
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
      sessionPr = prData;
      const sets = detail?.groups?.find((g) => g.exercise.id === selectedEx)?.sets || [];
      const ref = el.querySelector('#set-ref');
      if (ref) ref.outerHTML = setRefMarkup(p, sets, weightUnit());
      const f = el.querySelector('form[data-form="set"]');
      if (f) {
        f.elements.peso.value = '';
        f.elements.reps.value = '';
      }
      await prefill(el, p, sets);
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

      const prevPR = sessionPr?.maxPeso ?? 0;
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

  el.addEventListener('exercise-created', async (e) => {
    const { id, nombre } = e.detail;
    selectedEx = id;
    await render(el);
    toast(`Ejercicio creado: «${nombre}»`);
  });
}

async function prefill(el, prev, curSets = []) {
  const f = el.querySelector('form[data-form="set"]');
  if (!f || selectedEx == null) return;
  const sets = prev?.sets || [];
  const target = sets[curSets.length] || sets[sets.length - 1];
  if (!target) return;
  if (!f.elements.peso.value) f.elements.peso.value = fmtWeight(target.peso);
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
