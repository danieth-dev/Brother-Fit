/* Lógica de entrenamientos, ejercicios y progreso. Las vistas solo llaman a estas funciones. */
import { db } from '../db.js';
import { now } from '../utils/clock.js';
import { todayISO, startOfWeekISO } from '../utils/dates.js';
import { isCatalogExercise } from './seed.js';
import { PENDING_KEY, effortPhrase } from './effort.js';

export { isCatalogExercise };

export const GRUPOS = ['Pecho', 'Espalda', 'Piernas', 'Hombros', 'Bíceps', 'Tríceps', 'Core', 'Cardio', 'Otro'];

/* "Otro" no nombra un músculo: no se muestra. */
export function muscleName(grupo) {
  const g = String(grupo || '').trim();
  return g && g !== 'Otro' ? g : '';
}

/* Parte concreta, cuando el grupo se queda corto. El nombre tiene que coincidir exactamente. */
const FOCO = {
  'Sentadilla péndulo': 'cuádriceps y glúteo',
};

export function muscleFocus(nombre) {
  return FOCO[String(nombre || '').trim()] || '';
}

function foldName(value) {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function sameStem(a, b) {
  return a === b || a + 's' === b || b + 's' === a || a + 'es' === b || b + 'es' === a;
}

/* El modelo dice el texto. La app elige la fila. Vacío: no nombró ninguno. */
export function matchExercise(spoken, exercises) {
  const q = foldName(spoken);
  if (!q) return { status: 'absent' };
  const list = Array.isArray(exercises) ? exercises : [];
  const exact = list.filter((e) => sameStem(foldName(e.nombre), q));
  if (exact.length === 1) return { status: 'one', exercise: exact[0] };
  if (exact.length > 1) return { status: 'many', exercises: exact };
  if (q.length < 4) return { status: 'none' };
  const partial = list.filter((e) => foldName(e.nombre).includes(q));
  if (partial.length === 1) return { status: 'one', exercise: partial[0] };
  if (partial.length > 1) return { status: 'many', exercises: partial };
  return { status: 'none' };
}

export const estimate1RM = (peso, reps) => (reps <= 1 ? peso : peso * (1 + reps / 30)); // Epley
export const volume = (sets) => sets.reduce((a, s) => a + s.peso * s.reps, 0);

/* Solo entran 6, 7, 8, 9 y 10. Un RPE viejo suelto, o uno fuera de ese rango, no se usa. */
export function rpeEnRango(rpe) {
  const n = Number(rpe);
  return Number.isInteger(n) && n >= 6 && n <= 10;
}

/* Escala aparte. reps efectivas = reps + (10 - rpe). RPE 6 suma 4 y es un piso. Por encima de 12 reps efectivas no es fiable. */
export function adjusted1RM(peso, reps, rpe) {
  if (!rpeEnRango(rpe)) return null;
  const r = Number(rpe);
  const eff = reps + (10 - r);
  return { value: peso * (1 + eff / 30), reliable: eff <= 12, floor: r === 6 };
}

/* ---------- Ejercicios ---------- */
export async function listExercises() {
  return (await db.getAll('exercises')).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export async function addExercise(nombre, grupo = 'Otro') {
  nombre = String(nombre || '').trim();
  if (!nombre) throw new Error('Escribe el nombre del ejercicio.');
  try {
    return await db.add('exercises', { nombre, grupo });
  } catch (e) {
    if (e?.name === 'ConstraintError') throw new Error('Ese ejercicio ya existe.');
    throw e;
  }
}

export function isOwnExercise(ex) {
  return !!ex && !isCatalogExercise(ex.nombre);
}

export async function getExercise(id) {
  return db.get('exercises', Number(id));
}

export async function countSetsForExercise(exerciseId) {
  const sets = await db.byIndex('sets', 'exerciseId', Number(exerciseId));
  return sets.length;
}

export async function updateExercise(id, nombre, grupo = 'Otro') {
  const ex = await db.get('exercises', Number(id));
  if (!ex) throw new Error('Ese ejercicio ya no está.');
  if (!isOwnExercise(ex)) throw new Error('El catálogo no se edita.');
  nombre = String(nombre || '').trim();
  if (!nombre) throw new Error('Escribe el nombre del ejercicio.');
  if (isCatalogExercise(nombre)) throw new Error('Ese nombre es del catálogo.');
  grupo = GRUPOS.includes(grupo) ? grupo : 'Otro';
  try {
    await db.put('exercises', { ...ex, nombre, grupo });
  } catch (e) {
    if (e?.name === 'ConstraintError') throw new Error('Ese ejercicio ya existe.');
    throw e;
  }
  return ex.id;
}

/* Borra el ejercicio y sus series en una sola transacción. Devuelve cuántas series salieron. */
export async function deleteExercise(id) {
  const ex = await db.get('exercises', Number(id));
  if (!ex) return 0;
  if (!isOwnExercise(ex)) throw new Error('El catálogo no se elimina.');
  const n = await countSetsForExercise(ex.id);
  await db.mutate(['sets', 'exercises', 'meta'], (tx) => {
    const meta = tx.objectStore('meta');
    const ids = [];
    tx.objectStore('exercises').delete(ex.id);
    const req = tx.objectStore('sets').index('exerciseId').openCursor(IDBKeyRange.only(ex.id));
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        ids.push(cursor.value.id);
        cursor.delete();
        cursor.continue();
        return;
      }
      const pReq = meta.get(PENDING_KEY);
      pReq.onsuccess = () => {
        const pending = pReq.result?.value;
        if (pending && ids.includes(pending.setId)) meta.delete(PENDING_KEY);
      };
    };
  });
  return n;
}

