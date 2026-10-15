/* El reloj nativo del teléfono no hereda la paleta. El campo real sigue en el formulario. */
import { icons } from './icons.js';

let sheet;
let faceEl;
let periodEl;
let openInput;
let triggerEl;
let hour = 0;
let minute = 0;

function hour12() {
  const cycle = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hourCycle;
  return cycle === 'h12' || cycle === 'h11';
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function parseHM(value) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value || ''));
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return [h, min];
}

function round5(h, min) {
  let total = h * 60 + Math.round(min / 5) * 5;
  total = ((total % 1440) + 1440) % 1440;
  return [Math.floor(total / 60), total % 60];
}

function nowRounded() {
  const d = new Date();
  return round5(d.getHours(), d.getMinutes());
}

function formatFace(h, min) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(2000, 0, 1, h, min));
}

function parts12(h) {
  const period = h >= 12 ? 'pm' : 'am';
  const hr = h % 12 || 12;
  return { hr, period };
}

function from12(hr, period) {
  if (period === 'am') return hr === 12 ? 0 : hr;
  return hr === 12 ? 12 : hr + 12;
}

function ensureSheet() {
  if (sheet) return;
  sheet = document.createElement('div');
  sheet.className = 'picker-sheet';
  sheet.hidden = true;
  sheet.innerHTML = `
    <button type="button" class="picker-backdrop" aria-label="Cerrar"></button>
    <div class="picker-panel" role="dialog" aria-modal="true" aria-labelledby="time-title">
      <div class="picker-head">
        <p class="picker-title" id="time-title">Hora</p>
        <button type="button" class="picker-close" aria-label="Cerrar">${icons.x({ size: 18 })}</button>
      </div>
      <p class="time-face" aria-live="polite"></p>
      <div class="time-steps">
        <div class="time-step">
          <button type="button" data-step="hour" data-dir="-1" aria-label="Hora anterior">−</button>
          <span>Hora</span>
          <button type="button" data-step="hour" data-dir="1" aria-label="Hora siguiente">+</button>
        </div>
        <div class="time-step">
          <button type="button" data-step="minute" data-dir="-1" aria-label="Cinco minutos menos">−</button>
          <span>Min</span>
          <button type="button" data-step="minute" data-dir="1" aria-label="Cinco minutos más">+</button>
        </div>
      </div>
      <div class="time-period" hidden>
        <button type="button" data-period="am" aria-pressed="false">a. m.</button>
        <button type="button" data-period="pm" aria-pressed="false">p. m.</button>
      </div>
      <div class="time-actions">
        <button type="button" class="btn" data-action="now">Ahora</button>
        <button type="button" class="btn btn-primary" data-action="done">Listo</button>
      </div>
    </div>
  `;
  document.body.append(sheet);
  faceEl = sheet.querySelector('.time-face');
  periodEl = sheet.querySelector('.time-period');
  sheet.querySelector('.picker-backdrop').addEventListener('click', () => closeTime());
  sheet.querySelector('.picker-close').addEventListener('click', () => closeTime());
  sheet.querySelector('[data-action="now"]').addEventListener('click', () => {
    [hour, minute] = nowRounded();
    paint();
  });
  sheet.querySelector('[data-action="done"]').addEventListener('click', commit);
  sheet.querySelectorAll('[data-step]').forEach((btn) => {
    btn.addEventListener('click', () => step(btn.dataset.step, Number(btn.dataset.dir)));
  });
  sheet.querySelectorAll('[data-period]').forEach((btn) => {
    btn.addEventListener('click', () => setPeriod(btn.dataset.period));
  });
  sheet.addEventListener('keydown', onKey);
}

function onKey(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    closeTime();
  }
}

function step(kind, dir) {
  if (kind === 'hour') {
    hour = (hour + dir + 24) % 24;
  } else {
    let total = hour * 60 + minute + dir * 5;
    total = ((total % 1440) + 1440) % 1440;
    hour = Math.floor(total / 60);
    minute = total % 60;
  }
  paint();
}

function setPeriod(period) {
  const { hr } = parts12(hour);
  hour = from12(hr, period);
  paint();
}

function paint() {
  faceEl.textContent = formatFace(hour, minute);
  const show12 = hour12();
  periodEl.hidden = !show12;
  if (!show12) return;
  const { period } = parts12(hour);
  periodEl.querySelectorAll('[data-period]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.period === period));
  });
}

function commit() {
  const input = openInput;
  if (!input) return;
  input.value = `${pad(hour)}:${pad(minute)}`;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  closeTime();
}

function closeTime({ immediate = false } = {}) {
  if (!sheet || sheet.hidden) return;
  const trigger = triggerEl;
  openInput = null;
  triggerEl = null;
  sheet.classList.remove('open');
  document.body.classList.remove('picker-open');
  const hide = () => { sheet.hidden = true; };
  if (immediate || matchMedia('(prefers-reduced-motion: reduce)').matches) hide();
  else {
    sheet.querySelector('.picker-panel').addEventListener('transitionend', hide, { once: true });
    setTimeout(hide, 280);
  }
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
  if (trigger?.isConnected) trigger.focus();
}

function labelOf(input) {
  const span = input.closest('.field')?.querySelector(':scope > span');
  return span?.textContent.trim() || 'Hora';
}

function openTime(input, trigger) {
  ensureSheet();
  openInput = input;
  triggerEl = trigger;
  const parsed = parseHM(input.value) || nowRounded();
  [hour, minute] = round5(parsed[0], parsed[1]);
  sheet.querySelector('#time-title').textContent = labelOf(input);
  paint();
  document.body.append(sheet);
  sheet.hidden = false;
  document.body.classList.add('picker-open');
  trigger.setAttribute('aria-expanded', 'true');
  requestAnimationFrame(() => sheet.classList.add('open'));
  sheet.querySelector('[data-action="done"]').focus();
}

function enhance(input) {
  if (input.dataset.timeSheet) return;
  input.dataset.timeSheet = '1';
  input.classList.add('picker-native');
  input.tabIndex = -1;
  input.setAttribute('aria-hidden', 'true');

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'picker-trigger';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false');
  const value = document.createElement('span');
  value.className = 'picker-value';
  const icon = document.createElement('span');
  icon.className = 'picker-chev';
  icon.innerHTML = icons.clock({ size: 18 });
  trigger.append(value, icon);
  input.after(trigger);

  const sync = () => {
    const parsed = parseHM(input.value);
    const text = parsed ? formatFace(parsed[0], parsed[1]) : 'Elegir hora';
    value.textContent = text;
    trigger.setAttribute('aria-label', `${labelOf(input)}: ${text}`);
  };
  sync();
  input.addEventListener('change', sync);
  input.addEventListener('focus', () => input.blur());
  trigger.addEventListener('click', () => openTime(input, trigger));

  const field = input.closest('label.field');
  field?.addEventListener('mousedown', (e) => {
    if (e.target.closest('button, a')) return;
    e.preventDefault();
  });
  field?.addEventListener('click', (e) => {
    if (e.target.closest('button, a')) return;
    e.preventDefault();
    trigger.click();
  });
}

export function mountTimes(root) {
  root.querySelectorAll('input[data-time]:not([data-time-sheet])').forEach(enhance);
}

export function watchTimes(root) {
  mountTimes(root);
  const obs = new MutationObserver(() => {
    mountTimes(root);
    if (openInput && !openInput.isConnected) closeTime({ immediate: true });
  });
  obs.observe(root, { childList: true, subtree: true });
  window.addEventListener('hashchange', () => closeTime());
}
