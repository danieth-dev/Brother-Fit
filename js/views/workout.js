/* Pantalla Entreno: empezar o repetir un entreno, anotar series, descanso y cierre.
 * Plantillas en workout/markup.js, reloj en workout/rest.js y estado en workout/session.js. */
import {
  getActiveWorkout, startWorkout, finishWorkout, finishWorkoutSummary, deleteWorkout, listExercises,
  deleteSet, getWorkoutDetail, lastSessionSetsFor, prByExercise,
  loadActiveRest, saveActiveRest, clearActiveRest, listWorkoutSummaries, getWorkoutExerciseSets,
} from '../services/workouts.js';
import { registerSet, setEffort, setTipo, skipRestClock } from '../services/effort.js';
import { restSeconds, restLabel, orderExercises, nextRoutineStep, routineComplete, ROUTINE_DONE } from '../services/session-plan.js';
import { getActiveAgent } from '../voice/fit-agent.js';
import { saveMemory } from '../services/bia/memory.js';
import { creatineSummary } from '../services/creatine.js';
import { state, saveSettings } from '../store.js';
import { delegate, forms, changes, toast, esc, num, go } from '../utils/dom.js';
import { formatDuration } from '../utils/dates.js';
import { now } from '../utils/clock.js';
import { icons } from '../utils/icons.js';
import { bindExerciseEdit, openExerciseEditor } from '../utils/exercise-editor.js';
import { askConfirm } from '../utils/confirm-sheet.js';
import { weightUnit, toKg, fmtWeight, fmtVolume } from '../utils/units.js';
import { syncSegThumb } from '../utils/seg-swipe.js';
import { maybePromptBackup } from '../utils/backup-nudge.js';
import { session, setActiveExercise, resetSession } from './workout/session.js';
import { idleMarkup, activeMarkup, todayLogMarkup, weightStep } from './workout/markup.js';
import { startTicker, stopRest } from './workout/rest.js';
import { setRestControls } from '../utils/rest-pill.js';

const MAX_PESO_KG = 600;
const PAST_WORKOUTS_SHOWN = 3;
const SUMMARIES_TO_SCAN = 10;

export async function render(el) {
  const w = await getActiveWorkout();
  if (w) await renderActive(el, w);
  else await renderIdle(el);
}

/* ---------- Sin entreno ---------- */

async function renderIdle(el) {
  resetSession();
  setRestControls(null);
  clearActiveRest();
  const summaries = await listWorkoutSummaries(SUMMARIES_TO_SCAN);
  const pastWorkouts = summaries.filter((s) => s.finishedAt && s.totalSets > 0).slice(0, PAST_WORKOUTS_SHOWN);
  el.innerHTML = idleMarkup(pastWorkouts, weightUnit());
  delegate(el, {
    start: async (b) => {
      b.disabled = true;
      await startWorkout();
      await render(el);
    },
    repeat: async (b) => {
      b.disabled = true;
      await startWorkout(Number(b.dataset.id));
      await render(el);
    },
  });
}

/* ---------- Con entreno en curso: datos ---------- */

async function restoreRest() {
  if (session.restEnd > now()) return;
  const saved = await loadActiveRest();
  session.restEnd = saved?.restEnd || 0;
  if (saved) {
    session.lastReps = saved.lastReps || 0;
    session.lastRir = saved.rir ?? null;
    session.lastTipo = saved.tipo || 'trabajo';
  }
}

/* Qué ejercicio queda abierto: el primero de la rutina si aún no hay series, el que eligió Bía
 * o el atleta, o el primero del catálogo. */
function resolveSelected(w, exs, groups) {
  if (!groups.length && w.routineExercises?.length) {
    const first = exs.find((e) => e.id === w.routineExercises[0]);
    if (first) {
      session.selectedEx = first.id;
      return;
    }
  }
  if (state.activeExercise && exs.some((e) => e.id === state.activeExercise.id)) {
    session.selectedEx = state.activeExercise.id;
  } else if (!exs.some((e) => e.id === session.selectedEx)) {
    session.selectedEx = exs[0]?.id ?? null;
  }
}

