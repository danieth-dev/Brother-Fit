/* Lista propia para los <select>. En el teléfono el menú nativo no hereda la paleta. */
import { icons } from './icons.js';
import { addExercise } from '../services/workouts.js';
import { toast, esc } from './dom.js';

let sheet;
let list;
let titleEl;
let lastTrigger;
let openSelect;
let findEl;
let searchEl;
let searchClearBtn;
let groupsEl;
let emptyEl;
let createEl;
let footerEl;
let footerCreateBtn;
let creatorViewEl;
let creatorInput;
let creatorPillsEl;
let creatorHintEl;
let creatorConfirmBtn;
let creatorCancelBtn;
let creatorSelectedGrupo = '';
let isCreatingInline = false;
let findQuery = '';
let findGrupo = '';

const GRUPO_ORDER = ['Pecho', 'Espalda', 'Piernas', 'Hombros', 'Bíceps', 'Tríceps', 'Core', 'Cardio', 'Otro'];

export function inferMuscleGroup(name, activeFilter = '', candidateGroups = []) {
  if (activeFilter && activeFilter !== '__hoy__' && GRUPO_ORDER.includes(activeFilter)) {
    return activeFilter;
  }
  const q = fold(name).trim();
  if (!q) return 'Otro';

  // Casos compuestos específicos para evitar falsos positivos
  if (/elevacion(es)?\s*(de\s*)?pierna/i.test(q)) return 'Core';
  if (/jalon|pulldown|dominad|pull\s*up|chin\s*up/i.test(q)) return 'Espalda';
  if (/peso\s*muerto\s*(rumano|rigido)|rdl/i.test(q)) return 'Piernas';
  if (/press\s*cerrado|fondos?\s*(de\s*)?triceps/i.test(q)) return 'Tríceps';
  if (/fondos?\s*(de\s*)?pecho/i.test(q)) return 'Pecho';

  // Piernas
  if (/\b(pierna|piernas|pata|patas|legs?)\b|sentadill|squat|hack|prensa|femoral|isquio|cuadric|quad|glute|bulgar|zancad|lunge|gemel|pantorril|abduct|aduct|hip\s*thrust|puente\s*gluteo|sissy|nordic|step\s*up|soleo|tibial/i.test(q)) {
    return 'Piernas';
  }

  // Espalda
  if (/\b(espalda|back|dorsal|dorsales|trapecio|trapecios)\b|remo|row|lat\s*pull|pullover|deadlift|peso\s*muerto|t-?bar|seal\s*row/i.test(q)) {
    return 'Espalda';
  }

  // Pecho
  if (/\b(pecho|pechos|pectoral|pectorales|chest)\b|press\s*banc|banca|bench|apertur|flys?|flyes?|cruce\s*polea|contractor|pec\s*deck|flexion(es)?|push\s*ups?/i.test(q)) {
    return 'Pecho';
  }

  // Hombros
  if (/\b(hombro|hombros|deltoid|deltoides|shoulder|shoulders)\b|militar|overhead|ohp|lateral(es)?|frontal(es)?|pajaro|pajaros|face\s*pull|arnold|encogimi|ypraise|y-?raise|w-?raise/i.test(q)) {
    return 'Hombros';
  }

  // Bíceps
  if (/\b(biceps?|brazo|brazos|arms?)\b|curl|martillo|predicador|scott|braquial/i.test(q)) {
    return 'Bíceps';
  }

  // Tríceps
  if (/\b(triceps?)\b|copa|frances|francés|pushdown|patada\s*tricep|rompecraneos/i.test(q)) {
    return 'Tríceps';
  }

  // Core
  if (/\b(core|abs?|abdomen|abdominal|abdominales)\b|plancha|plank|crunch|rueda\s*abdom|oblicuo|hollow|dragon\s*flag|twist\s*rus|hipopresiv/i.test(q)) {
    return 'Core';
  }

  // Cardio
  if (/\b(cardio|aerobico)\b|cinta|treadmill|bici|biciclet|bike|correr|running?|eliptic|ergometro|stair|escalador|salto\s*cuerda|comba|burpee|hiit/i.test(q)) {
    return 'Cardio';
  }

  // Si hay ejercicios visibles coincidentes en la lista, inferir por el grupo predominante
  if (Array.isArray(candidateGroups) && candidateGroups.length > 0) {
    const counts = {};
    for (const g of candidateGroups) {
      if (g && GRUPO_ORDER.includes(g)) counts[g] = (counts[g] || 0) + 1;
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] > 0) return top[0];
  }

  return 'Otro';
}

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
  document.body.append(sheet);
  list = sheet.querySelector('.picker-list');
  titleEl = sheet.querySelector('.picker-title');
  findEl = sheet.querySelector('.picker-find');
  searchEl = sheet.querySelector('.picker-search');
  searchClearBtn = sheet.querySelector('.picker-search-clear');
  groupsEl = sheet.querySelector('.picker-groups');
  footerEl = sheet.querySelector('.picker-footer');
  footerCreateBtn = sheet.querySelector('.picker-footer-create-btn');
  creatorViewEl = sheet.querySelector('.picker-creator-view');
  creatorInput = sheet.querySelector('.picker-create-input');
  creatorPillsEl = sheet.querySelector('.picker-create-pills');
  creatorHintEl = sheet.querySelector('.picker-create-hint');
  creatorConfirmBtn = sheet.querySelector('.picker-create-confirm-btn');
  creatorCancelBtn = sheet.querySelector('.picker-create-cancel-btn');

  searchEl.addEventListener('input', () => {
    findQuery = searchEl.value;
    searchClearBtn.hidden = !findQuery;
    applyFind();
    list.scrollTop = 0;
    syncSearching();
  });

  searchClearBtn.addEventListener('click', () => {
    searchEl.value = '';
    searchClearBtn.hidden = true;
    findQuery = '';
    applyFind();
    list.scrollTop = 0;
    searchEl.focus();
    syncSearching();
  });

  footerCreateBtn.addEventListener('click', () => {
    openInlineCreator(searchEl.value.trim());
  });

  creatorCancelBtn.addEventListener('click', closeInlineCreator);
  creatorConfirmBtn.addEventListener('click', submitInlineCreator);

  creatorInput.addEventListener('input', () => {
    const val = creatorInput.value.trim();
    if (!creatorSelectedGrupo && val.length >= 2) {
      const autoG = inferMuscleGroup(val);
      if (autoG !== 'Otro') {
        creatorSelectedGrupo = autoG;
        renderCreatorPills();
      }
    }
    syncCreatorUi();
  });

  creatorInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!creatorConfirmBtn.disabled) submitInlineCreator();
    }
  });

  // Modo búsqueda: la hoja ocupa todo el alto visible para que el teclado no tape los resultados.
  searchEl.addEventListener('focus', syncSearching);
  searchEl.addEventListener('blur', () => setTimeout(syncSearching, 0));
  searchEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const first = firstVisible();
    if (first) {
      first.click();
    } else if (createEl && !createEl.hidden) {
      openInlineCreator(createEl.dataset.name || searchEl.value.trim());
    } else if (searchEl.value.trim()) {
      openInlineCreator(searchEl.value.trim());
    }
  });
  sheet.querySelector('.picker-backdrop').addEventListener('click', closePicker);
  sheet.querySelector('.picker-close').addEventListener('click', closePicker);
  sheet.addEventListener('keydown', onKey);
  bindDragToClose();
}

