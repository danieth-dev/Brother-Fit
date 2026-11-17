/* Reglas del entreno en curso que no tocan la base: descanso sugerido, título de una sesión,
 * orden de la lista de ejercicios y el siguiente paso de una rutina repetida. */

/* Descanso automático según las repeticiones de la última serie (fuerza descansa más). */
const REST_ZONES = [
  { maxReps: 5, secs: 180, label: 'Fuerza · 3 min' },
  { maxReps: 8, secs: 120, label: 'Fuerza-Hipertrofia · 2 min' },
  { maxReps: 12, secs: 90, label: 'Hipertrofia · 1:30' },
  { maxReps: Infinity, secs: 60, label: 'Resistencia · 1 min' },
];

export function restZone(reps) {
  return REST_ZONES.find((z) => reps <= z.maxReps);
}

/** Segundos de descanso: los del modo automático o los fijos de Ajustes. */
export function restSeconds(reps, { descansoMode, descanso }) {
  return descansoMode === 'auto' ? restZone(reps).secs : descanso;
}

/** «Pecho», «Pecho y Espalda», «Pecho, Espalda y Hombros» o «Pecho, Espalda (+2)». */
export function workoutTitle(grupos = []) {
  const gs = grupos || [];
  if (!gs.length) return 'Entrenamiento';
  if (gs.length === 1) return gs[0];
  if (gs.length === 2) return `${gs[0]} y ${gs[1]}`;
  if (gs.length === 3) return `${gs[0]}, ${gs[1]} y ${gs[2]}`;
  return `${gs[0]}, ${gs[1]} (+${gs.length - 2})`;
}

/** Orden de la lista: primero los de hoy, luego los de la rutina, luego el catálogo como estaba. */
export function orderExercises(exs, todayIds = [], routineIds = []) {
  const rank = (ids) => new Map(ids.map((id, i) => [id, i]));
  const today = rank(todayIds);
  const routine = rank(routineIds);
  const pos = (map, id) => (map.has(id) ? map.get(id) : Infinity);
  /* Dos ausentes dan Infinity - Infinity = NaN, que es falso: pasa al siguiente criterio. */
  return exs
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (pos(today, a.e.id) - pos(today, b.e.id))
      || (pos(routine, a.e.id) - pos(routine, b.e.id))
      || (a.i - b.i))
    .map(({ e }) => e);
}

export const ROUTINE_DONE = 'DONE';

/**
 * La rutina está hecha solo si cada uno de sus ejercicios tiene hoy al menos las series de la sesión
 * que se repite (o una, si de esa no se sabe). done y planned: Map de id de ejercicio → series.
 */
export function routineComplete(routine, done, planned) {
  if (!routine?.length) return false;
  return routine.every((id) => (done.get(id) || 0) >= Math.max(1, planned.get(id) || 0));
}

/**
 * Tras guardar una serie de una rutina repetida: si ya igualó las series de la sesión anterior,
 * el siguiente ejercicio de la rutina, ROUTINE_DONE si era el último, o null si sigue con este.
 */
export function nextRoutineStep(routine, exerciseId, plannedCount, doneCount) {
  if (!routine?.length || !(plannedCount > 0) || doneCount < plannedCount) return null;
  const idx = routine.indexOf(exerciseId);
  if (idx < 0) return null;
  return idx < routine.length - 1 ? routine[idx + 1] : ROUTINE_DONE;
}