/* La sesión de referencia: la que se repite, o la última vez que hizo el ejercicio. */
async function referenceSets(w, exId) {
  if (!exId) return null;
  if (w.fromWorkoutId) {
    const fromSets = await getWorkoutExerciseSets(w.fromWorkoutId, exId);
    if (fromSets?.sets.length) return fromSets;
  }
  return lastSessionSetsFor(exId);
}

const setCounts = (groups) => new Map(groups.map((g) => [g.exercise.id, g.sets.length]));

/* Series por ejercicio de la sesión que se repite: lo que pide la rutina. */
async function plannedCounts(w) {
  if (!w.routineExercises?.length || !w.fromWorkoutId) return new Map();
  const from = await getWorkoutDetail(w.fromWorkoutId);
  return setCounts(from?.groups || []);
}

/* Al abrir una serie nueva, el tipo sigue al de la sesión anterior y el esfuerzo se vacía. */
function prepareDraft(w, nextSetNum, targetSet) {
  const key = `${w.id}-${session.selectedEx}-${nextSetNum}`;
  if (session.lastConfiguredSetKey === key) return;
  session.lastConfiguredSetKey = key;
  session.draftTipo = targetSet?.tipo === 'calentamiento' ? 'calentamiento' : 'trabajo';
  session.draftRir = null;
}

async function loadActive(w) {
  const [exs, detail] = await Promise.all([listExercises(), getWorkoutDetail(w.id)]);
  const groups = detail?.groups || [];
  await restoreRest();
  resolveSelected(w, exs, groups);
  const selectedEx = session.selectedEx;
  const currentEx = exs.find((e) => e.id === selectedEx);
  state.activeWorkoutId = w.id;
  setActiveExercise(currentEx);

  const [prev, pr, planned] = await Promise.all([
    referenceSets(w, selectedEx),
    selectedEx ? prByExercise(selectedEx) : null,
    plannedCounts(w),
  ]);
  const curExSets = groups.find((g) => g.exercise.id === selectedEx)?.sets || [];
  const prevSets = prev?.sets || [];
  const nextSetNum = curExSets.length + 1;
  const targetSet = prevSets[curExSets.length] || prevSets.at(-1);
  prepareDraft(w, nextSetNum, targetSet);

  const routine = w.routineExercises || [];
  const routineIdx = routine.indexOf(selectedEx);
  const nextId = routineIdx >= 0 && routineIdx < routine.length - 1 ? routine[routineIdx + 1] : null;
  session.nextExObj = nextId ? exs.find((e) => e.id === nextId) : null;
  session.isExCompleted = prevSets.length > 0 && curExSets.length >= prevSets.length;
  session.routineDone = routineComplete(routine, selectedEx, setCounts(groups), planned);
  session.curExName = currentEx?.nombre || '';

  return { w, exs, groups, currentEx, prev, pr, curExSets, prevSets, nextSetNum, targetSet, routineIdx };
}

/* ---------- Con entreno en curso: pantalla ---------- */

