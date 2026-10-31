/* Lógica de entrenamientos, ejercicios y progreso. Las vistas solo llaman a estas funciones. */
import { db } from '../db.js';
import { now } from '../utils/clock.js';
import { todayISO, startOfWeekISO, addDays } from '../utils/dates.js';
import { isCatalogExercise, BASE } from './seed.js';
import { PENDING_KEY, effortPhrase } from './effort.js';

export { isCatalogExercise };

export const GRUPOS = ['Pecho', 'Espalda', 'Piernas', 'Hombros', 'Bíceps', 'Tríceps', 'Core', 'Cardio', 'Otro'];

export function normalizeGrupo(grupo) {
  let g = String(grupo || '').trim();
  if (!g) return 'Otro';
  if (/b[\?íi\uFFFD]ceps/i.test(g)) return 'Bíceps';
  if (/tr[\?íi\uFFFD]ceps/i.test(g)) return 'Tríceps';
  if (/pecho|pectoral/i.test(g)) return 'Pecho';
  if (/espalda|dorsal/i.test(g)) return 'Espalda';
  if (/pierna|cuadriceps|femoral|gluteo/i.test(g)) return 'Piernas';
  if (/hombro|deltoid/i.test(g)) return 'Hombros';
  if (/core|abdomen|abdominal/i.test(g)) return 'Core';
  if (/cardio/i.test(g)) return 'Cardio';
  const match = GRUPOS.find((v) => v.toLowerCase() === g.toLowerCase());
  return match || (GRUPOS.includes(g) ? g : 'Otro');
}

export function cleanExerciseName(nombre) {
  let n = String(nombre || '').trim();
  if (!n) return '';
  n = n.replace(/Jal[\?\uFFFD]n/gi, 'Jalón')
       .replace(/b[\?\uFFFD]ceps/gi, 'bíceps')
       .replace(/tr[\?\uFFFD]ceps/gi, 'tríceps')
       .replace(/Extensi[\?\uFFFD]n/gi, 'Extensión')
       .replace(/p[\?\uFFFD]ndulo/gi, 'péndulo')
       .replace(/[\?\uFFFD]n\b/gi, 'ón');
  return n;
}

/* "Otro" no nombra un músculo: no se muestra. Si viene con caracteres rotos o mayúsculas se normaliza. */
export function muscleName(grupo) {
  const g = normalizeGrupo(grupo);
  return g && g !== 'Otro' ? g : '';
}

/* Músculo o enfoque específico de cada ejercicio. */
const FOCO = {
  // Pecho
  'Press banca': 'pectoral mayor y tríceps',
  'Press inclinado con mancuernas': 'pectoral superior (clavicular)',
  'Aperturas': 'pectoral (estiramiento y aislamiento)',
  'Press en poleas': 'pectoral (tensión constante)',
  'Press Hammer': 'pectoral medio e inferior',
  'Flexiones': 'pectoral y core',

  // Espalda
  'Dominadas': 'dorsal ancho y bíceps',
  'Remo con barra': 'espalda media y dorsal',
  'Jalón al pecho': 'dorsal ancho',
  'Peso muerto': 'cadena posterior y lumbar',
  'Remo unilateral': 'dorsal ancho',
  'Remo T': 'espalda media y romboides',
  'Jalón a la cara': 'deltoides posterior y trapecio',

  // Piernas
  'Sentadilla': 'cuádriceps y glúteo',
  'Prensa de piernas': 'cuádriceps y glúteo (inclinada)',
  'Prensa de piernas vertical': 'cuádriceps y glúteo (90°)',
  'Peso muerto rumano': 'isquios y glúteo',
  'Zancadas': 'glúteo y cuádriceps',
  'Extensión de pierna': 'cuádriceps (aislamiento)',
  'Sentadilla péndulo': 'cuádriceps y glúteo',

  // Hombros
  'Press militar': 'deltoides anterior',
  'Elevaciones laterales': 'deltoides lateral',
  'Elevaciones frontales': 'deltoides anterior',

  // Bíceps
  'Curl de bíceps': 'bíceps braquial',
  'Curl martillo': 'braquial y antebrazo',

  // Tríceps
  'Fondos': 'tríceps y pectoral inferior',
  'Extensión de tríceps': 'tríceps (cabeza lateral/medial)',
  'Copa': 'tríceps (cabeza larga)',

  // Core
  'Plancha': 'estabilidad y transverso',
  'Crunch en polea': 'recto abdominal',
};

export function muscleFocus(nombre) {
  const n = String(nombre || '').trim();
  if (!n) return '';
  if (FOCO[n]) return FOCO[n];
  const target = foldName(n);
  for (const [key, val] of Object.entries(FOCO)) {
    if (foldName(key) === target) return val;
  }
  return '';
}

