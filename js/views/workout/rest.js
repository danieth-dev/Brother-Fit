/* Reloj de la pantalla Entreno: tiempo de la sesión y fin del descanso.
 * La cuenta atrás se ve en la cápsula de la isla (utils/rest-pill.js); aquí se decide qué pasa
 * cuando acaba: se apaga el micrófono y, en una rutina, se pasa al siguiente ejercicio;
 * si no, Bía avisa que toca la siguiente serie. */
import { clearActiveRest } from '../../services/workouts.js';
import { ROUTINE_DONE } from '../../services/session-plan.js';
import { getActiveAgent } from '../../voice/fit-agent.js';
import { state } from '../../store.js';
import { formatDuration } from '../../utils/dates.js';
import { now } from '../../utils/clock.js';
import { session } from './session.js';

const TICK_MS = 1000;

/** Corta el descanso ya (Saltar, Pasar a…). */
export function stopRest() {
  session.restEnd = 0;
  getActiveAgent()?.cancelPendingCheckIn();
  getActiveAgent()?.muteMic();
}

function onRestOver(el, onAdvance) {
  session.restEnd = 0;
  clearActiveRest();
  getActiveAgent()?.muteMic();
  const next = session.pendingNextEx;
  session.pendingNextEx = null;
  if (next && next !== ROUTINE_DONE) {
    onAdvance(next);
    return;
  }
  const exName = state.activeExercise?.nombre || 'el ejercicio';
  const doneSets = el.querySelectorAll('.group .sets li').length;
  getActiveAgent()?.triggerCheckIn(
    `El descanso terminó. Una frase: sigue ${exName}, serie ${doneSets + 1}. Después escuchá.`
  );
}

/** onAdvance(id): pasar al siguiente ejercicio de la rutina al acabar el descanso. */
export function startTicker(el, w, onAdvance) {
  if (el._tickerId) clearInterval(el._tickerId);
  const tick = () => {
    const elapsed = el.querySelector('#elapsed');
    if (!elapsed) {
      clearInterval(el._tickerId);
      el._tickerId = null;
      return;
    }
    elapsed.textContent = formatDuration(now() - w.startedAt);
    if (session.restEnd > 0 && session.restEnd <= now()) onRestOver(el, onAdvance);
  };
  tick();
  el._tickerId = setInterval(tick, TICK_MS);
}
