/* El calendario nativo del teléfono no hereda la paleta. El campo real sigue en el formulario. */
import { icons } from './icons.js';
import { formatDay, formatMonth, parseISO, todayISO, toISO } from './dates.js';

const WEEK = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

let sheet;
let titleEl;
let monthEl;
let grid;
let prevBtn;
let nextBtn;
let openInput;
let viewYear = 0;
let viewMonth = 0;

function ensureSheet() {
  if (sheet) return;
  sheet = document.createElement('div');
  sheet.className = 'picker-sheet';
  sheet.hidden = true;
  sheet.innerHTML = `
    <button type="button" class="picker-backdrop" aria-label="Cerrar"></button>
    <div class="picker-panel" role="dialog" aria-modal="true" aria-labelledby="cal-title">
      <div class="picker-head">
        <p class="picker-title" id="cal-title"></p>
        <button type="button" class="picker-close" aria-label="Cerrar">${icons.x({ size: 18 })}</button>
      </div>
      <div class="cal-nav">
        <button type="button" class="cal-step" data-dir="-1" aria-label="Mes anterior">${icons.chevronLeft({ size: 18 })}</button>
        <p class="cal-month"></p>
        <button type="button" class="cal-step" data-dir="1" aria-label="Mes siguiente">${icons.chevronRight({ size: 18 })}</button>
      </div>
      <div class="cal-grid"></div>
    </div>
  `;
  document.body.append(sheet);
  titleEl = sheet.querySelector('.picker-title');
  monthEl = sheet.querySelector('.cal-month');
  grid = sheet.querySelector('.cal-grid');
  prevBtn = sheet.querySelector('[data-dir="-1"]');
  nextBtn = sheet.querySelector('[data-dir="1"]');
  sheet.querySelector('.picker-backdrop').addEventListener('click', () => closeCal());
  sheet.querySelector('.picker-close').addEventListener('click', () => closeCal());
  prevBtn.addEventListener('click', () => shiftMonth(-1));
  nextBtn.addEventListener('click', () => shiftMonth(1));
  sheet.addEventListener('keydown', onKey);
}

function onKey(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    closeCal();
  }
}

function closeCal({ immediate = false } = {}) {
  if (!sheet || sheet.hidden) return;
  const input = openInput;
  openInput = null;
  sheet.classList.remove('open');
  document.body.classList.remove('picker-open');
  const hide = () => { sheet.hidden = true; };
  if (immediate || matchMedia('(prefers-reduced-motion: reduce)').matches) hide();
  else {
    sheet.querySelector('.picker-panel').addEventListener('transitionend', hide, { once: true });
    setTimeout(hide, 280);
  }
  const trigger = input?.parentElement?.querySelector('.cal-trigger');
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
  if (trigger?.isConnected) trigger.focus();
}

function bounds(input) {
  return { min: input.min || '', max: input.max || '' };
}

function inRange(iso, min, max) {
  if (min && iso < min) return false;
  if (max && iso > max) return false;
  return true;
}

function paint() {
  const input = openInput;
  if (!input) return;
  const { min, max } = bounds(input);
  const selected = input.value;
  const today = todayISO();
  const label = formatMonth(viewYear, viewMonth);
  monthEl.textContent = label.charAt(0).toUpperCase() + label.slice(1);

  const first = new Date(viewYear, viewMonth, 1);
  const pad = (first.getDay() + 6) % 7;
  const count = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = WEEK.map((d) => `<span class="cal-dow">${d}</span>`);
  for (let i = 0; i < pad; i++) cells.push('<span></span>');
  for (let day = 1; day <= count; day++) {
    const iso = toISO(new Date(viewYear, viewMonth, day));
    const ok = inRange(iso, min, max);
    const selectedDay = iso === selected;
    const todayDay = iso === today;
    cells.push(
      `<button type="button" class="cal-day${todayDay ? ' is-today' : ''}" data-iso="${iso}"
        ${ok ? '' : 'disabled'} ${selectedDay ? 'aria-selected="true"' : ''}
        aria-label="${formatDay(iso)}">${day}</button>`
    );
  }
  grid.innerHTML = cells.join('');
  grid.querySelectorAll('.cal-day:not(:disabled)').forEach((btn) => {
    btn.addEventListener('click', () => choose(input, btn.dataset.iso));
  });

  const prevMonthEnd = toISO(new Date(viewYear, viewMonth, 0));
  const nextMonthStart = toISO(new Date(viewYear, viewMonth + 1, 1));
  prevBtn.disabled = Boolean(min && prevMonthEnd < min);
  nextBtn.disabled = Boolean(max && nextMonthStart > max);
}

function shiftMonth(dir) {
  const d = new Date(viewYear, viewMonth + dir, 1);
  viewYear = d.getFullYear();
  viewMonth = d.getMonth();
  paint();
}

function choose(input, iso) {
  closeCal({ immediate: true });
  if (!input.isConnected || input.value === iso) return;
  input.value = iso;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function openCal(input, label, trigger) {
  ensureSheet();
  openInput = input;
  titleEl.textContent = label;
  const base = parseISO(input.value || todayISO());
  viewYear = base.getFullYear();
  viewMonth = base.getMonth();
  paint();
  sheet.hidden = false;
  document.body.classList.add('picker-open');
  requestAnimationFrame(() => sheet.classList.add('open'));
  (grid.querySelector('[aria-selected="true"]') || grid.querySelector('.cal-day:not(:disabled)'))?.focus();
  trigger?.setAttribute('aria-expanded', 'true');
}

function labelOf(input) {
  const span = input.closest('.field')?.querySelector(':scope > span');
  return span?.textContent.trim() || 'Día';
}

function enhance(input) {
  if (input.dataset.calendar) return;
  input.dataset.calendar = '1';
  input.classList.add('picker-native');
  input.tabIndex = -1;
  input.setAttribute('aria-hidden', 'true');

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'picker-trigger cal-trigger';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false');
  const value = document.createElement('span');
  value.className = 'picker-value';
  const icon = document.createElement('span');
  icon.className = 'picker-chev';
  icon.innerHTML = icons.calendar({ size: 18 });
  trigger.append(value, icon);
  input.after(trigger);

  const sync = () => {
    const text = input.value ? formatDay(input.value) : 'Elegir día';
    value.textContent = text;
    trigger.setAttribute('aria-label', `${labelOf(input)}: ${text}`);
  };
  sync();
  input.addEventListener('change', sync);
  input.addEventListener('focus', () => input.blur());
  trigger.addEventListener('click', () => openCal(input, labelOf(input), trigger));

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

export function mountCalendars(root) {
  root.querySelectorAll('input[type="date"]:not([data-calendar])').forEach(enhance);
}

export function watchCalendars(root) {
  mountCalendars(root);
  const obs = new MutationObserver(() => {
    mountCalendars(root);
    if (openInput && !openInput.isConnected) closeCal({ immediate: true });
  });
  obs.observe(root, { childList: true, subtree: true });
  window.addEventListener('hashchange', () => closeCal());
}
