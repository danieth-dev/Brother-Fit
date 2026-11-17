/* Reglas del entreno en curso que no tocan la base: descanso sugerido, título de una sesión,
 * orden de la lista de ejercicios y el siguiente paso de una rutina repetida. */

/* Descanso automático según las repeticiones de la última serie (fuerza descansa más). Nunca menos
 * de 1:30: por debajo de un minuto el rendimiento de la serie siguiente cae, y una serie larga
 * también cansa. Ajustes dibuja esta misma tabla. */
export const REST_ZONES = [
  { maxReps: 5, range: '1–5', secs: 180, label: 'Fuerza · 3 min' },
  { maxReps: 8, range: '6–8', secs: 120, label: 'Fuerza-Hipertrofia · 2 min' },
  { maxReps: 12, range: '9–12', secs: 90, label: 'Hipertrofia · 1:30' },
  { maxReps: Infinity, range: '13+', secs: 90, label: 'Resistencia · 1:30' },
];

/* Segundos extra según cuántas repeticiones más podía hacer (RIR). Al fallo la fatiga es mayor y
 * tarda más en pasar; con 2 o más en reserva no hace falta. Es un ajuste moderado: los estudios
 * dan rangos, no una cifra exacta. */
export const RIR_BONUS = { 0: 30, 1: 15 };

const RIR_REASON = { 0: 'por llegar al fallo', 1: 'por quedarte a 1' };

export function restZone(reps) {
  return REST_ZONES.find((z) => reps <= z.maxReps);
}

/** Segundos extra por el esfuerzo de una serie de trabajo; 0 en calentamiento o sin esfuerzo. */
export function effortBonus(rir, tipo = 'trabajo') {
  if (tipo === 'calentamiento' || !Number.isInteger(rir)) return 0;
  return RIR_BONUS[rir] ?? 0;
}

/** Segundos de descanso: en automático, la zona más el esfuerzo; en manual, los fijos de Ajustes. */
export function restSeconds(reps, { descansoMode, descanso }, { rir = null, tipo = 'trabajo' } = {}) {
  if (descansoMode !== 'auto') return descanso;
  return restZone(reps).secs + effortBonus(rir, tipo);
}

/** «Hipertrofia · 1:30 + 30 s por llegar al fallo», o solo la zona si no hay ajuste. */
export function restLabel(reps, { rir = null, tipo = 'trabajo' } = {}) {
  const zone = restZone(reps).label;
  const bonus = effortBonus(rir, tipo);
  return bonus ? `${zone} + ${bonus} s ${RIR_REASON[rir]}` : zone;
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
 * La rutina está hecha cuando el atleta está en el último ejercicio de la sesión que repite y cada
 * ejercicio tiene hoy al menos sus series de entonces (o una, si de esa no se sabe).
 * done y planned: Map de id de ejercicio → series.
 */
export function routineComplete(routine, currentId, done, planned) {
  if (!routine?.length || routine.at(-1) !== currentId) return false;
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
