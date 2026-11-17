/* Hoja del descanso: se abre al tocar el reloj de la cápsula estando en Entreno.
 * Cuenta atrás grande, zona, −15 s / +30 s, la acción de la rutina y «Saltar descanso».
 * Se cierra sola cuando el descanso acaba. */
import { shiftActiveRest } from '../services/workouts.js';
import { formatCountdown } from './dates.js';
import { icons } from './icons.js';
import { esc } from './dom.js';
import { bindSheetDrag } from './sheet-drag.js';

const SHORTEN_S = 15;
const LENGTHEN_S = 30;
const CLOSE_MS = 280;

let sheet;
let panel;
let numEl;
let zoneEl;
let actionBtn;
let current = null;

function ensureSheet() {
  if (sheet) return;
  sheet = document.createElement('div');
  sheet.className = 'picker-sheet rest-sheet';
  sheet.hidden = true;
  sheet.innerHTML = `
    <button type="button" class="picker-backdrop" aria-label="Cerrar"></button>
    <div class="picker-panel" role="dialog" aria-modal="true" aria-labelledby="rest-sheet-title">
      <div class="rest-sheet-grabber" aria-hidden="true"><span></span></div>
      <div class="picker-head">
        <p class="picker-title" id="rest-sheet-title">Descanso</p>
        <button type="button" class="picker-close" aria-label="Cerrar">${icons.x({ size: 18 })}</button>
      </div>
      <p class="rest-sheet-num" aria-live="off"></p>
      <p class="rest-sheet-zone"></p>
      <div class="rest-sheet-bar" aria-hidden="true"><span></span></div>
      <div class="rest-sheet-shift">
        <button type="button" class="btn" data-shift="${-SHORTEN_S}">−${SHORTEN_S} s</button>
        <button type="button" class="btn" data-shift="${LENGTHEN_S}">+${LENGTHEN_S} s</button>
      </div>
      <button type="button" class="rest-sheet-action" hidden></button>
      <button type="button" class="btn btn-primary rest-sheet-skip">Saltar descanso</button>
    </div>`;
  document.body.append(sheet);
  panel = sheet.querySelector('.picker-panel');
  numEl = sheet.querySelector('.rest-sheet-num');
  zoneEl = sheet.querySelector('.rest-sheet-zone');
  actionBtn = sheet.querySelector('.rest-sheet-action');

  sheet.querySelector('.picker-backdrop').addEventListener('click', () => close());
  sheet.querySelector('.picker-close').addEventListener('click', () => close());
  sheet.querySelector('.rest-sheet-skip').addEventListener('click', () => run('onSkip'));
  actionBtn.addEventListener('click', () => run('onAction'));
  sheet.querySelectorAll('[data-shift]').forEach((b) => {
    b.addEventListener('click', () => shift(Number(b.dataset.shift)));
  });
  sheet.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  });
  window.addEventListener('hashchange', () => close({ immediate: true }));
  bindSheetDrag({
    sheet,
    panel,
    backdrop: sheet.querySelector('.picker-backdrop'),
    zones: [sheet.querySelector('.rest-sheet-grabber'), sheet.querySelector('.picker-head')],
    onClose: () => close({ immediate: true }),
  });
}

/** getState() → { left, total, zone, action }; onSkip y onAction son de Entreno. */
export function openRestSheet({ getState, onSkip, onAction }) {
  ensureSheet();
  current = { getState, onSkip, onAction };
  sheet.hidden = false;
  document.body.classList.add('picker-open');
  refreshRestSheet();
  requestAnimationFrame(() => sheet.classList.add('open'));
  sheet.querySelector('.rest-sheet-skip').focus();
}

/** La cápsula llama aquí en cada segundo; si la hoja está cerrada no hace nada. */
export function refreshRestSheet() {
  if (!current || !sheet || sheet.hidden) return;
  const { left, total, zone, action } = current.getState();
  if (left <= 0) {
    close();
    return;
  }
  numEl.textContent = formatCountdown(left);
  zoneEl.textContent = zone;
  zoneEl.hidden = !zone;
  panel.style.setProperty('--rest-left', `${Math.min(100, (left / total) * 100).toFixed(1)}%`);
  actionBtn.hidden = !action;
  if (action) {
    actionBtn.innerHTML = action.kind === 'finish'
      ? `${icons.check({ size: 18 })}<span>${esc(action.label)}</span>`
      : `<span class="rest-sheet-action-text"><span class="rest-sheet-action-hint">Siguiente en la rutina</span>${esc(action.label)}</span>${icons.chevronRight({ size: 18 })}`;
  }
}

async function shift(secs) {
  if (!current) return;
  const { left } = current.getState();
  // Acortar hasta cero es saltar: Entreno decide qué viene después.
  if (left + secs <= 0) {
    run('onSkip');
    return;
  }
  await shiftActiveRest(secs * 1000);
}

function run(name) {
  const fn = current?.[name];
  close({ immediate: true });
  fn?.();
}

function close({ immediate = false } = {}) {
  if (!sheet || sheet.hidden) return;
  current = null;
  sheet.classList.remove('open');
  const hide = () => {
    sheet.hidden = true;
    if (!document.querySelector('.picker-sheet.open')) document.body.classList.remove('picker-open');
  };
  if (immediate || matchMedia('(prefers-reduced-motion: reduce)').matches) hide();
  else setTimeout(hide, CLOSE_MS);
}
