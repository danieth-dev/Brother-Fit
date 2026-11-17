/* Reglas del entreno en curso que no tocan la base: descanso sugerido, título de una sesión,
 * orden de la lista de ejercicios y el siguiente paso de una rutina repetida. */

/* Descanso automático de una serie de trabajo según las repeticiones que PODÍA hacer con ese peso
 * (possibleReps: hechas + las que sobraban): cuanto más pesada la carga, más descanso. Nunca menos
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

/* «4 o más» se guarda como piso: cuenta como 4. */
const RIR_FLOOR = 4;

/* Un calentamiento no busca cansar: descanso corto. Con muchas repeticiones el volumen sí cansa
 * algo más (3 × 20 flexiones holgadas), así que pide un poco más. */
export const WARMUP_ZONES = [
  { maxReps: 10, range: '1–10', secs: 60, label: 'Calentamiento · 1:00' },
  { maxReps: Infinity, range: '11+', secs: 90, label: 'Calentamiento · 1:30' },
];

const isWarmup = (tipo) => tipo === 'calentamiento';
const validRir = (rir) => Number.isInteger(rir) && rir >= 0;

export function restZone(reps) {
  return REST_ZONES.find((z) => reps <= z.maxReps);
}

function warmupZone(reps) {
  return WARMUP_ZONES.find((z) => reps <= z.maxReps);
}

/**
 * Cuántas repeticiones podía hacer con ese peso: las hechas más las que le sobraban. Es lo que dice
 * lo pesada que fue la carga para él; las repeticiones solas no (10 kg × 5 con 4 de sobra no es
 * fuerza). Sin esfuerzo anotado, las hechas.
 */
export function possibleReps(reps, rir = null) {
  return validRir(rir) ? reps + Math.min(rir, RIR_FLOOR) : reps;
}

/** Segundos extra por el esfuerzo de una serie de trabajo; 0 en calentamiento o sin esfuerzo. */
export function effortBonus(rir, tipo = 'trabajo') {
  if (isWarmup(tipo) || !validRir(rir)) return 0;
  return RIR_BONUS[rir] ?? 0;
}

/**
 * Segundos de descanso. En automático: un calentamiento, por sus repeticiones; una serie de trabajo,
 * por las repeticiones posibles más el ajuste cerca del fallo. En manual, los fijos de Ajustes.
 */
export function restSeconds(reps, { descansoMode, descanso }, { rir = null, tipo = 'trabajo' } = {}) {
  if (descansoMode !== 'auto') return descanso;
  if (isWarmup(tipo)) return warmupZone(reps).secs;
  return restZone(possibleReps(reps, rir)).secs + effortBonus(rir, tipo);
}

/** Lo que dice la hoja del descanso: «Hipertrofia · 1:30 · podías unas 9 reps», «… + 30 s por llegar al fallo». */
export function restLabel(reps, { rir = null, tipo = 'trabajo' } = {}) {
  if (isWarmup(tipo)) return warmupZone(reps).label;
  const possible = possibleReps(reps, rir);
  let label = restZone(possible).label;
  if (possible !== reps) label += ` · podías ${rir >= RIR_FLOOR ? `${possible} o más` : `unas ${possible}`} reps`;
  const bonus = effortBonus(rir, tipo);
  if (bonus) label += ` + ${bonus} s ${RIR_REASON[rir]}`;
  return label;
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
