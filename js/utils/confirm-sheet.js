/* Pregunta de confirmación con la hoja de la app. No usa el aviso del teléfono. */
import { icons } from './icons.js';
import { esc } from './dom.js';
import { bindSheetDrag } from './sheet-drag.js';

let sheet;
let panelEl;
let iconEl;
let titleEl;
let bodyEl;
let statsEl;
let actionsEl;
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
      <div class="confirm-grabber" aria-hidden="true"><span></span></div>
      <span class="confirm-icon" aria-hidden="true"></span>
      <div class="picker-head">
        <p class="picker-title" id="confirm-title"></p>
        <button type="button" class="picker-close" aria-label="Cerrar">${icons.x({ size: 18 })}</button>
      </div>
      <p class="confirm-body" id="confirm-body"></p>
      <div class="confirm-stats"></div>
      <div class="confirm-actions">
        <button type="button" class="btn" data-action="cancel">Cancelar</button>
        <button type="button" class="btn btn-danger btn-confirm" data-action="confirm">Eliminar</button>
      </div>
    </div>
  `;
  document.body.append(sheet);
  panelEl = sheet.querySelector('.picker-panel');
  iconEl = sheet.querySelector('.confirm-icon');
  titleEl = sheet.querySelector('#confirm-title');
  bodyEl = sheet.querySelector('#confirm-body');
  statsEl = sheet.querySelector('.confirm-stats');
  actionsEl = sheet.querySelector('.confirm-actions');
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

  bindSheetDrag({
    sheet,
    panel: panelEl,
    backdrop: sheet.querySelector('.picker-backdrop'),
    zones: [
      sheet.querySelector('.confirm-grabber'),
      sheet.querySelector('.picker-head'),
    ],
    onClose: () => close(false, { immediate: true }),
  });
}

function close(ok, { immediate = false } = {}) {
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

  if (immediate || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    hide();
  } else {
    panelTransitionHandler = hide;
    sheet.querySelector('.picker-panel')?.addEventListener('transitionend', hide, { once: true });
    hideTimer = setTimeout(hide, 280);
  }
  done(!!ok);
}

/**
 * @param {{
 *   title: string,
 *   body?: string,
 *   bodyHtml?: string,
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 *   danger?: boolean,
 *   variant?: 'sheet' | 'alert',
 *   icon?: string,
 *   stats?: { value: string, label: string, mono?: boolean }[],
 *   stacked?: boolean,
 *   safeFirst?: boolean,
 * }} opts
 *  - variant 'alert': diálogo centrado (acciones destructivas).
 *  - stacked: botones a lo ancho, uno debajo del otro.
 *  - safeFirst: el botón seguro (cancelar) va arriba y en amarillo.
 * @returns {Promise<boolean>}
 */
export function askConfirm({
  title,
  body = '',
  bodyHtml = '',
  confirmLabel = 'Eliminar',
  cancelLabel = 'Cancelar',
  danger = true,
  variant = 'sheet',
  icon = '',
  stats = [],
  stacked = false,
  safeFirst = false,
} = {}) {
  ensureSheet();
  cleanupHide();
  if (settle) {
    const prev = settle;
    settle = null;
    prev(false);
  }

  const alert = variant === 'alert';
  sheet.classList.toggle('confirm-sheet--alert', alert);
  sheet.classList.toggle('confirm-sheet--rich', stacked || alert);
  panelEl.setAttribute('role', alert ? 'alertdialog' : 'dialog');

  iconEl.innerHTML = icon && icons[icon] ? icons[icon]({ size: 26 }) : '';
  iconEl.hidden = !iconEl.innerHTML;
  iconEl.classList.toggle('is-danger', danger);

  titleEl.textContent = title || '¿Seguro?';
  if (bodyHtml) bodyEl.innerHTML = bodyHtml;
  else bodyEl.textContent = body;
  bodyEl.hidden = !(bodyHtml || body);

  statsEl.innerHTML = stats.map((s) => `
    <div class="confirm-stat">
      <p class="confirm-stat-value${s.mono ? ' is-mono' : ''}">${esc(s.value)}</p>
      <p class="confirm-stat-label">${esc(s.label)}</p>
    </div>`).join('');
  statsEl.hidden = !stats.length;

  cancelBtn.textContent = cancelLabel;
  confirmBtn.textContent = confirmLabel;
  actionsEl.classList.toggle('is-stacked', stacked);
  if (stacked && safeFirst) {
    cancelBtn.className = 'btn btn-primary';
    confirmBtn.className = danger ? 'btn btn-danger btn-confirm-outline' : 'btn btn-outline';
    actionsEl.prepend(cancelBtn);
  } else if (stacked) {
    cancelBtn.className = 'btn btn-outline';
    confirmBtn.className = danger ? 'btn btn-danger btn-confirm' : 'btn btn-primary btn-confirm';
    actionsEl.prepend(confirmBtn);
  } else {
    cancelBtn.className = 'btn';
    confirmBtn.className = danger ? 'btn btn-danger btn-confirm' : 'btn btn-primary btn-confirm';
    actionsEl.prepend(cancelBtn);
  }

  sheet.hidden = false;
  document.body.classList.add('picker-open');
  sheet.classList.add('open');
  (safeFirst ? cancelBtn : confirmBtn).focus();
  return new Promise((resolve) => { settle = resolve; });
}
