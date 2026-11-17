/* Cronómetro de una serie por tiempo: cuenta hacia arriba y escribe el tiempo en la tarjeta
 * «Tiempo». Sigue contando si Entreno se repinta; se para al guardar o al cambiar de ejercicio. */
import { now } from '../../utils/clock.js';
import { icons } from '../../utils/icons.js';
import { formatTime } from '../../services/timed.js';
import { session } from './session.js';

const TICK_MS = 250;

export const stopwatchRunning = () => session.stopwatchStart > 0;

const elapsedSecs = () => Math.floor((now() - session.stopwatchStart) / 1000);

/** Lo que dice el botón: «Cronometrar» o «Detener · 0:32». */
export function stopwatchLabel() {
  return stopwatchRunning()
    ? `${icons.stop({ size: 20 })} Detener · ${formatTime(elapsedSecs())}`
    : `${icons.clock({ size: 20 })} Cronometrar`;
}

function paint(el) {
  const input = el.querySelector('input[name="segundos"]');
  const btn = el.querySelector('[data-action="stopwatch"]');
  if (!input || !btn) return false;
  if (stopwatchRunning()) input.value = formatTime(elapsedSecs());
  btn.innerHTML = stopwatchLabel();
  btn.setAttribute('aria-pressed', String(stopwatchRunning()));
  return true;
}

function startTicker(el) {
  clearInterval(el._stopwatchId);
  el._stopwatchId = setInterval(() => {
    if (!paint(el)) clearInterval(el._stopwatchId);
  }, TICK_MS);
}

/** Empieza o detiene. onChange: la pantalla revisa si ya se puede guardar. */
export function toggleStopwatch(el, onChange) {
  if (stopwatchRunning()) {
    const secs = elapsedSecs();
    session.stopwatchStart = 0;
    clearInterval(el._stopwatchId);
    const input = el.querySelector('input[name="segundos"]');
    if (input) input.value = formatTime(secs);
  } else {
    session.stopwatchStart = now();
    startTicker(el);
  }
  paint(el);
  onChange?.();
}

/** Tras repintar Entreno, el cronómetro que seguía en marcha vuelve a escribir en la tarjeta. */
export function resumeStopwatch(el) {
  if (stopwatchRunning() && paint(el)) startTicker(el);
}

export function resetStopwatch(el) {
  session.stopwatchStart = 0;
  if (el) clearInterval(el._stopwatchId);
}
