/* Pregunta de confirmación con la hoja de la app. No usa el aviso del teléfono. */
import { icons } from './icons.js';

let sheet;
let titleEl;
let bodyEl;
let cancelBtn;
let confirmBtn;
let settle;
let hideTimer = null;
let panelTransitionHandler = null;

function otherPickerOpen() {
  return !!document.querySelector('.picker-sheet.open:not(.confirm-sheet)');
}

function cleanupHide() {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  if (panelTransitionHandler && sheet) {
    sheet.querySelector('.picker-panel')?.removeEventListener('transitionend', panelTransitionHandler);
    panelTransitionHandler = null;
  }
}

function ensureSheet() {
  if (sheet) return;
  sheet = document.createElement('div');
  sheet.className = 'picker-sheet confirm-sheet';
  sheet.hidden = true;
  sheet.innerHTML = `
    <button type="button" class="picker-backdrop" aria-label="Cerrar"></button>
    <div class="picker-panel" role="dialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-body">
      <div class="picker-head">
        <p class="picker-title" id="confirm-title"></p>
        <button type="button" class="picker-close" aria-label="Cerrar">${icons.x({ size: 18 })}</button>
      </div>
      <p class="confirm-body" id="confirm-body"></p>
      <div class="confirm-actions">
        <button type="button" class="btn" data-action="cancel">Cancelar</button>
        <button type="button" class="btn btn-danger btn-confirm" data-action="confirm">Eliminar</button>
      </div>
    </div>
  `;
  document.body.append(sheet);
  titleEl = sheet.querySelector('#confirm-title');
  bodyEl = sheet.querySelector('#confirm-body');
  cancelBtn = sheet.querySelector('[data-action="cancel"]');
  confirmBtn = sheet.querySelector('[data-action="confirm"]');
  sheet.querySelector('.picker-backdrop').addEventListener('click', () => close(false));
  sheet.querySelector('.picker-close').addEventListener('click', () => close(false));
  cancelBtn.addEventListener('click', () => close(false));
  confirmBtn.addEventListener('click', () => close(true));
  sheet.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close(false);
    }
  });
  window.addEventListener('hashchange', () => {
    if (sheet && !sheet.hidden) close(false);
  });
}

function close(ok) {
  if (!settle) return;
  const done = settle;
  settle = null;
  cleanupHide();

  sheet.classList.remove('open');
  const hide = () => {
    cleanupHide();
    if (!sheet) return;
    sheet.hidden = true;
    if (!otherPickerOpen()) document.body.classList.remove('picker-open');
  };

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    hide();
  } else {
    panelTransitionHandler = hide;
    sheet.querySelector('.picker-panel')?.addEventListener('transitionend', hide, { once: true });
    hideTimer = setTimeout(hide, 280);
  }
  done(!!ok);
}

/**
 * @param {{ title: string, body?: string, confirmLabel?: string, cancelLabel?: string, danger?: boolean }} opts
 * @returns {Promise<boolean>}
 */
export function askConfirm({
  title,
  body = '',
  confirmLabel = 'Eliminar',
  cancelLabel = 'Cancelar',
  danger = true,
} = {}) {
  ensureSheet();
  cleanupHide();
  if (settle) {
    const prev = settle;
    settle = null;
    prev(false);
  }

  titleEl.textContent = title || '¿Seguro?';
  bodyEl.textContent = body;
  bodyEl.hidden = !body;
  cancelBtn.textContent = cancelLabel;
  confirmBtn.textContent = confirmLabel;
  confirmBtn.className = danger ? 'btn btn-danger btn-confirm' : 'btn btn-primary btn-confirm';

  sheet.hidden = false;
  document.body.classList.add('picker-open');
  sheet.classList.add('open');
  confirmBtn.focus();
  return new Promise((resolve) => { settle = resolve; });
}