async function renderActive(el, w) {
  const d = await loadActive(w);
  const unidad = weightUnit();
  const todayIds = new Set(d.groups.map((g) => g.exercise.id));

  getActiveAgent()?.sendContext(
    `Si no nombra otro, la serie abierta es ${d.currentEx?.nombre}, número ${d.nextSetNum}. No lo digas. Si nombra un ejercicio, usa ese.`
  );

  el.innerHTML = activeMarkup({
    ...d,
    selectedEx: session.selectedEx,
    todayIds,
    orderedExs: orderExercises(d.exs, d.groups.map((g) => g.exercise.id), w.routineExercises || []),
    inRoutine: Boolean(w.routineExercises?.length),
    unidad,
    elapsed: formatDuration(now() - w.startedAt),
    draftTipo: session.draftTipo,
    draftRir: session.draftRir,
    todayLog: todayLogMarkup(d.groups, unidad, { open: session.todayLogOpen, openEffortId: session.openEffortId }),
  });

  el.querySelector('.today-log')?.addEventListener('toggle', (e) => {
    session.todayLogOpen = e.currentTarget.open;
  });
  prefillWeight(el, d.targetSet);
  syncSubmit(el);
  watchSubmitInputs(el);
  scrollTargetRefCard(el);
  startTicker(el, w, (id) => goToExercise(el, d.exs, id));
  setRestControls(restControls(el, d));
  const tipoSeg = el.querySelector('#draft-tipo-seg');
  if (tipoSeg) requestAnimationFrame(() => syncSegThumb(tipoSeg));
  bindActive(el, d);
}

/* Lo que la cápsula del descanso ofrece: solo en una rutina repetida, «Siguiente» al igualar
 * las series del ejercicio y «Terminar sesión» al acabar el último con todo hecho. */
function restControls(el, d) {
  let action = null;
  if (session.routineDone) action = { kind: 'finish', label: 'Terminar sesión' };
  else if (session.isExCompleted && session.nextExObj) action = { kind: 'next', label: session.nextExObj.nombre };
  return {
    // Se lee al abrir la hoja: Bía puede alargar el descanso después de pintar Entreno.
    get zone() {
      return state.settings.descansoMode === 'auto' && session.lastReps ? restLabel(session.lastReps, { rir: session.lastRir, tipo: session.lastTipo }) : '';
    },
    action,
    onSkip: () => skipRest(el, d.exs),
    onAction: () => (action?.kind === 'finish' ? finishFlow(d.w) : advanceTo(el, d.exs, session.nextExObj.id)),
  };
}

async function skipRest(el, exs) {
  stopRest();
  await skipRestClock();
  const next = session.pendingNextEx;
  if (next && next !== ROUTINE_DONE) {
    await goToExercise(el, exs, next, { announce: true });
    return;
  }
  session.pendingNextEx = null;
  await render(el);
}

async function advanceTo(el, exs, id) {
  stopRest();
  await skipRestClock();
  await goToExercise(el, exs, id, { announce: true });
}

async function finishFlow(w) {
  if (!(await confirmFinish(w))) return;
  await tellBiaWorkoutDone(w);
  await finishWorkout(w.id);
  forgetActiveWorkout();
  await maybePromptBackup();
  go(`/history/${w.id}`);
}

function prefillWeight(el, targetSet) {
  const input = el.querySelector('form[data-form="set"] input[name="peso"]');
  if (input && targetSet && !input.value) input.value = fmtWeight(targetSet.peso);
}

