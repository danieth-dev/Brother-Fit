/* Pregunta de confirmación con la hoja de la app. No usa el aviso del teléfono. */
import { icons } from './icons.js';

let sheet;
let titleEl;
let bodyEl;
let cancelBtn;
let confirmBtn;
let settle;

function otherPickerOpen() {
  return !!document.querySelector('.picker-sheet.open:not(.confirm-sheet)');
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
  if (!sheet || sheet.hidden) return;
  const done = settle;
  settle = null;
  sheet.classList.remove('open');
  const hide = () => {
    sheet.hidden = true;
    if (!otherPickerOpen()) document.body.classList.remove('picker-open');
  };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) hide();
  else {
    sheet.querySelector('.picker-panel').addEventListener('transitionend', hide, { once: true });
    setTimeout(hide, 280);
  }
  done?.(!!ok);
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
  if (settle) close(false);
  titleEl.textContent = title || '¿Seguro?';
  bodyEl.textContent = body;
  bodyEl.hidden = !body;
  cancelBtn.textContent = cancelLabel;
  confirmBtn.textContent = confirmLabel;
  confirmBtn.className = danger ? 'btn btn-danger btn-confirm' : 'btn btn-primary btn-confirm';
  document.body.append(sheet);
  sheet.hidden = false;
  document.body.classList.add('picker-open');
  requestAnimationFrame(() => sheet.classList.add('open'));
  confirmBtn.focus();
  return new Promise((resolve) => { settle = resolve; });
}
