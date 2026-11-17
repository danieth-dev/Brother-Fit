/* Cápsula del descanso: flota sobre la isla, encima de Entreno, en todas las pantallas.
 * Muestra la cuenta atrás. En Entreno, si la rutina repetida tiene
 * algo que ofrecer («Siguiente», «Terminar sesión»), lo añade al lado y tocar el reloj abre
 * la hoja del descanso; fuera de Entreno, tocarla vuelve a Entreno.
 * Solo dibuja: cuándo acaba el descanso y qué pasa entonces lo decide Entreno. */
import { loadActiveRest } from '../services/workouts.js';
import { on, EVENTS } from './events.js';
import { now } from './clock.js';
import { formatCountdown } from './dates.js';
import { icons } from './icons.js';
import { esc } from './dom.js';
import { openRestSheet, refreshRestSheet } from './rest-sheet.js';

const TICK_MS = 1000;
const WORKOUT_HASH = '#/workout';

let pill;
let timeBtn;
let numEl;
let actionBtn;
let rest = { restEnd: 0, start: 0 };
let controls = null;
let tickId = null;
let actionHtml = '';

const secondsLeft = () => Math.max(0, (rest.restEnd - now()) / 1000);
const onWorkout = () => location.hash === WORKOUT_HASH || location.hash.startsWith(`${WORKOUT_HASH}/`);

/** Lo que el descanso ofrece ahora, para la hoja. */
export function restState() {
  const total = Math.max(1, (rest.restEnd - (rest.start || rest.restEnd)) / 1000);
  return { left: secondsLeft(), total, zone: controls?.zone || '', action: controls?.action || null };
}

/**
 * Entreno dice qué ofrecer mientras está abierto:
 * { zone, action: { kind: 'next'|'finish', label } | null, onAction(), onSkip() }, o null.
 */
export function setRestControls(next) {
  controls = next;
  paint();
}

export async function initRestPill() {
  mount();
  on(EVENTS.REST_CHANGED, (d) => setRest(d));
  window.addEventListener('hashchange', paint);
  const saved = await loadActiveRest();
  if (saved) setRest(saved);
}

function mount() {
  const tabbar = document.querySelector('.tabbar');
  if (!tabbar || pill) return;
  pill = document.createElement('div');
  pill.className = 'rest-pill';
  pill.hidden = true;
  pill.innerHTML = `
    <button type="button" class="rest-pill-time">
      ${icons.clock({ size: 18 })}<span class="rest-pill-num"></span>
    </button>
    <button type="button" class="rest-pill-action" hidden></button>`;
  tabbar.prepend(pill);
  timeBtn = pill.querySelector('.rest-pill-time');
  numEl = pill.querySelector('.rest-pill-num');
  actionBtn = pill.querySelector('.rest-pill-action');
  timeBtn.addEventListener('click', onTimeTap);
  actionBtn.addEventListener('click', () => controls?.onAction?.());
}

function setRest({ restEnd = 0, start = 0 } = {}) {
  rest = { restEnd, start: start || now() };
  paint();
}

function onTimeTap() {
  if (!onWorkout() || !controls) {
    location.hash = WORKOUT_HASH;
    return;
  }
  openRestSheet({
    getState: restState,
    onSkip: () => controls?.onSkip?.(),
    onAction: () => controls?.onAction?.(),
  });
}

function paint() {
  if (!pill) return;
  const left = secondsLeft();
  const active = left > 0;
  pill.hidden = !active;
  document.body.classList.toggle('has-rest-pill', active);
  if (!active) {
    stopTick();
    refreshRestSheet();
    return;
  }
  const label = formatCountdown(left);
  numEl.textContent = label;
  timeBtn.setAttribute('aria-label', `Descanso, quedan ${label}. ${onWorkout() ? 'Opciones' : 'Volver a Entreno'}`);
  paintAction();
  refreshRestSheet();
  startTick();
}

function paintAction() {
  const action = onWorkout() ? controls?.action : null;
  pill.classList.toggle('rest-pill--action', Boolean(action));
  actionBtn.hidden = !action;
  if (!action) return;
  const html = action.kind === 'finish'
    ? `${icons.check({ size: 16 })}<span class="rest-pill-action-label">${esc(action.label)}</span>`
    : `<span class="rest-pill-action-hint">Siguiente</span><span class="rest-pill-action-label">${esc(action.label)}</span>${icons.chevronRight({ size: 16 })}`;
  if (html === actionHtml) return;
  actionHtml = html;
  actionBtn.innerHTML = html;
}

function startTick() {
  if (tickId) return;
  tickId = setInterval(paint, TICK_MS);
}

function stopTick() {
  clearInterval(tickId);
  tickId = null;
}