/* ---------- Entrenamiento activo ---------- */
export async function getActiveWorkout() {
  const m = await db.get('meta', 'activeWorkoutId');
  if (!m) return null;
  const w = await db.get('workouts', m.value);
  if (!w || w.finishedAt) { await db.remove('meta', 'activeWorkoutId'); return null; }
  return w;
}

const REST_KEY = 'activeRest';

export async function loadActiveRest() {
  const row = await db.get('meta', REST_KEY);
  const value = row?.value;
  if (!value?.restEnd || value.restEnd <= now()) {
    if (row) await db.remove('meta', REST_KEY);
    return null;
  }
  return value;
}

export async function saveActiveRest(restEnd, lastReps) {
  await db.put('meta', { key: REST_KEY, value: { restEnd, lastReps } });
}

export async function clearActiveRest() {
  await db.remove('meta', REST_KEY);
}

export async function startWorkout() {
  const existing = await getActiveWorkout();
  if (existing) return existing;
  const w = { fecha: todayISO(), startedAt: now(), finishedAt: null, notas: '' };
  w.id = await db.add('workouts', w);
  await db.put('meta', { key: 'activeWorkoutId', value: w.id });
  return w;
}

export async function finishWorkout(id) {
  await db.mutate(['workouts', 'meta'], (tx) => {
    const meta = tx.objectStore('meta');
    const req = tx.objectStore('workouts').get(id);
    req.onsuccess = () => {
      const w = req.result;
      if (!w) return;
      w.finishedAt = now();
      w.duracion = w.finishedAt - w.startedAt;
      tx.objectStore('workouts').put(w);
      meta.delete('activeWorkoutId');
      meta.delete(PENDING_KEY);
    };
  });
}

export async function finishWorkoutSummary(id) {
  const [sets, exercises] = await Promise.all([
    getSets(id),
    listExercises()
  ]);
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  let volumen = 0;
  const groups = {};
  for (const s of sets) {
    volumen += (s.peso || 0) * (s.reps || 0);
    const exName = exMap.get(s.exerciseId)?.nombre || 'Ejercicio';
    if (!groups[exName]) groups[exName] = [];
    groups[exName].push(setBit(s));
  }
  const lines = Object.entries(groups).map(([name, sList]) => `${name} (${sList.join(', ')})`);
  return {
    totalSets: sets.length,
    volumenTotal: Math.round(volumen),
    detalles: lines.join('; ')
  };
}