/* Deslizar hacia abajo desde la barrita (o el encabezado) para cerrar, como una hoja nativa. */
function bindDragToClose() {
  const panel = sheet.querySelector('.picker-panel');
  const backdrop = sheet.querySelector('.picker-backdrop');
  const zones = [sheet.querySelector('.picker-grabber'), sheet.querySelector('.picker-head')];
  let startY = 0, lastY = 0, lastT = 0, velocity = 0, dragging = false, pointerId = null;

  const reset = () => {
    panel.style.transition = '';
    panel.style.transform = '';
    backdrop.style.transition = '';
    backdrop.style.opacity = '';
  };

  const onDown = (e) => {
    if (e.button > 0 || e.target.closest('.picker-close')) return;
    dragging = true;
    pointerId = e.pointerId;
    startY = lastY = e.clientY;
    lastT = e.timeStamp;
    velocity = 0;
    e.currentTarget.setPointerCapture(pointerId);
    panel.style.transition = 'none';
    backdrop.style.transition = 'none';
  };

  const onMove = (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    const raw = e.clientY - startY;
    // Hacia arriba solo cede un poco (resistencia); hacia abajo sigue al dedo.
    const dy = raw > 0 ? raw : raw / 6;
    const dt = Math.max(1, e.timeStamp - lastT);
    velocity = (e.clientY - lastY) / dt;
    lastY = e.clientY;
    lastT = e.timeStamp;
    panel.style.transform = `translateY(${dy}px)`;
    const h = panel.offsetHeight || 1;
    backdrop.style.opacity = String(Math.max(0, 1 - Math.max(0, dy) / h));
  };

  const onUp = (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    dragging = false;
    const dy = e.clientY - startY;
    const h = panel.offsetHeight || 1;
    const shouldClose = dy > Math.min(140, h * 0.35) || (velocity > 0.65 && dy > 40);
    if (!shouldClose) {
      panel.style.transition = 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
      backdrop.style.transition = 'opacity 0.2s ease';
      panel.style.transform = 'translateY(0)';
      backdrop.style.opacity = '1';
      setTimeout(reset, 220);
      return;
    }
    // Si se decide cerrar, ocultamos teclado y cerramos
    if (document.activeElement === searchEl) searchEl.blur();
    panel.style.transition = 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)';
    panel.style.transform = `translateY(${h}px)`;
    backdrop.style.transition = 'opacity 0.22s ease';
    backdrop.style.opacity = '0';
    setTimeout(() => {
      reset();
      closePicker({ immediate: true });
    }, 240);
  };

  for (const z of zones) {
    z.addEventListener('pointerdown', onDown);
    z.addEventListener('pointermove', onMove);
    z.addEventListener('pointerup', onUp);
    z.addEventListener('pointercancel', onUp);
  }
}