function foldName(value) {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function sameStem(a, b) {
  return a === b || a + 's' === b || b + 's' === a || a + 'es' === b || b + 'es' === a;
}

/* Palabras que no distinguen un ejercicio de otro. */
const RELLENO = new Set(['de', 'del', 'al', 'a', 'con', 'en', 'el', 'la', 'los', 'las', 'y', 'para', 'un', 'una']);

/* Lo único que puede sobrar en la frase: el músculo. «búlgara», «mancuernas» o «martillo» no sobran: cambian el ejercicio. */
const MUSCULO = new Set([
  'pecho', 'pectoral', 'pectorales', 'espalda', 'dorsal', 'dorsales', 'pierna', 'piernas',
  'cuadriceps', 'femoral', 'femorales', 'isquios', 'isquiotibiales', 'gluteo', 'gluteos',
  'hombro', 'hombros', 'deltoides', 'biceps', 'triceps', 'core', 'abdomen', 'abdominal', 'abdominales',
  'gemelo', 'gemelos', 'pantorrilla', 'pantorrillas', 'trapecio', 'trapecios', 'lumbar', 'lumbares',
  'brazo', 'brazos', 'antebrazo', 'antebrazos',
]);

function palabras(folded) {
  return folded.split(/[^a-z0-9]+/).filter((w) => w && !RELLENO.has(w));
}

/* Tercera regla: todas las palabras del nombre guardado están en la frase y lo que sobra es solo músculo.
 * «aperturas de pecho» → Aperturas. «sentadilla búlgara» no es Sentadilla. Gana el nombre con más palabras; si empatan, son varios. */
function matchByWords(q, list) {
  const dichas = palabras(q);
  if (!dichas.length) return [];
  const hits = [];
  for (const e of list) {
    const suyas = palabras(foldName(e.nombre));
    if (!suyas.length) continue;
    const usadas = new Set();
    const todas = suyas.every((p) => {
      const i = dichas.findIndex((d, k) => !usadas.has(k) && sameStem(d, p));
      if (i < 0) return false;
      usadas.add(i);
      return true;
    });
    if (!todas) continue;
    const sobran = dichas.filter((_, k) => !usadas.has(k));
    if (sobran.every((d) => MUSCULO.has(d))) hits.push({ e, n: suyas.length });
  }
  if (!hits.length) return [];
  const max = Math.max(...hits.map((h) => h.n));
  return hits.filter((h) => h.n === max).map((h) => h.e);
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
  const byWords = matchByWords(q, list);
  if (byWords.length === 1) return { status: 'one', exercise: byWords[0] };
  if (byWords.length > 1) return { status: 'many', exercises: byWords };
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

export async function sanitizeExercises() {
  try {
    const all = await db.getAll('exercises').catch(() => []);
    if (!all.length) return;

    const byName = new Map();
    for (const ex of all) {
      let cleanName = cleanExerciseName(ex.nombre);
      const baseMatch = BASE.find(([bName]) => foldName(bName) === foldName(cleanName));
      if (baseMatch) cleanName = baseMatch[0];
      const cleanGrupo = baseMatch ? baseMatch[1] : normalizeGrupo(ex.grupo);
      const key = foldName(cleanName);
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push({ ex, cleanName, cleanGrupo });
    }

    for (const [, list] of byName) {
      try {
        const canonical = list.find((item) => item.ex.nombre === item.cleanName) || list[0];
        const duplicates = list.filter((item) => item.ex.id !== canonical.ex.id);

        for (const dup of duplicates) {
          try {
            const sets = await db.byIndex('sets', 'exerciseId', dup.ex.id);
            for (const s of sets) {
              await db.put('sets', { ...s, exerciseId: canonical.ex.id });
            }
            await db.remove('exercises', dup.ex.id);
          } catch (dupErr) {
            console.warn('Error fusionando ejercicio duplicado:', dup.ex, dupErr);
          }
        }

        if (canonical.ex.nombre !== canonical.cleanName || canonical.ex.grupo !== canonical.cleanGrupo) {
          await db.put('exercises', {
            ...canonical.ex,
            nombre: canonical.cleanName,
            grupo: canonical.cleanGrupo,
          });
        }
      } catch (itemErr) {
        console.warn('Error sanitizando ejercicio:', itemErr);
      }
    }
  } catch (e) {
    console.warn('Error en sanitizeExercises:', e);
  }
}

export async function listExercises() {
  await sanitizeExercises();
  return (await db.getAll('exercises')).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export async function addExercise(nombre, grupo = 'Otro') {
  nombre = String(nombre || '').trim();
  if (!nombre) throw new Error('Escribe el nombre del ejercicio.');
  grupo = normalizeGrupo(grupo);
  const all = await db.getAll('exercises').catch(() => []);
  const dup = all.find((e) => e.nombre.toLowerCase() === nombre.toLowerCase());
  if (dup) throw new Error('Ese ejercicio ya existe.');
  try {
    return await db.add('exercises', { nombre, grupo });
  } catch (e) {
    if (e?.name === 'ConstraintError' || (e?.message && e.message.toLowerCase().includes('constraint'))) {
      throw new Error('Ese ejercicio ya existe.');
    }
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
  grupo = normalizeGrupo(grupo);
  const all = await db.getAll('exercises').catch(() => []);
  const dup = all.find((e) => e.id !== ex.id && e.nombre.toLowerCase() === nombre.toLowerCase());
  if (dup) throw new Error('Ese ejercicio ya existe.');
  try {
    await db.put('exercises', { ...ex, nombre, grupo });
  } catch (e) {
    if (e?.name === 'ConstraintError' || (e?.message && e.message.toLowerCase().includes('constraint'))) {
      throw new Error('Ese ejercicio ya existe.');
    }
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

export async function startWorkout(fromWorkoutId = null) {
  const existing = await getActiveWorkout();
  if (existing) return existing;
  let routineExercises = null;
  let routineTitle = null;
  if (fromWorkoutId) {
    const detail = await getWorkoutDetail(fromWorkoutId);
    if (detail && detail.groups) {
      routineExercises = detail.groups.map((g) => g.exercise.id);
      const groups = [...new Set(detail.groups.map((g) => muscleName(g.exercise.grupo) || g.exercise.grupo).filter(Boolean))];
      routineTitle = groups.length ? groups.join(', ') : 'Rutina anterior';
    }
  }
  const w = {
    fecha: todayISO(),
    startedAt: now(),
    finishedAt: null,
    notas: '',
    ...(routineExercises ? { routineExercises, routineTitle, fromWorkoutId } : {})
  };
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
export { removeLoggedSet as deleteSet, updateSet } from './effort.js';
export const getSets = (workoutId) => db.byIndex('sets', 'workoutId', workoutId);

export async function lastSetFor(exerciseId) {
  const sets = await db.byIndex('sets', 'exerciseId', exerciseId);
  return sets.sort((a, b) => b.ts - a.ts)[0] || null;
}

/* Series de la última sesión en la que se realizó este ejercicio (excluye la sesión activa). */
export async function lastSessionSetsFor(exerciseId) {
  const [sets, ws] = await Promise.all([
    db.byIndex('sets', 'exerciseId', exerciseId),
    db.getAll('workouts'),
  ]);
  const active = await getActiveWorkout();
  const wMap = new Map(ws.map((w) => [w.id, w]));

  // Agrupamos las series del ejercicio por workoutId y buscamos el entreno finalizado más reciente
  const sessionMap = new Map();
  for (const s of sets) {
    if (active && s.workoutId === active.id) continue;
    const w = wMap.get(s.workoutId);
    if (!w || !w.finishedAt) continue;
    if (!sessionMap.has(s.workoutId)) {
      sessionMap.set(s.workoutId, { workout: w, sets: [] });
    }
    sessionMap.get(s.workoutId).sets.push(s);
  }

  const sortedSessions = [...sessionMap.values()]
    .sort((a, b) => b.workout.startedAt - a.workout.startedAt);

  if (!sortedSessions.length) return null;
  const latest = sortedSessions[0];
  latest.sets.sort((a, b) => a.ts - b.ts);
  return latest;
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
  const [ws, sets, exs] = await Promise.all([
    db.getAll('workouts'),
    db.getAll('sets'),
    db.getAll('exercises')
  ]);
  const exMap = new Map(exs.map((e) => [e.id, e]));
  const agg = new Map();
  for (const s of sets) {
    let a = agg.get(s.workoutId);
    if (!a) {
      a = { n: 0, v: 0, grupos: new Map() };
      agg.set(s.workoutId, a);
    }
    a.n++;
    a.v += (s.peso || 0) * (s.reps || 0);
    const ex = exMap.get(s.exerciseId);
    const g = muscleName(ex?.grupo);
    if (g) {
      a.grupos.set(g, (a.grupos.get(g) || 0) + 1);
    }
  }
  return ws
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, limit)
    .map((w) => {
      const data = agg.get(w.id);
      let gruposArr = [];
      if (data?.grupos) {
        gruposArr = [...data.grupos.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([name]) => name);
      }
      return {
        ...w,
        totalSets: data?.n || 0,
        volumen: data?.v || 0,
        grupos: gruposArr
      };
    });
}

export async function weekStats() {
  const start = startOfWeekISO();
  const end = addDays(start, 7);
  const [ws, sets, exs] = await Promise.all([db.getAll('workouts'), db.getAll('sets'), db.getAll('exercises')]);
  const inWeek = ws.filter((w) => w.fecha >= start && w.fecha < end);
  const ids = new Set(inWeek.map((w) => w.id));
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
    dias: [...new Set(inWeek.map((w) => w.fecha))],
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