function scrollTargetRefCard(el) {
  const target = el.querySelector('.set-ref-card.is-target');
  if (target) requestAnimationFrame(() => target.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' }));
}

/* El botón dice lo que falta; solo se habilita cuando la serie está completa. */
function missingForSet(f) {
  const reps = parseInt(f.elements.reps.value, 10);
  const peso = num(f.elements.peso.value);
  if (!(reps > 0)) return 'Indica las repeticiones';
  if (!Number.isFinite(peso)) return 'Indica el peso';
  if (session.draftTipo === 'trabajo' && !Number.isFinite(session.draftRir)) return 'Indica el esfuerzo';
  return '';
}

function syncSubmit(el) {
  const f = el.querySelector('form[data-form="set"]');
  const btn = el.querySelector('[data-set-submit]');
  if (!f || !btn) return;
  const missing = missingForSet(f);
  const key = missing || 'ready';
  if (btn.dataset.state === key) return;
  btn.dataset.state = key;
  btn.disabled = Boolean(missing);
  btn.innerHTML = missing ? esc(missing) : `${icons.plus({ size: 18 })} Guardar serie ${btn.dataset.n}`;
}

/* Un solo oyente por pantalla aunque se repinte muchas veces. */
function watchSubmitInputs(el) {
  if (el._submitSync) el.removeEventListener('input', el._submitSync);
  el._submitSync = (e) => {
    if (e.target?.name === 'reps' || e.target?.name === 'peso') syncSubmit(el);
  };
  el.addEventListener('input', el._submitSync);
}

/* Cambia kg/lb sin repintar Entreno (si no, parpadea Trabajo/Calentamiento). */
function applyUnitLive(root, next, pesoKg) {
  root.querySelectorAll('.unit-seg [data-unidad]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.unidad === next));
  });
  const unitSeg = root.querySelector('.unit-seg');
  if (unitSeg) requestAnimationFrame(() => syncSegThumb(unitSeg));
  const input = root.querySelector('input[name="peso"]');
  if (input && pesoKg != null) input.value = fmtWeight(pesoKg, next);
  root.querySelectorAll('[data-kg]').forEach((n) => {
    const k = Number(n.dataset.kg);
    if (Number.isFinite(k)) n.textContent = fmtWeight(k, next);
  });
  root.querySelectorAll('[data-unit]').forEach((n) => { n.textContent = next; });
  const down = root.querySelector('[data-step-peso-down]');
  if (down) down.textContent = `−${weightStep(next)}`;
  const up = root.querySelector('[data-step-peso-up]');
  if (up) up.textContent = `+${weightStep(next)}`;
}

function stepInput(input, delta, { min = 0, decimals = false } = {}) {
  let curr = decimals ? parseFloat(input.value) : parseInt(input.value, 10);
  if (!Number.isFinite(curr) || curr < min) curr = min;
  const next = Math.max(min, decimals ? Math.round((curr + delta) * 100) / 100 : curr + delta);
  input.value = decimals || next !== 0 ? next : '';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

async function goToExercise(el, exs, id, { announce = false } = {}) {
  session.pendingNextEx = null;
  session.selectedEx = id;
  const ex = exs.find((e) => e.id === id);
  setActiveExercise(ex);
  if (ex && announce) toast(`Siguiente ejercicio: ${ex.nombre}`);
  await render(el);
}

function syncDraftControls(el) {
  const warm = session.draftTipo === 'calentamiento';
  el.querySelectorAll('[data-action="draft-tipo"]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.tipo === session.draftTipo));
  });
  const seg = el.querySelector('#draft-tipo-seg');
  if (seg) syncSegThumb(seg);
  el.querySelectorAll('[data-action="draft-rir"]').forEach((b) => {
    b.disabled = warm;
    b.setAttribute('aria-pressed', String(!warm && Number(b.dataset.rir) === session.draftRir));
  });
  const legend = el.querySelector('#rir-scale-legend');
  if (legend) legend.hidden = warm;
  syncSubmit(el);
}

/* ---------- Terminar o descartar ---------- */

async function confirmFinish(w) {
  const pre = await finishWorkoutSummary(w.id);
  const u = weightUnit();
  return askConfirm({
    title: '¿Terminar el entreno?',
    body: 'Se guardará en tu historial y verás el progreso.',
    stats: [
      { value: String(pre.totalSets), label: pre.totalSets === 1 ? 'serie' : 'series' },
      { value: formatDuration(now() - w.startedAt), label: 'duración', mono: true },
      { value: fmtVolume(pre.volumenTotal, u) || '0', label: `${u} movidos` },
    ],
    confirmLabel: 'Terminar y guardar',
    cancelLabel: 'Seguir entrenando',
    danger: false,
    stacked: true,
  });
}