function setBit(s) {
  /* Resumen en kg canónicos: la memoria del agente y el historial hablado usan kg. */
  const base = `${s.peso}kg×${s.reps}`;
  if (s.tipo === 'calentamiento') return `${base} calentamiento`;
  if (s.tipo === 'trabajo' && (s.rpe == null || s.rpe === '')) return `${base} sin esfuerzo`;
  if (s.rpe != null && s.rpe !== '') return `${base} ${effortPhrase(s.rpe)}`;
  return base;
}

export async function deleteWorkout(id) {
  const sets = await getSets(id);
  const ids = new Set(sets.map((s) => s.id));
  await db.mutate(['sets', 'workouts', 'meta'], (tx) => {
    const meta = tx.objectStore('meta');
    for (const sid of ids) tx.objectStore('sets').delete(sid);
    tx.objectStore('workouts').delete(id);
    const aReq = meta.get('activeWorkoutId');
    const pReq = meta.get(PENDING_KEY);
    aReq.onsuccess = () => {
      if (aReq.result?.value === id) meta.delete('activeWorkoutId');
    };
    pReq.onsuccess = () => {
      const pending = pReq.result?.value;
      if (!pending) return;
      if (aReq.result?.value === id || ids.has(pending.setId)) meta.delete(PENDING_KEY);
    };
  });
}

/* ---------- Series ---------- */
export const addSet = (s) => db.add('sets', { ...s, ts: now() });
export { removeLoggedSet as deleteSet } from './effort.js';
export const getSets = (workoutId) => db.byIndex('sets', 'workoutId', workoutId);

export async function lastSetFor(exerciseId) {
  const sets = await db.byIndex('sets', 'exerciseId', exerciseId);
  return sets.sort((a, b) => b.ts - a.ts)[0] || null;
}

/* Series de la sesión ANTERIOR completa para un ejercicio (excluye la sesión activa). */
export async function lastSessionSetsFor(exerciseId) {
  const [sets, ws] = await Promise.all([
    db.byIndex('sets', 'exerciseId', exerciseId),
    db.getAll('workouts'),
  ]);
  const active = await getActiveWorkout();
  const sorted = ws
    .filter((w) => w.finishedAt && w.id !== active?.id)
    .sort((a, b) => b.startedAt - a.startedAt);
  if (!sorted.length) return null;
  const prevSets = sets.filter((s) => s.workoutId === sorted[0].id).sort((a, b) => a.ts - b.ts);
  return prevSets.length ? { workout: sorted[0], sets: prevSets } : null;
}

/* PRs históricos de un ejercicio: peso máximo, 1RM estimado máximo y reps máximas. */
export async function prByExercise(exerciseId) {
  const sets = await db.byIndex('sets', 'exerciseId', exerciseId);
  if (!sets.length) return { maxPeso: 0, maxReps: 0, e1rmMax: 0 };
  return {
    maxPeso: Math.max(...sets.map((s) => s.peso)),
    maxReps: Math.max(...sets.map((s) => s.reps)),
    e1rmMax: Math.max(...sets.map((s) => estimate1RM(s.peso, s.reps))),
  };
}

export async function lastTrainedExerciseId() {
  let best = null;
  for (const s of await db.getAll('sets')) if (!best || s.ts > best.ts) best = s;
  return best?.exerciseId ?? null;
}

