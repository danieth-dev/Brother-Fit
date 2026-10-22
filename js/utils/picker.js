/* Lista propia para los <select>. En el teléfono el menú nativo no hereda la paleta. */
import { icons } from './icons.js';

let sheet;
let list;
let titleEl;
let lastTrigger;
let openSelect;
let findEl;
let searchEl;
let groupsEl;
let emptyEl;
let findQuery = '';
let findGrupo = '';

const GRUPO_ORDER = ['Pecho', 'Espalda', 'Piernas', 'Hombros', 'Bíceps', 'Tríceps', 'Core', 'Cardio', 'Otro'];

function fold(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function ensureSheet() {
  if (sheet) return;
  sheet = document.createElement('div');
  sheet.className = 'picker-sheet';
  sheet.hidden = true;
  sheet.innerHTML = `
    <button type="button" class="picker-backdrop" aria-label="Cerrar"></button>
    <div class="picker-panel" role="dialog" aria-modal="true" aria-labelledby="picker-title">
      <div class="picker-head">
        <p class="picker-title" id="picker-title"></p>
        <button type="button" class="picker-close" aria-label="Cerrar">${icons.x({ size: 18 })}</button>
      </div>
      <div class="picker-find" hidden>
        <input class="picker-search" type="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" aria-label="Buscar ejercicio" placeholder="Buscar">
        <div class="picker-groups" role="group" aria-label="Grupo muscular"></div>
      </div>
      <div class="picker-list" role="listbox"></div>
    </div>
  `;
  document.body.append(sheet);
  list = sheet.querySelector('.picker-list');
  titleEl = sheet.querySelector('.picker-title');
  findEl = sheet.querySelector('.picker-find');
  searchEl = sheet.querySelector('.picker-search');
  groupsEl = sheet.querySelector('.picker-groups');
  searchEl.addEventListener('input', () => {
    findQuery = searchEl.value;
    applyFind();
  });
  sheet.querySelector('.picker-backdrop').addEventListener('click', closePicker);
  sheet.querySelector('.picker-close').addEventListener('click', closePicker);
  sheet.addEventListener('keydown', onKey);
}

function muscleOf(opt) {
  const g = opt?.dataset?.grupo?.trim() || '';
  return g && g !== 'Otro' ? g : '';
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
  meta.append(dot, document.createTextNode(grupo));
  if (foco) {
    const spec = document.createElement('span');
    spec.className = 'muscle-focus';
    spec.textContent = foco;
    meta.append(spec);
  }
  return meta;
}

function entryOf(btn) {
  return btn.parentElement?.classList.contains('picker-row') ? btn.parentElement : btn;
}

function paintGroups(select) {
  const present = new Set([...select.options].map((opt) => opt.dataset.grupo).filter(Boolean));
  const order = GRUPO_ORDER.filter((g) => present.has(g));
  for (const g of present) if (!order.includes(g)) order.push(g);
  const chips = [];
  if ([...select.options].some((opt) => opt.dataset.hoy === '1')) chips.push(['Hoy', '__hoy__']);
  chips.push(['Todos', '']);
  for (const g of order) chips.push([g, g]);
  groupsEl.replaceChildren();
  for (const [label, value] of chips) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.dataset.grupo = value;
    btn.setAttribute('aria-pressed', value === findGrupo ? 'true' : 'false');
    btn.addEventListener('click', () => {
      findGrupo = value;
      for (const chip of groupsEl.children) {
        chip.setAttribute('aria-pressed', chip.dataset.grupo === findGrupo ? 'true' : 'false');
      }
      applyFind();
    });
    groupsEl.append(btn);
  }
}

function applyFind() {
  const q = fold(findQuery);
  let shown = 0;
  list.querySelectorAll('.picker-option').forEach((btn) => {
    const grupo = btn.dataset.grupo || '';
    const groupOk = !findGrupo || (findGrupo === '__hoy__' ? btn.dataset.hoy === '1' : grupo === findGrupo);
    const ok = groupOk && (!q || (btn.dataset.find || '').includes(q));
    entryOf(btn).hidden = !ok;
    if (ok) shown += 1;
  });
  if (emptyEl) emptyEl.hidden = shown > 0;
}

function onKey(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    closePicker();
    return;
  }
  if (e.target.closest?.('.picker-search')) return;
  const options = [...list.querySelectorAll('.picker-option')].filter((btn) => {
    const entry = btn.parentElement?.classList.contains('picker-row') ? btn.parentElement : btn;
    return !entry.hidden;
  });
  const i = options.indexOf(document.activeElement);
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    options[Math.min(i + 1, options.length - 1)]?.focus();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    options[Math.max(i - 1, 0)]?.focus();
  } else if (e.key === 'Home') {
    e.preventDefault();
    options[0]?.focus();
  } else if (e.key === 'End') {
    e.preventDefault();
    options.at(-1)?.focus();
  }
}

