/* Lógica de entrenamientos, ejercicios y progreso. Las vistas solo llaman a estas funciones. */
import { db } from '../db.js';
import { todayISO, startOfWeekISO } from '../utils/dates.js';
import { isCatalogExercise } from './seed.js';

export { isCatalogExercise };

export const GRUPOS = ['Pecho', 'Espalda', 'Piernas', 'Hombros', 'Bíceps', 'Tríceps', 'Core', 'Cardio', 'Otro'];

/* "Otro" no nombra un músculo: no se muestra. */
export function muscleName(grupo) {
  const g = String(grupo || '').trim();
  return g && g !== 'Otro' ? g : '';
}

export const estimate1RM = (peso, reps) => (reps <= 1 ? peso : peso * (1 + reps / 30)); // Epley
export const volume = (sets) => sets.reduce((a, s) => a + s.peso * s.reps, 0);

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
  await db.mutate(['sets', 'exercises'], (tx) => {
    const req = tx.objectStore('sets').index('exerciseId').openCursor(IDBKeyRange.only(ex.id));
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      cursor.delete();
      cursor.continue();
    };
    tx.objectStore('exercises').delete(ex.id);
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
  if (!value?.restEnd || value.restEnd <= Date.now()) {
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
  const w = { fecha: todayISO(), startedAt: Date.now(), finishedAt: null, notas: '' };
  w.id = await db.add('workouts', w);
  await db.put('meta', { key: 'activeWorkoutId', value: w.id });
  return w;
}

export async function finishWorkout(id) {
  const w = await db.get('workouts', id);
  if (!w) return;
  w.finishedAt = Date.now();
  w.duracion = w.finishedAt - w.startedAt;
  await db.put('workouts', w);
  await db.remove('meta', 'activeWorkoutId');
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
    groups[exName].push(`${s.peso}kg×${s.reps}`);
  }
  const lines = Object.entries(groups).map(([name, sList]) => `${name} (${sList.join(', ')})`);
  return {
    totalSets: sets.length,
    volumenTotal: Math.round(volumen),
    detalles: lines.join('; ')
  };
}

export async function deleteWorkout(id) {
  const sets = await getSets(id);
  await Promise.all(sets.map((s) => db.remove('sets', s.id)));
  await db.remove('workouts', id);
  const m = await db.get('meta', 'activeWorkoutId');
  if (m?.value === id) await db.remove('meta', 'activeWorkoutId');
}

/* ---------- Series ---------- */
export const addSet = (s) => db.add('sets', { ...s, ts: Date.now() });
export const deleteSet = (id) => db.remove('sets', id);
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
  const [ws, sets] = await Promise.all([db.getAll('workouts'), db.getAll('sets')]);
  const ids = new Set(ws.filter((w) => w.fecha >= start).map((w) => w.id));
  return { entrenos: ids.size, volumen: volume(sets.filter((s) => ids.has(s.workoutId))) };
}

/* Sesiones agrupadas por día para un ejercicio: peso máx., 1RM estimado y volumen. */
export async function progressForExercise(exerciseId) {
  const [sets, ws] = await Promise.all([db.byIndex('sets', 'exerciseId', exerciseId), db.getAll('workouts')]);
  const fechaDe = new Map(ws.map((w) => [w.id, w.fecha]));
  const byDay = new Map();
  for (const s of sets) {
    const f = fechaDe.get(s.workoutId);
    if (!f) continue;
    const d = byDay.get(f) || { fecha: f, maxPeso: 0, e1rm: 0, volumen: 0, series: 0 };
    d.maxPeso = Math.max(d.maxPeso, s.peso);
    d.e1rm = Math.max(d.e1rm, estimate1RM(s.peso, s.reps));
    d.volumen += s.peso * s.reps;
    d.series++;
    byDay.set(f, d);
  }
  const sessions = [...byDay.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
  return { sessions, pr: sessions.reduce((m, d) => Math.max(m, d.maxPeso), 0) };
}
