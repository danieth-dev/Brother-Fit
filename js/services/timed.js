/* Ejercicios que se miden en tiempo (plancha, colgado en barra, L-sit). Reglas puras.
 *
 * Una serie por tiempo guarda `segundos` y `reps: 0`; el peso sigue siendo el peso añadido.
 * El esfuerzo usa la misma escala 0–4 que las repeticiones, leída en segundos: cada paso son
 * TIME_STEP_S más que podía aguantar. Así el descanso y los avisos funcionan igual. */
import { formatCountdown } from '../utils/dates.js';

/* Del catálogo, los que se miden en tiempo. Los del atleta lo marcan con `medida: 'tiempo'`. */
const CATALOG_TIMED = new Set(['Plancha']);

export const TIME_STEP_S = 5;
export const MAX_SEGUNDOS = 3600;

/* Lo que se ve en los botones de esfuerzo de una serie por tiempo (rir 0–4). */
export const HOLD_LABELS = ['0', '5 s', '10 s', '15 s', '20 s+'];
const HOLD_PHRASE = { 10: 'al límite', 9: 'sobraban 5 s', 8: 'sobraban 10 s', 7: 'sobraban 15 s', 6: '20 s o más' };

export function isTimed(ex) {
  return ex?.medida === 'tiempo' || CATALOG_TIMED.has(String(ex?.nombre || '').trim());
}

export const isTimedSet = (s) => s?.segundos != null;

/** «0:45», «1:30». */
export const formatTime = (secs) => formatCountdown(secs);

/** Lee lo que escribe el atleta: «45» son 45 s y «1:30» son 90 s. NaN si no se entiende. */
export function parseTime(text) {
  const t = String(text ?? '').trim();
  const mmss = t.match(/^(\d{1,2}):(\d{1,2})$/);
  if (mmss) {
    const s = Number(mmss[2]);
    return s < 60 ? Number(mmss[1]) * 60 + s : NaN;
  }
  return /^\d+$/.test(t) ? Number(t) : NaN;
}

/** El esfuerzo guardado (RPE) en palabras de tiempo: «sobraban 10 s». */
export function holdPhrase(rpe) {
  return HOLD_PHRASE[Number(rpe)] || `RPE ${rpe}`;
}

/** La serie con su medida en `reps`, para las reglas que comparan repeticiones (lo habitual, sesiones). */
export const asMeasured = (s) => (isTimedSet(s) ? { ...s, reps: s.segundos } : s);

/** Cantidad de una serie en palabras para Bía y los resúmenes: «45 s» o «10». */
export const amountWords = (s) => (isTimedSet(s) ? `${s.segundos} s` : `${s.reps}`);
