/* Lista propia para los <select>. En el teléfono el menú nativo no hereda la paleta.
 * Esta pieza arma la hoja, la abre y la cierra. El buscador vive en picker-find.js y el alta
 * de ejercicio en picker-creator.js; las tres comparten el estado `ui`. */
import { icons } from './icons.js';
import { fold } from './text-match.js';
import { bindSheetDrag } from './sheet-drag.js';
import { normalizeGrupo } from '../services/workouts.js';
import { applyFind, paintGroups, syncSearching, visibleOptions } from './picker-find.js';
import { bindCreator, openCreator } from './picker-creator.js';

/* Margen para que la animación de salida termine antes de ocultar la hoja. */
const CLOSE_FALLBACK_MS = 280;

const ui = {
  sheet: null,
  openSelect: null,
  lastTrigger: null,
  isCatalog: false,
  findQuery: '',
  findGrupo: '',
  emptyEl: null,
  createEl: null,
  close: (opts) => closePicker(opts),
  restoreTitle: () => {
    ui.titleEl.textContent = ui.openSelect ? labelOf(ui.openSelect) : 'Elegir ejercicio';
  },
};

const SHEET_HTML = `
  <button type="button" class="picker-backdrop" aria-label="Cerrar"></button>
  <div class="picker-panel" role="dialog" aria-modal="true" aria-labelledby="picker-title">
    <div class="picker-grabber" aria-hidden="true"><span></span></div>
    <div class="picker-head">
      <p class="picker-title" id="picker-title"></p>
      <button type="button" class="picker-close" aria-label="Cerrar">${icons.x({ size: 18 })}</button>
    </div>
    <div class="picker-find" hidden>
      <div class="picker-search-box">
        <span class="picker-search-icon" aria-hidden="true">${icons.search({ size: 18 })}</span>
        <input class="picker-search" type="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" aria-label="Buscar ejercicio" placeholder="Buscar ejercicio">
        <button type="button" class="picker-search-clear" aria-label="Borrar búsqueda" hidden>${icons.x({ size: 16 })}</button>
      </div>
      <div class="picker-groups-wrap">
        <div class="picker-groups" role="group" aria-label="Grupo muscular"></div>
        <div class="picker-groups-fade" aria-hidden="true"></div>
      </div>
    </div>
    <div class="picker-list" role="listbox"></div>
    <div class="picker-creator-view" hidden>
      <div class="picker-create-card">
        <div class="picker-create-top">
          <span class="picker-create-avatar" aria-hidden="true">${icons.plus({ size: 20 })}</span>
          <div class="picker-create-info">
            <p class="picker-create-kicker">Nuevo ejercicio</p>
            <input class="picker-create-input" type="text" placeholder="Ej: Press francés" autocomplete="off" autocapitalize="sentences">
          </div>
        </div>
        <div>
          <p class="picker-create-muscle-title">¿Qué grupo muscular trabaja?</p>
          <div class="picker-create-pills" role="radiogroup"></div>
        </div>
      </div>
      <div class="picker-create-footer">
        <p class="picker-create-hint">Elige un grupo muscular para continuar</p>
        <div class="picker-create-actions">
          <button type="button" class="btn btn-ghost picker-create-cancel-btn">Cancelar</button>
          <button type="button" class="btn btn-primary picker-create-confirm-btn" disabled>Crear y usar</button>
        </div>
      </div>
    </div>
    <div class="picker-footer" hidden>
      <button type="button" class="picker-footer-create-btn">
        ${icons.plus({ size: 20 })} Crear ejercicio nuevo
      </button>
    </div>
  </div>
`;

const REFS = {
  list: '.picker-list',
  titleEl: '.picker-title',
  findEl: '.picker-find',
  searchEl: '.picker-search',
  searchClearBtn: '.picker-search-clear',
  groupsEl: '.picker-groups',
  footerEl: '.picker-footer',
  footerCreateBtn: '.picker-footer-create-btn',
  creatorViewEl: '.picker-creator-view',
  creatorInput: '.picker-create-input',
  creatorPillsEl: '.picker-create-pills',
  creatorHintEl: '.picker-create-hint',
  creatorConfirmBtn: '.picker-create-confirm-btn',
  creatorCancelBtn: '.picker-create-cancel-btn',
};