/* Bía recuerda la sesión y, si falta, recuerda la creatina al despedirse. */
async function tellBiaWorkoutDone(w) {
  const summary = await finishWorkoutSummary(w.id);
  if (summary.totalSets <= 0) return;
  const u = weightUnit();
  const vol = fmtVolume(summary.volumenTotal, u);
  const fecha = new Date(now()).toLocaleDateString('es');
  await saveMemory(`Sesión completada el ${fecha}: ${summary.detalles}. Volumen total: ${vol} ${u} en ${summary.totalSets} series.`);
  let cierre = `La sesión de entrenamiento ha finalizado. Resumen: ${summary.totalSets} series, volumen total ${vol} ${u}.`;
  if (!(await creatineSummary()).tomadaHoy) {
    cierre += ' Creatina de hoy: no tomada. Al despedirte, dilo en una sola frase y no lo repitas.';
  }
  getActiveAgent()?.sendContext(cierre);
}

function forgetActiveWorkout() {
  state.activeWorkoutId = null;
  state.activeExercise = null;
  session.restEnd = 0;
  setRestControls(null);
  clearActiveRest();
}

function confirmDiscard(w, groups) {
  const n = groups.reduce((sum, g) => sum + g.sets.length, 0);
  const dur = esc(formatDuration(now() - w.startedAt));
  return askConfirm({
    title: '¿Descartar este entreno?',
    bodyHtml: n
      ? `Se ${n === 1 ? 'perderá la' : 'perderán las'} <strong>${n} ${n === 1 ? 'serie guardada' : 'series guardadas'}</strong> (${dur}). Esta acción no se puede deshacer.`
      : `Se borrará este entreno sin series (${dur}). Esta acción no se puede deshacer.`,
    confirmLabel: 'Descartar entreno',
    cancelLabel: 'Cancelar',
    variant: 'alert',
    icon: 'trash',
    stacked: true,
    safeFirst: true,
  });
}

/* ---------- Guardar una serie ---------- */

/* Un doble toque no crea dos series: mientras se guarda, el segundo toque no hace nada.
 * Sin candado de tiempo: dos series iguales seguidas, anotadas rápido, son dos series. */
async function saveSet(el, f, d) {
  if (session.saving) return;
  session.saving = true;
  try {
    await saveSetNow(el, f, d);
  } finally {
    session.saving = false;
  }
}

async function saveSetNow(el, f, d) {
  const exerciseId = Number(f.elements.exerciseId.value);
  const peso = toKg(num(f.elements.peso.value));
  const reps = parseInt(f.elements.reps.value, 10);
  if (!Number.isFinite(peso) || peso < 0 || peso > MAX_PESO_KG || !(reps > 0)) {
    toast('Revisa el peso y las repeticiones.', { tone: 'warn' });
    return;
  }
  const working = session.draftTipo === 'trabajo';
  if (working && !Number.isFinite(session.draftRir)) {
    toast('Elige el esfuerzo (0–4).', { tone: 'warn' });
    el.querySelector('#rir-pick')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return;
  }

  const rir = working ? session.draftRir : null;
  const restEnd = now() + restSeconds(reps, state.settings, { rir, tipo: session.draftTipo }) * 1000;
  const saved = await registerSet({
    workoutId: d.w.id,
    exerciseId,
    peso,
    reps,
    tipo: session.draftTipo,
    rir: working ? rir : undefined,
    restEnd,
  }, { abrirPregunta: false });

  session.restEnd = restEnd;
  session.selectedEx = exerciseId;
  session.lastReps = reps;
  session.lastRir = rir;
  session.lastTipo = session.draftTipo;
  await saveActiveRest(restEnd, reps, { rir, tipo: session.draftTipo });
  session.pendingNextEx = nextRoutineStep(d.w.routineExercises, exerciseId, d.prevSets.length, d.curExSets.length + 1);
  session.draftTipo = 'trabajo';
  session.draftRir = null;

  // El descanso empezó: el micrófono se abre para hablar con Bía durante la pausa.
  getActiveAgent()?.unmuteMic();

  const prevPR = d.pr?.maxPeso ?? 0;
  if (saved?.aviso) toast(saved.aviso);
  else if (peso > prevPR && prevPR > 0) toast(`Nuevo récord: ${fmtWeight(peso)} ${weightUnit()}`);
  await render(el);
}