function scrollStillLocked() {
  return !!document.querySelector('.editor-sheet.open, .picker-sheet.open');
}

function closePicker({ immediate = false } = {}) {
  if (!sheet || sheet.hidden) return;
  openSelect = null;
  const trigger = lastTrigger;
  sheet.classList.remove('open');
  if (!scrollStillLocked()) document.body.classList.remove('picker-open');
  const hide = () => {
    sheet.hidden = true;
    if (!scrollStillLocked()) document.body.classList.remove('picker-open');
  };
  if (immediate || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    hide();
  } else {
    const panel = sheet.querySelector('.picker-panel');
    panel.addEventListener('transitionend', hide, { once: true });
    setTimeout(hide, 280);
  }
  if (trigger?.isConnected) trigger.focus();
}

function choose(select, value) {
  closePicker({ immediate: true });
  if (!select.isConnected || select.value === value) return;
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

function openPicker(select, label, trigger) {
  ensureSheet();
  document.body.append(sheet);
  openSelect = select;
  lastTrigger = trigger;
  titleEl.textContent = label;
  const catalog = [...select.options].some((opt) => opt.dataset.grupo);
  findQuery = '';
  findGrupo = '';
  searchEl.value = '';
  findEl.hidden = !catalog;
  if (catalog) paintGroups(select);
  list.replaceChildren();
  emptyEl = null;
  if (catalog) {
    emptyEl = document.createElement('p');
    emptyEl.className = 'picker-empty';
    emptyEl.hidden = true;
    emptyEl.textContent = 'Nada que coincida';
    list.append(emptyEl);
  }
  [...select.options].forEach((opt) => {
    const selected = opt.value === select.value;
    const own = opt.dataset.propio === '1';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'picker-option';
    btn.setAttribute('role', 'option');
    btn.setAttribute('aria-selected', selected ? 'true' : 'false');
    const name = opt.textContent.trim();
    btn.dataset.find = fold(name);
    btn.dataset.grupo = opt.dataset.grupo || '';
    if (opt.dataset.hoy === '1') btn.dataset.hoy = '1';
    const grupo = muscleOf(opt);
    const foco = focusOf(opt);
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
    if (selected) mark.innerHTML = icons.check({ size: 14 });
    btn.append(copy);
    if (grupo) btn.setAttribute('aria-label', `${name}, ${grupo}${foco ? `, ${foco}` : ''}`);
    btn.addEventListener('click', () => choose(select, opt.value));
    if (!own) {
      btn.append(mark);
      list.append(btn);
      return;
    }
    const row = document.createElement('div');
    row.className = 'picker-row';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'picker-edit';
    edit.setAttribute('aria-label', `Editar ${name}`);
    edit.innerHTML = icons.pencil({ size: 18 });
    edit.addEventListener('click', () => {
      const id = Number(opt.value);
      closePicker({ immediate: true });
      if (!select.isConnected) return;
      select.dispatchEvent(new CustomEvent('edit-exercise', { bubbles: true, detail: { id } }));
    });
    row.append(btn, edit, mark);
    list.append(row);
  });
  sheet.hidden = false;
  document.body.classList.add('picker-open');
  requestAnimationFrame(() => sheet.classList.add('open'));
  const current = list.querySelector('[aria-selected="true"]') || list.querySelector('.picker-option');
  if (catalog) {
    list.scrollTop = 0;
    (groupsEl.querySelector('button') || current)?.focus();
  } else {
    current?.focus();
    current?.scrollIntoView({ block: 'nearest' });
  }
}

function labelOf(select) {
  const span = select.closest('.field')?.querySelector(':scope > span');
  return span?.textContent.trim() || 'Elegir';
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
    const field = select.closest('label.field');
    let hint = field?.querySelector(':scope > .muscle-hint');
    if (grupo && field) {
      if (!hint) {
        hint = document.createElement('p');
        hint.className = 'muscle-hint';
        hint.setAttribute('aria-hidden', 'true');
        trigger.after(hint);
      }
      hint.replaceChildren(muscleNode(grupo, foco));
    } else {
      hint?.remove();
    }
  };
  sync();
  select.addEventListener('change', sync);
  trigger.addEventListener('click', () => openPicker(select, labelOf(select), trigger));

  const field = select.closest('label.field');
  field?.addEventListener('mousedown', (e) => {
    if (e.target.closest('button, a, input')) return;
    e.preventDefault();
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
    if (openSelect && !openSelect.isConnected) closePicker();
  });
  obs.observe(root, { childList: true, subtree: true });
  window.addEventListener('hashchange', closePicker);
}