function ensureSheet() {
  if (ui.sheet) return;
  const sheet = document.createElement('div');
  sheet.className = 'picker-sheet';
  sheet.hidden = true;
  sheet.innerHTML = SHEET_HTML;
  document.body.append(sheet);
  ui.sheet = sheet;
  for (const [key, selector] of Object.entries(REFS)) ui[key] = sheet.querySelector(selector);

  bindSearch();
  bindCreator(ui);
  ui.footerCreateBtn.addEventListener('click', () => openCreator(ui, ui.searchEl.value.trim()));
  sheet.querySelector('.picker-backdrop').addEventListener('click', () => closePicker());
  sheet.querySelector('.picker-close').addEventListener('click', () => closePicker());
  sheet.addEventListener('keydown', onKey);
  bindSheetDrag({
    sheet,
    panel: sheet.querySelector('.picker-panel'),
    backdrop: sheet.querySelector('.picker-backdrop'),
    zones: [sheet.querySelector('.picker-grabber'), sheet.querySelector('.picker-head')],
    onClose: () => closePicker({ immediate: true }),
  });
}

function setQuery(value) {
  ui.findQuery = value;
  ui.searchClearBtn.hidden = !value;
  applyFind(ui);
  ui.list.scrollTop = 0;
  syncSearching(ui);
}

function bindSearch() {
  const { searchEl } = ui;
  searchEl.addEventListener('input', () => setQuery(searchEl.value));
  ui.searchClearBtn.addEventListener('click', () => {
    searchEl.value = '';
    setQuery('');
    searchEl.focus();
  });
  searchEl.addEventListener('focus', () => syncSearching(ui));
  searchEl.addEventListener('blur', () => setTimeout(() => syncSearching(ui), 0));
  /* Enter elige el primer resultado o, si no hay, abre el alta con lo escrito. */
  searchEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const first = visibleOptions(ui.list)[0];
    const typed = searchEl.value.trim();
    if (first) first.click();
    else if (ui.createEl && !ui.createEl.hidden) openCreator(ui, ui.createEl.dataset.name || typed);
    else if (typed) openCreator(ui, typed);
  });
}

/* ---------- Grupo muscular de cada opción ---------- */

function muscleOf(opt) {
  if (!opt?.dataset?.grupo) return '';
  const g = normalizeGrupo(opt.dataset.grupo);
  return g === 'Otro' ? '' : g;
}

function focusOf(opt) {
  return opt?.dataset?.foco?.trim() || '';
}

function muscleNode(grupo, foco) {
  const meta = document.createElement('span');
  meta.className = 'muscle';
  const dot = document.createElement('i');
  dot.className = 'muscle-dot';
  dot.dataset.g = grupo;
  dot.setAttribute('aria-hidden', 'true');
  const strong = document.createElement('strong');
  strong.textContent = grupo;
  meta.append(dot, strong);
  if (foco) {
    const spec = document.createElement('span');
    spec.className = 'muscle-focus';
    spec.textContent = foco;
    meta.append(spec);
  }
  return meta;
}

/* ---------- Alto visible real (el teclado en Android no achica la página) ---------- */

function syncViewport() {
  const vv = window.visualViewport;
  if (!vv || !ui.sheet) return;
  ui.sheet.style.setProperty('--vvh', `${vv.height}px`);
  ui.sheet.style.setProperty('--vvt', `${vv.offsetTop}px`);
}

function watchViewport(on) {
  const vv = window.visualViewport;
  if (!vv) return;
  const fn = on ? 'addEventListener' : 'removeEventListener';
  vv[fn]('resize', syncViewport);
  vv[fn]('scroll', syncViewport);
  if (on) syncViewport();
}

const KEY_MOVES = {
  ArrowDown: (i, n) => Math.min(i + 1, n - 1),
  ArrowUp: (i) => Math.max(i - 1, 0),
  Home: () => 0,
  End: (i, n) => n - 1,
};

function onKey(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    closePicker();
    return;
  }
  if (e.target.closest?.('.picker-search') || !KEY_MOVES[e.key]) return;
  e.preventDefault();
  const options = visibleOptions(ui.list);
  const next = KEY_MOVES[e.key](options.indexOf(document.activeElement), options.length);
  options[next]?.focus();
}

/* ---------- Abrir y cerrar ---------- */

function scrollStillLocked() {
  return !!document.querySelector('.editor-sheet.open, .picker-sheet.open');
}