/* ---------- Consultas ---------- */
export async function getWorkoutDetail(id) {
  const [w, sets, exs] = await Promise.all([db.get('workouts', id), getSets(id), db.getAll('exercises')]);
  if (!w) return null;
  const byId = new Map(exs.map((e) => [e.id, e]));
  sets.sort((a, b) => a.ts - b.ts);
  const groups = [];
  const index = new Map();
  for (const s of sets) {
    if (!index.has(s.exerciseId)) {
      index.set(s.exerciseId, groups.length);
      groups.push({ exercise: byId.get(s.exerciseId) || { id: s.exerciseId, nombre: '(ejercicio borrado)', grupo: 'Otro' }, sets: [] });
    }
    groups[index.get(s.exerciseId)].sets.push(s);
  }
  return { workout: w, groups, volumen: volume(sets), totalSets: sets.length };
}

export async function listWorkoutSummaries(limit = Infinity) {
  const [ws, sets] = await Promise.all([db.getAll('workouts'), db.getAll('sets')]);
  const agg = new Map();
  for (const s of sets) {
    const a = agg.get(s.workoutId) || { n: 0, v: 0 };
    a.n++; a.v += s.peso * s.reps;
    agg.set(s.workoutId, a);
  }
  return ws
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, limit)
    .map((w) => ({ ...w, totalSets: agg.get(w.id)?.n || 0, volumen: agg.get(w.id)?.v || 0 }));
}

export async function weekStats() {
  const start = startOfWeekISO();
  const [ws, sets, exs] = await Promise.all([db.getAll('workouts'), db.getAll('sets'), db.getAll('exercises')]);
  const ids = new Set(ws.filter((w) => w.fecha >= start).map((w) => w.id));
  const weekSets = sets.filter((s) => ids.has(s.workoutId));
  const byEx = new Map(exs.map((e) => [e.id, e]));
  const porGrupo = new Map();
  let efectivas = 0;
  let sinEsfuerzo = 0;
  let faciles = 0;
  for (const s of weekSets) {
    if (s.tipo !== 'trabajo') continue;
    const r = Number(s.rpe);
    const tiene = s.rpe != null && s.rpe !== '' && Number.isFinite(r);
    if (!tiene) { sinEsfuerzo++; continue; }
    if (r < 7) { faciles++; continue; }
    efectivas++;
    const grupo = byEx.get(s.exerciseId)?.grupo || 'Otro';
    porGrupo.set(grupo, (porGrupo.get(grupo) || 0) + 1);
  }
  return {
    entrenos: ids.size,
    volumen: volume(weekSets),
    efectivas,
    sinEsfuerzo,
    faciles,
    porGrupo: [...porGrupo.entries()].map(([grupo, n]) => ({ grupo, n })).sort((a, b) => b.n - a.n),
  };
}

/* Sesiones agrupadas por día para un ejercicio: peso máx., 1RM estimado y volumen. */
export async function progressForExercise(exerciseId) {
  const [sets, ws] = await Promise.all([db.byIndex('sets', 'exerciseId', exerciseId), db.getAll('workouts')]);
  const fechaDe = new Map(ws.map((w) => [w.id, w.fecha]));
  const byDay = new Map();
  for (const s of sets) {
    const f = fechaDe.get(s.workoutId);
    if (!f) continue;
    const d = byDay.get(f) || { fecha: f, maxPeso: 0, e1rm: 0, volumen: 0, series: 0, adj: null, adjReliable: true, adjFloor: false };
    d.maxPeso = Math.max(d.maxPeso, s.peso);
    d.e1rm = Math.max(d.e1rm, estimate1RM(s.peso, s.reps));
    d.volumen += s.peso * s.reps;
    d.series++;
    if (s.tipo === 'trabajo') {
      const adj = adjusted1RM(s.peso, s.reps, s.rpe);
      if (adj && (d.adj == null || adj.value > d.adj)) {
        d.adj = adj.value;
        d.adjReliable = adj.reliable;
        d.adjFloor = adj.floor;
      }
    }
    byDay.set(f, d);
  }
  const sessions = [...byDay.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
  return { sessions, pr: sessions.reduce((m, d) => Math.max(m, d.maxPeso), 0) };
}