/* ---------- Oyentes ---------- */

function bindActive(el, d) {
  const { w, exs } = d;
  const rerender = () => render(el);

  delegate(el, {
    unidad: async (t) => {
      const next = t.dataset.unidad === 'lb' ? 'lb' : 'kg';
      const prev = weightUnit();
      if (next === prev) return;
      const raw = num(el.querySelector('input[name="peso"]')?.value);
      const kg = Number.isFinite(raw) ? toKg(raw, prev) : null;
      await saveSettings({ unidad: next });
      applyUnitLive(el, next, kg);
    },
    'del-set': async (t) => {
      const ok = await askConfirm({ title: 'Borrar serie', body: 'Se quitará esta serie del entreno.' });
      if (!ok) return;
      await deleteSet(Number(t.dataset.id));
      await rerender();
    },
    'step-peso': (t) => {
      const input = el.querySelector('input[name="peso"]');
      const step = weightUnit() === 'lb' ? 5 : 2.5;
      if (input) stepInput(input, Number(t.dataset.dir || 1) * step, { decimals: true });
    },
    'step-reps': (t) => {
      const input = el.querySelector('input[name="reps"]');
      if (input) stepInput(input, Number(t.dataset.dir || 1));
    },
    'draft-tipo': (t) => {
      session.draftTipo = t.dataset.tipo === 'calentamiento' ? 'calentamiento' : 'trabajo';
      if (session.draftTipo === 'calentamiento') session.draftRir = null;
      syncDraftControls(el);
    },
    'draft-rir': (t) => {
      session.draftRir = Number(t.dataset.rir);
      syncDraftControls(el);
    },
    'effort-open': async (t) => {
      const id = Number(t.dataset.id);
      session.openEffortId = session.openEffortId === id ? null : id;
      await rerender();
    },
    'effort-rir': async (t) => {
      const res = await setEffort(Number(t.dataset.id), Number(t.dataset.rir));
      if (!res?.ok) { toast('No se pudo anotar el esfuerzo.', { tone: 'danger' }); return; }
      session.openEffortId = null;
      await rerender();
    },
    'set-tipo': async (t) => {
      await setTipo(Number(t.dataset.id), t.dataset.tipo);
      session.openEffortId = null;
      await rerender();
    },
    finish: () => finishFlow(w),
    discard: async () => {
      if (!(await confirmDiscard(w, d.groups))) return;
      await deleteWorkout(w.id);
      forgetActiveWorkout();
      await rerender();
    },
  });

  changes(el, {
    exercise: async (t) => {
      const ex = exs.find((e) => e.id === Number(t.value));
      getActiveAgent()?.sendContext(`Ejercicio seleccionado: ${ex?.nombre} (${ex?.grupo}).`);
      await goToExercise(el, exs, Number(t.value));
    },
  });

  forms(el, { set: (f) => saveSet(el, f, d) });

  bindExerciseEdit(el, async (e) => {
    await openExerciseEditor(Number(e.detail?.id), async (result) => {
      if (!result) return;
      if (result.deleted && session.selectedEx === result.id) session.selectedEx = null;
      else if (!result.deleted) session.selectedEx = result.id;
      await rerender();
      toast(result.deleted ? 'Ejercicio eliminado' : 'Ejercicio guardado');
    });
  });

  /* Un solo oyente aunque la pantalla se repinte: si no, cada alta repintaba varias veces. */
  if (el._onExerciseCreated) el.removeEventListener('exercise-created', el._onExerciseCreated);
  el._onExerciseCreated = async (e) => {
    const { id, nombre } = e.detail;
    session.selectedEx = id;
    await rerender();
    toast(`Ejercicio creado: «${nombre}»`);
  };
  el.addEventListener('exercise-created', el._onExerciseCreated);
}