function normalizeGrupoPicker(grupo) {
  let g = String(grupo || '').trim();
  if (!g) return '';
  if (/b[\?íi\uFFFD]ceps/i.test(g)) return 'Bíceps';
  if (/tr[\?íi\uFFFD]ceps/i.test(g)) return 'Tríceps';
  if (/pecho|pectoral/i.test(g)) return 'Pecho';
  if (/espalda|dorsal/i.test(g)) return 'Espalda';
  if (/pierna|cuadriceps|femoral|gluteo/i.test(g)) return 'Piernas';
  if (/hombro|deltoid/i.test(g)) return 'Hombros';
  if (/core|abdomen|abdominal/i.test(g)) return 'Core';
  if (/cardio/i.test(g)) return 'Cardio';
  const match = GRUPO_ORDER.find((v) => v.toLowerCase() === g.toLowerCase());
  return match || g;
}

function muscleOf(opt) {
  let g = normalizeGrupoPicker(opt?.dataset?.grupo);
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

/* ---------- Alto visible real (el teclado en Android no achica la página) ---------- */
function syncViewport() {
  const vv = window.visualViewport;
  if (!vv || !sheet) return;
  sheet.style.setProperty('--vvh', `${vv.height}px`);
  sheet.style.setProperty('--vvt', `${vv.offsetTop}px`);
}

function watchViewport(on) {
  const vv = window.visualViewport;
  if (!vv) return;
  const fn = on ? 'addEventListener' : 'removeEventListener';
  vv[fn]('resize', syncViewport);
  vv[fn]('scroll', syncViewport);
  if (on) syncViewport();
}

function syncSearching() {
  if (!sheet) return;
  const active = document.activeElement === searchEl || findQuery.trim() !== '';
  sheet.classList.toggle('is-searching', !findEl.hidden && active);
}

function firstVisible() {
  return [...list.querySelectorAll('.picker-option')].find((btn) => !entryOf(btn).hidden);
}

/* Puntuación: 0 = el nombre empieza así · 1 = una palabra empieza así · 2 = aparece en medio */
function scoreOf(find, q) {
  if (find.startsWith(q)) return 0;
  if (find.includes(` ${q}`)) return 1;
  return 2;
}

/* Resalta la coincidencia en el nombre original (con tildes), mapeando carácter a carácter. */
function paintName(btn, q) {
  const title = btn.querySelector('.picker-name');
  const name = btn.dataset.name || '';
  if (!title) return;
  if (!q) { title.textContent = name; return; }
  const chars = [...name];
  const folded = chars.map((c) => fold(c));
  const flat = folded.join('');
  const at = flat.indexOf(q);
  if (at < 0) { title.textContent = name; return; }
  let pos = 0, start = -1, end = chars.length;
  for (let i = 0; i < chars.length; i++) {
    if (start < 0 && pos >= at) start = i;
    pos += folded[i].length;
    if (pos >= at + q.length) { end = i + 1; break; }
  }
  if (start < 0) start = 0;
  const mark = document.createElement('mark');
  mark.textContent = chars.slice(start, end).join('');
  title.replaceChildren(
    document.createTextNode(chars.slice(0, start).join('')),
    mark,
    document.createTextNode(chars.slice(end).join(''))
  );
}

function applyFind() {
  const q = fold(findQuery).trim();
  const entries = [];
  list.querySelectorAll('.picker-option').forEach((btn) => {
    const grupo = btn.dataset.grupo || '';
    const groupOk = !findGrupo || (findGrupo === '__hoy__' ? btn.dataset.hoy === '1' : grupo === findGrupo);
    const find = btn.dataset.find || '';
    const ok = groupOk && (!q || find.includes(q));
    const entry = entryOf(btn);
    entry.hidden = !ok;
    btn.classList.remove('is-first');
    paintName(btn, ok ? q : '');
    entries.push({ entry, btn, ok, idx: Number(btn.dataset.idx), score: q && ok ? scoreOf(find, q) : 0 });
  });
  // Mejores coincidencias primero; sin búsqueda, orden original del catálogo.
  entries.sort((a, b) => (q ? a.score - b.score : 0) || a.idx - b.idx);
  for (const { entry } of entries) list.append(entry);
  const shown = entries.filter((e) => e.ok);
  if (q && shown[0]) shown[0].btn.classList.add('is-first');
  if (emptyEl) {
    if (shown.length === 0) {
      emptyEl.hidden = false;
      emptyEl.innerHTML = q
        ? `Ningún ejercicio coincide con «<strong>${esc(findQuery.trim())}</strong>».`
        : 'Nada que coincida';
    } else {
      emptyEl.hidden = true;
    }
  }

  if (createEl) {
    const rawQ = findQuery.trim();
    const hasExact = entries.some((e) => (e.btn.dataset.name || '').toLowerCase() === rawQ.toLowerCase());
    if (rawQ.length >= 2 && !hasExact) {
      createEl.hidden = false;
      const candidateGroups = shown.map((s) => s.btn.dataset.grupo).filter(Boolean);
      const detected = inferMuscleGroup(rawQ, findGrupo, candidateGroups);
      const nameEl = createEl.querySelector('.picker-create-name');
      if (nameEl) nameEl.textContent = rawQ;
      const badge = createEl.querySelector('.picker-create-badge');
      if (badge) {
        badge.textContent = detected;
        badge.dataset.g = detected;
      }
      createEl.dataset.name = rawQ;
      createEl.dataset.grupo = detected;
      list.append(createEl);
    } else {
      createEl.hidden = true;
    }
  }
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

function openInlineCreator(initialName = '') {
  if (!creatorViewEl) return;
  isCreatingInline = true;
  findEl.hidden = true;
  list.hidden = true;
  if (footerEl) footerEl.hidden = true;
  creatorViewEl.hidden = false;
  titleEl.textContent = 'Crear ejercicio';

  const name = String(initialName || findQuery || '').trim();
  creatorInput.value = name;
  const detected = inferMuscleGroup(name, findGrupo);
  creatorSelectedGrupo = (detected && detected !== 'Otro') ? detected : (findGrupo && findGrupo !== '__hoy__' ? findGrupo : '');

  renderCreatorPills();
  syncCreatorUi();

  requestAnimationFrame(() => {
    if (!name) creatorInput.focus();
    else creatorInput.setSelectionRange(name.length, name.length);
  });
}

function closeInlineCreator() {
  isCreatingInline = false;
  creatorViewEl.hidden = true;
  findEl.hidden = false;
  list.hidden = false;
  const catalog = [...openSelect?.options || []].some((opt) => opt.dataset.grupo);
  if (footerEl) footerEl.hidden = !catalog;
  titleEl.textContent = openSelect ? labelOf(openSelect) : 'Elegir ejercicio';
  searchEl.focus();
}

function renderCreatorPills() {
  if (!creatorPillsEl) return;
  creatorPillsEl.replaceChildren();
  for (const g of GRUPO_ORDER) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'picker-muscle-pill';
    btn.setAttribute('aria-pressed', String(creatorSelectedGrupo === g));
    btn.innerHTML = `<span class="muscle-dot" data-g="${g}"></span>${g}`;
    btn.addEventListener('click', () => {
      creatorSelectedGrupo = g;
      renderCreatorPills();
      syncCreatorUi();
    });
    creatorPillsEl.append(btn);
  }
}

function syncCreatorUi() {
  if (!creatorConfirmBtn || !creatorInput || !creatorHintEl) return;
  const name = creatorInput.value.trim();
  const hasGroup = Boolean(creatorSelectedGrupo);
  creatorConfirmBtn.disabled = !name || !hasGroup;
  if (!hasGroup) {
    creatorHintEl.textContent = 'Elige un grupo muscular para continuar';
    creatorHintEl.hidden = false;
    creatorConfirmBtn.textContent = 'Crear y usar';
  } else {
    creatorHintEl.hidden = true;
    creatorConfirmBtn.textContent = name ? `Crear y usar «${name}»` : 'Crear y usar';
  }
}

async function submitInlineCreator() {
  const name = creatorInput.value.trim();
  const grupo = creatorSelectedGrupo;
  if (!name || !grupo) return;
  const select = openSelect;
  try {
    creatorConfirmBtn.disabled = true;
    const newId = await addExercise(name, grupo);
    toast(`Ejercicio creado: «${name}»`);
    closePicker({ immediate: true });
    if (select && select.isConnected) {
      const opt = document.createElement('option');
      opt.value = String(newId);
      opt.textContent = name;
      opt.dataset.grupo = grupo;
      opt.dataset.propio = '1';
      select.append(opt);
      select.value = String(newId);
      select.dispatchEvent(new Event('change', { bubbles: true }));
      select.dispatchEvent(new CustomEvent('exercise-created', {
        bubbles: true,
        detail: { id: newId, nombre: name, grupo }
      }));
    }
  } catch (err) {
    toast(err?.message || 'Error al crear ejercicio.', { tone: 'danger' });
    creatorConfirmBtn.disabled = false;
  }
}

function closePicker({ immediate = false } = {}) {
  if (!sheet || sheet.hidden) return;
  openSelect = null;
  const trigger = lastTrigger;
  sheet.classList.remove('open');
  watchViewport(false);
  if (document.activeElement === searchEl) searchEl.blur();
  if (document.activeElement === creatorInput) creatorInput.blur();
  isCreatingInline = false;
  if (creatorViewEl) creatorViewEl.hidden = true;
  if (findEl) findEl.hidden = false;
  if (list) list.hidden = false;
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

export function openPicker(select, label, trigger) {
  ensureSheet();
  document.body.append(sheet);
  openSelect = select;
  lastTrigger = trigger;
  titleEl.textContent = label;
  const catalog = [...select.options].some((opt) => opt.dataset.grupo);
  findQuery = '';
  findGrupo = '';
  searchEl.value = '';
  if (searchClearBtn) searchClearBtn.hidden = true;
  findEl.hidden = !catalog;
  if (footerEl) footerEl.hidden = !catalog;
  if (creatorViewEl) creatorViewEl.hidden = true;
  list.hidden = false;
  isCreatingInline = false;
  sheet.classList.toggle('picker-sheet--catalog', catalog);
  sheet.classList.remove('is-searching');
  watchViewport(true);
  if (catalog) paintGroups(select);
  list.replaceChildren();
  emptyEl = null;
  createEl = null;
  if (catalog) {
    emptyEl = document.createElement('p');
    emptyEl.className = 'picker-empty';
    emptyEl.hidden = true;
    emptyEl.textContent = 'Nada que coincida';
    list.append(emptyEl);

    createEl = document.createElement('div');
    createEl.className = 'picker-create-wrap';
    createEl.hidden = true;
    createEl.innerHTML = `
      <button type="button" class="picker-create-btn">
        <span class="picker-create-icon">${icons.plus({ size: 16 })}</span>
        <span class="picker-create-text">Crear «<strong class="picker-create-name"></strong>»</span>
        <span class="picker-create-badge"></span>
      </button>
    `;
    const createBtn = createEl.querySelector('.picker-create-btn');
    createBtn.addEventListener('click', () => {
      openInlineCreator(createEl.dataset.name || searchEl.value.trim());
    });
    list.append(createEl);
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
    btn.dataset.name = name;
    btn.dataset.idx = String(opt.index);
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
    mark.innerHTML = icons.check({ size: 14 });
    btn.append(copy, mark);
    if (grupo) btn.setAttribute('aria-label', `${name}, ${grupo}${foco ? `, ${foco}` : ''}`);
    btn.addEventListener('click', () => choose(select, opt.value));
    if (!own) {
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
    row.append(btn, edit);
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
