/* Alta de ejercicio dentro de la hoja de ejercicios: nombre, grupo muscular y «Crear y usar».
 * Trabaja sobre el estado `ui` que arma picker.js; ui.close() y ui.restoreTitle() vienen de ahí. */
import { addExercise, GRUPOS } from '../services/workouts.js';
import { inferMuscleGroup, FILTRO_HOY } from '../services/muscle-groups.js';
import { toast } from './dom.js';

/* Con dos letras ya se puede adivinar el grupo sin equivocarse demasiado. */
const MIN_CHARS_TO_GUESS = 2;

let selectedGrupo = '';

function renderPills(ui) {
  ui.creatorPillsEl.replaceChildren();
  for (const g of GRUPOS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'picker-muscle-pill';
    btn.setAttribute('aria-pressed', String(selectedGrupo === g));
    const dot = document.createElement('span');
    dot.className = 'muscle-dot';
    dot.dataset.g = g;
    btn.append(dot, g);
    btn.addEventListener('click', () => {
      selectedGrupo = g;
      renderPills(ui);
      syncCreator(ui);
    });
    ui.creatorPillsEl.append(btn);
  }
}

function syncCreator(ui) {
  const name = ui.creatorInput.value.trim();
  const hasGroup = Boolean(selectedGrupo);
  ui.creatorConfirmBtn.disabled = !name || !hasGroup;
  ui.creatorHintEl.hidden = hasGroup;
  ui.creatorConfirmBtn.textContent = hasGroup && name ? `Crear y usar «${name}»` : 'Crear y usar';
}

/* El ejercicio nuevo entra al <select> real y queda elegido, como si se hubiera tocado. */
function addToSelect(select, { id, nombre, grupo }) {
  if (!select?.isConnected) return;
  const opt = document.createElement('option');
  opt.value = String(id);
  opt.textContent = nombre;
  opt.dataset.grupo = grupo;
  opt.dataset.propio = '1';
  select.append(opt);
  select.value = String(id);
  select.dispatchEvent(new Event('change', { bubbles: true }));
  select.dispatchEvent(new CustomEvent('exercise-created', { bubbles: true, detail: { id, nombre, grupo } }));
}

async function submit(ui) {
  const nombre = ui.creatorInput.value.trim();
  const grupo = selectedGrupo;
  if (!nombre || !grupo) return;
  const select = ui.openSelect;
  ui.creatorConfirmBtn.disabled = true;
  try {
    const id = await addExercise(nombre, grupo);
    toast(`Ejercicio creado: «${nombre}»`);
    ui.close({ immediate: true });
    addToSelect(select, { id, nombre, grupo });
  } catch (err) {
    toast(err?.message || 'No se pudo crear el ejercicio.', { tone: 'danger' });
    ui.creatorConfirmBtn.disabled = false;
  }
}

export function openCreator(ui, initialName = '') {
  ui.findEl.hidden = true;
  ui.list.hidden = true;
  ui.footerEl.hidden = true;
  ui.creatorViewEl.hidden = false;
  ui.titleEl.textContent = 'Crear ejercicio';

  const name = String(initialName || ui.findQuery || '').trim();
  ui.creatorInput.value = name;
  const detected = inferMuscleGroup(name, ui.findGrupo);
  const filtered = ui.findGrupo && ui.findGrupo !== FILTRO_HOY ? ui.findGrupo : '';
  selectedGrupo = detected !== 'Otro' ? detected : filtered;

  renderPills(ui);
  syncCreator(ui);
  requestAnimationFrame(() => {
    if (!name) ui.creatorInput.focus();
    else ui.creatorInput.setSelectionRange(name.length, name.length);
  });
}

export function closeCreator(ui) {
  ui.creatorViewEl.hidden = true;
  ui.findEl.hidden = false;
  ui.list.hidden = false;
  ui.footerEl.hidden = !ui.isCatalog;
  ui.restoreTitle();
  ui.searchEl.focus();
}

export function bindCreator(ui) {
  ui.creatorCancelBtn.addEventListener('click', () => closeCreator(ui));
  ui.creatorConfirmBtn.addEventListener('click', () => submit(ui));
  ui.creatorInput.addEventListener('input', () => {
    const val = ui.creatorInput.value.trim();
    if (!selectedGrupo && val.length >= MIN_CHARS_TO_GUESS) {
      const guess = inferMuscleGroup(val);
      if (guess !== 'Otro') {
        selectedGrupo = guess;
        renderPills(ui);
      }
    }
    syncCreator(ui);
  });
  ui.creatorInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (!ui.creatorConfirmBtn.disabled) submit(ui);
  });
}