function closePicker({ immediate = false } = {}) {
  const { sheet } = ui;
  if (!sheet || sheet.hidden) return;
  ui.openSelect = null;
  const trigger = ui.lastTrigger;
  sheet.classList.remove('open');
  watchViewport(false);
  if (document.activeElement === ui.searchEl) ui.searchEl.blur();
  if (document.activeElement === ui.creatorInput) ui.creatorInput.blur();
  ui.creatorViewEl.hidden = true;
  ui.findEl.hidden = false;
  ui.list.hidden = false;
  if (!scrollStillLocked()) document.body.classList.remove('picker-open');
  const hide = () => {
    sheet.hidden = true;
    if (!scrollStillLocked()) document.body.classList.remove('picker-open');
  };
  if (immediate || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    hide();
  } else {
    sheet.querySelector('.picker-panel').addEventListener('transitionend', hide, { once: true });
    setTimeout(hide, CLOSE_FALLBACK_MS);
  }
  if (trigger?.isConnected) trigger.focus();
}

function choose(select, value) {
  closePicker({ immediate: true });
  if (!select.isConnected || select.value === value) return;
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

function resetFind(catalog) {
  ui.findQuery = '';
  ui.findGrupo = '';
  ui.searchEl.value = '';
  ui.searchClearBtn.hidden = true;
  ui.findEl.hidden = !catalog;
  ui.footerEl.hidden = !catalog;
  ui.creatorViewEl.hidden = true;
  ui.list.hidden = false;
  ui.sheet.classList.toggle('picker-sheet--catalog', catalog);
  ui.sheet.classList.remove('is-searching');
}

/* En el catálogo, la lista empieza con el aviso de «nada coincide» y la fila «Crear …», ocultos. */
function catalogExtras() {
  const empty = document.createElement('p');
  empty.className = 'picker-empty';
  empty.hidden = true;
  empty.textContent = 'Nada que coincida';

  const create = document.createElement('div');
  create.className = 'picker-create-wrap';
  create.hidden = true;
  create.innerHTML = `
    <button type="button" class="picker-create-btn">
      <span class="picker-create-icon">${icons.plus({ size: 16 })}</span>
      <span class="picker-create-text">Crear «<strong class="picker-create-name"></strong>»</span>
      <span class="picker-create-badge"></span>
    </button>
  `;
  create.querySelector('.picker-create-btn').addEventListener('click', () => {
    openCreator(ui, create.dataset.name || ui.searchEl.value.trim());
  });
  return { empty, create };
}

function optionButton(select, opt) {
  const name = opt.textContent.trim();
  const grupo = muscleOf(opt);
  const foco = focusOf(opt);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'picker-option';
  btn.setAttribute('role', 'option');
  btn.setAttribute('aria-selected', String(opt.value === select.value));
  btn.dataset.find = fold(name);
  btn.dataset.name = name;
  btn.dataset.idx = String(opt.index);
  btn.dataset.grupo = opt.dataset.grupo || '';
  if (opt.dataset.hoy === '1') btn.dataset.hoy = '1';

  const copy = document.createElement('span');
  copy.className = 'picker-copy';
  const title = document.createElement('span');
  title.className = 'picker-name';
  title.textContent = name;
  copy.append(title);
  if (grupo) copy.append(muscleNode(grupo, foco));
  const mark = document.createElement('span');
  mark.className = 'picker-mark';
  mark.setAttribute('aria-hidden', 'true');
  mark.innerHTML = icons.check({ size: 14 });
  btn.append(copy, mark);
  if (grupo) btn.setAttribute('aria-label', `${name}, ${grupo}${foco ? `, ${foco}` : ''}`);
  btn.addEventListener('click', () => choose(select, opt.value));
  return btn;
}

/* Un ejercicio propio lleva al lado un lápiz para editarlo. */
function ownRow(select, opt, btn) {
  const row = document.createElement('div');
  row.className = 'picker-row';
  const edit = document.createElement('button');
  edit.type = 'button';
  edit.className = 'picker-edit';
  edit.setAttribute('aria-label', `Editar ${btn.dataset.name}`);
  edit.innerHTML = icons.pencil({ size: 18 });
  edit.addEventListener('click', () => {
    closePicker({ immediate: true });
    if (!select.isConnected) return;
    select.dispatchEvent(new CustomEvent('edit-exercise', { bubbles: true, detail: { id: Number(opt.value) } }));
  });
  row.append(btn, edit);
  return row;
}

function fillList(select, catalog) {
  ui.list.replaceChildren();
  ui.emptyEl = null;
  ui.createEl = null;
  if (catalog) {
    const { empty, create } = catalogExtras();
    ui.emptyEl = empty;
    ui.createEl = create;
    ui.list.append(empty, create);
  }
  for (const opt of select.options) {
    const btn = optionButton(select, opt);
    ui.list.append(opt.dataset.propio === '1' ? ownRow(select, opt, btn) : btn);
  }
}

export function openPicker(select, label, trigger) {
  ensureSheet();
  document.body.append(ui.sheet);
  ui.openSelect = select;
  ui.lastTrigger = trigger;
  ui.titleEl.textContent = label;
  const catalog = [...select.options].some((opt) => opt.dataset.grupo);
  ui.isCatalog = catalog;
  resetFind(catalog);
  watchViewport(true);
  if (catalog) paintGroups(ui, select);
  fillList(select, catalog);

  ui.sheet.hidden = false;
  document.body.classList.add('picker-open');
  requestAnimationFrame(() => ui.sheet.classList.add('open'));
  const current = ui.list.querySelector('[aria-selected="true"]') || ui.list.querySelector('.picker-option');
  if (catalog) {
    ui.list.scrollTop = 0;
    (ui.groupsEl.querySelector('button') || current)?.focus();
  } else {
    current?.focus();
    current?.scrollIntoView({ block: 'nearest' });
  }
}

/* ---------- El control en el formulario ---------- */

function labelOf(select) {
  const span = select.closest('.field')?.querySelector(':scope > span');
  return span?.textContent.trim() || 'Elegir';
}

/* Debajo del control, el grupo y el foco del ejercicio elegido. */
function syncMuscleHint(select, trigger, grupo, foco) {
  const field = select.closest('label.field');
  let hint = field?.querySelector(':scope > .muscle-hint');
  if (!grupo || !field) {
    hint?.remove();
    return;
  }
  if (!hint) {
    hint = document.createElement('p');
    hint.className = 'muscle-hint';
    hint.setAttribute('aria-hidden', 'true');
    trigger.after(hint);
  }
  hint.replaceChildren(muscleNode(grupo, foco));
}

function enhance(select) {
  if (select.dataset.picker) return;
  select.dataset.picker = '1';
  select.classList.add('picker-native');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'picker-trigger';
  trigger.setAttribute('aria-haspopup', 'dialog');
  const value = document.createElement('span');
  value.className = 'picker-value';
  const chev = document.createElement('span');
  chev.className = 'picker-chev';
  chev.innerHTML = icons.chevronDown({ size: 18 });
  trigger.append(value, chev);
  select.after(trigger);

  const sync = () => {
    const opt = select.selectedOptions[0];
    const text = opt?.textContent.trim() || 'Elegir';
    const grupo = muscleOf(opt);
    const foco = focusOf(opt);
    value.textContent = text;
    trigger.setAttribute('aria-label', `${labelOf(select)}: ${text}${grupo ? `, ${grupo}` : ''}${foco ? `, ${foco}` : ''}`);
    syncMuscleHint(select, trigger, grupo, foco);
  };
  sync();
  select.addEventListener('change', sync);
  trigger.addEventListener('click', () => openPicker(select, labelOf(select), trigger));

  /* Tocar en cualquier parte del campo abre la hoja, no el menú nativo. */
  const field = select.closest('label.field');
  field?.addEventListener('mousedown', (e) => {
    if (!e.target.closest('button, a, input')) e.preventDefault();
  });
  field?.addEventListener('click', (e) => {
    if (e.target.closest('button, a, input')) return;
    e.preventDefault();
    trigger.click();
  });
}

export function dismissPicker() {
  closePicker({ immediate: true });
}

export function mountPickers(root) {
  root.querySelectorAll('select:not([data-picker])').forEach(enhance);
}

export function watchPickers(root) {
  mountPickers(root);
  const obs = new MutationObserver(() => {
    mountPickers(root);
    if (ui.openSelect && !ui.openSelect.isConnected) closePicker();
  });
  obs.observe(root, { childList: true, subtree: true });
  window.addEventListener('hashchange', () => closePicker());
}
