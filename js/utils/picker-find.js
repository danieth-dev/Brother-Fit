/* Buscador de la hoja de ejercicios: filtro por grupo, búsqueda sin tildes, orden por coincidencia
 * y la fila «Crear …» cuando no existe. Trabaja sobre el estado `ui` que arma picker.js. */
import { esc } from './dom.js';
import { fold, matchScore, matchRange } from './text-match.js';
import { inferMuscleGroup, FILTRO_HOY } from '../services/muscle-groups.js';
import { GRUPOS } from '../services/workouts.js';

/* Los ejercicios propios van dentro de una fila con su lápiz: lo que se oculta es la fila. */
export function entryOf(btn) {
  return btn.parentElement?.classList.contains('picker-row') ? btn.parentElement : btn;
}

export function visibleOptions(list) {
  return [...list.querySelectorAll('.picker-option')].filter((btn) => !entryOf(btn).hidden);
}

/* Modo búsqueda: la hoja ocupa todo el alto visible para que el teclado no tape los resultados. */
export function syncSearching(ui) {
  if (!ui.sheet) return;
  const active = document.activeElement === ui.searchEl || ui.findQuery.trim() !== '';
  ui.sheet.classList.toggle('is-searching', !ui.findEl.hidden && active);
}

export function paintGroups(ui, select) {
  const options = [...select.options];
  const present = new Set(options.map((opt) => opt.dataset.grupo).filter(Boolean));
  const order = GRUPOS.filter((g) => present.has(g));
  for (const g of present) if (!order.includes(g)) order.push(g);
  const chips = [];
  if (options.some((opt) => opt.dataset.hoy === '1')) chips.push(['Hoy', FILTRO_HOY]);
  chips.push(['Todos', '']);
  for (const g of order) chips.push([g, g]);

  ui.groupsEl.replaceChildren();
  for (const [label, value] of chips) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.dataset.grupo = value;
    btn.setAttribute('aria-pressed', String(value === ui.findGrupo));
    btn.addEventListener('click', () => {
      ui.findGrupo = value;
      for (const chip of ui.groupsEl.children) {
        chip.setAttribute('aria-pressed', String(chip.dataset.grupo === ui.findGrupo));
      }
      applyFind(ui);
    });
    ui.groupsEl.append(btn);
  }
}

/* Resalta la coincidencia en el nombre original (con tildes). */
function paintName(btn, q) {
  const title = btn.querySelector('.picker-name');
  if (!title) return;
  const name = btn.dataset.name || '';
  const range = matchRange(name, q);
  if (!range) { title.textContent = name; return; }
  const chars = [...name];
  const [start, end] = range;
  const mark = document.createElement('mark');
  mark.textContent = chars.slice(start, end).join('');
  title.replaceChildren(
    document.createTextNode(chars.slice(0, start).join('')),
    mark,
    document.createTextNode(chars.slice(end).join(''))
  );
}

function filterEntries(ui, q) {
  return [...ui.list.querySelectorAll('.picker-option')].map((btn) => {
    const grupo = btn.dataset.grupo || '';
    const groupOk = !ui.findGrupo || (ui.findGrupo === FILTRO_HOY ? btn.dataset.hoy === '1' : grupo === ui.findGrupo);
    const find = btn.dataset.find || '';
    const ok = groupOk && (!q || find.includes(q));
    const entry = entryOf(btn);
    entry.hidden = !ok;
    btn.classList.remove('is-first');
    paintName(btn, ok ? q : '');
    return { entry, btn, ok, idx: Number(btn.dataset.idx), score: q && ok ? matchScore(find, q) : 0 };
  });
}

function paintEmpty(ui, q, shownCount) {
  if (!ui.emptyEl) return;
  ui.emptyEl.hidden = shownCount > 0;
  if (shownCount > 0) return;
  ui.emptyEl.innerHTML = q
    ? `Ningún ejercicio coincide con «<strong>${esc(ui.findQuery.trim())}</strong>».`
    : 'Nada que coincida';
}

/* «Crear …» aparece si se escribió algo que no existe tal cual, con el grupo adivinado. */
function paintCreateRow(ui, entries, shown) {
  const createEl = ui.createEl;
  if (!createEl) return;
  const rawQ = ui.findQuery.trim();
  const hasExact = entries.some((e) => (e.btn.dataset.name || '').toLowerCase() === rawQ.toLowerCase());
  if (rawQ.length < 2 || hasExact) {
    createEl.hidden = true;
    return;
  }
  const candidateGroups = shown.map((s) => s.btn.dataset.grupo).filter(Boolean);
  const detected = inferMuscleGroup(rawQ, ui.findGrupo, candidateGroups);
  createEl.hidden = false;
  createEl.querySelector('.picker-create-name').textContent = rawQ;
  const badge = createEl.querySelector('.picker-create-badge');
  badge.textContent = detected;
  badge.dataset.g = detected;
  createEl.dataset.name = rawQ;
  createEl.dataset.grupo = detected;
  ui.list.append(createEl);
}

export function applyFind(ui) {
  const q = fold(ui.findQuery).trim();
  const entries = filterEntries(ui, q);
  // Mejores coincidencias primero; sin búsqueda, orden original del catálogo.
  entries.sort((a, b) => (q ? a.score - b.score : 0) || a.idx - b.idx);
  for (const { entry } of entries) ui.list.append(entry);
  const shown = entries.filter((e) => e.ok);
  if (q && shown[0]) shown[0].btn.classList.add('is-first');
  paintEmpty(ui, q, shown.length);
  paintCreateRow(ui, entries, shown);
}
