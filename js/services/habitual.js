/* «Lo habitual» de un ejercicio: lo que el atleta levanta normalmente, para que un día flojo
 * no se lea como un retroceso. Reglas puras, sin base de datos.
 *
 * De cada sesión cuenta su mejor serie de trabajo (más peso; a igual peso, más reps); los
 * calentamientos no cuentan. Lo habitual es la mediana de las últimas HABITUAL_SESSIONS: un solo
 * día raro, malo o muy bueno, no la mueve. En ejercicios sin peso (dominadas, flexiones) se
 * comparan las repeticiones. */

export const HABITUAL_SESSIONS = 4;
/* Solo se avisa de una bajada mayor que esta: una placa menos es variación normal. */
export const DROP_THRESHOLD = 0.1;

const isWarmup = (s) => s.tipo === 'calentamiento';

/** Mejor serie de trabajo de una lista de series, o null si no hay ninguna. */
export function bestWorkingSet(sets) {
  let best = null;
  for (const s of sets) {
    if (isWarmup(s) || !(s.reps > 0)) continue;
    if (!best || s.peso > best.peso || (s.peso === best.peso && s.reps > best.reps)) best = s;
  }
  return best ? { peso: best.peso, reps: best.reps } : null;
}

function median(values) {
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/**
 * tops: la mejor serie de cada sesión anterior, de la más vieja a la más nueva.
 * Devuelve { peso, reps, sesiones } o null si no hay sesiones.
 */
export function habitualFrom(tops) {
  const last = tops.filter(Boolean).slice(-HABITUAL_SESSIONS);
  if (!last.length) return null;
  return {
    peso: median(last.map((t) => t.peso)),
    reps: Math.round(median(last.map((t) => t.reps))),
    sesiones: last.length,
  };
}

/** ¿Hoy está más de un DROP_THRESHOLD por debajo de lo habitual? Sin peso, compara reps. */
export function isBelowHabitual(today, habitual) {
  if (!today || !habitual) return false;
  const byWeight = habitual.peso > 0;
  const ref = byWeight ? habitual.peso : habitual.reps;
  const now = byWeight ? today.peso : today.reps;
  return ref > 0 && now < ref * (1 - DROP_THRESHOLD);
}
