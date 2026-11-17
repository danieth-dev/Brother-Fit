/* Reloj de la pantalla Entreno: tiempo de la sesión y cuenta atrás del descanso.
 * Al acabar el descanso apaga el micrófono y, en una rutina, pasa al siguiente ejercicio;
 * si no, Bía avisa que toca la siguiente serie. */
import { clearActiveRest } from '../../services/workouts.js';
import { ROUTINE_DONE } from '../../services/session-plan.js';
import { getActiveAgent } from '../../voice/fit-agent.js';
import { state } from '../../store.js';
import { formatDuration } from '../../utils/dates.js';
import { now } from '../../utils/clock.js';
import { session } from './session.js';
import { restMarkup, mmss } from './markup.js';

const TICK_MS = 1000;

const secondsLeft = () => (session.restEnd > now() ? Math.ceil((session.restEnd - now()) / 1000) : 0);

export function currentRestHtml() {
  return restMarkup({
    left: secondsLeft(),
    nextExObj: session.nextExObj,
    isExCompleted: session.isExCompleted,
    routineDone: session.routineDone,
    curExName: session.curExName,
    lastReps: session.lastReps,
    autoRest: state.settings.descansoMode === 'auto',
  });
}

/** Corta el descanso ya (Saltar, Pasar a…). */
export function stopRest(el) {
  session.restEnd = 0;
  const rest = el.querySelector('#rest');
  if (rest) rest.innerHTML = '';
  getActiveAgent()?.cancelPendingCheckIn();
  getActiveAgent()?.muteMic();
}

function paintRest(el, left) {
  const rest = el.querySelector('#rest');
  if (!rest) return;
  if (left > 0) {
    const numEl = rest.querySelector('.num');
    if (numEl) numEl.textContent = mmss(left);
    else rest.innerHTML = currentRestHtml();
  } else if (rest.innerHTML) {
    rest.innerHTML = '';
  }
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
    const left = secondsLeft();
    paintRest(el, left);
    if (session.restEnd > 0 && left <= 0) onRestOver(el, onAdvance);
  };
  tick();
  el._tickerId = setInterval(tick, TICK_MS);
}
