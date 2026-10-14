/* Ficha para corregir o eliminar un ejercicio del atleta. Vive fuera de #app. */
import {
  getExercise, updateExercise, deleteExercise, countSetsForExercise, GRUPOS, isOwnExercise
} from '../services/workouts.js';
import { dismissPicker, mountPickers } from './picker.js';
import { icons } from './icons.js';
import { esc, toast } from './dom.js';

let sheet;
let titleEl;
let form;
let onDone;
let saving = false;

function scrollStillLocked() {
  return !!document.querySelector('.picker-sheet.open');
}

function ensureSheet() {
  if (sheet) return;
  sheet = document.createElement('div');
  sheet.className = 'picker-sheet editor-sheet';
  sheet.hidden = true;
  sheet.innerHTML = `
    <button type="button" class="picker-backdrop" aria-label="Cerrar"></button>
    <div class="picker-panel" role="dialog" aria-modal="true" aria-labelledby="editor-title">
      <div class="picker-head">
        <p class="picker-title" id="editor-title">Editar ejercicio</p>
        <button type="button" class="picker-close" aria-label="Cerrar">${icons.x({ size: 18 })}</button>
      </div>
      <form class="stack editor-form">
        <label class="field"><span>Nombre</span><input name="nombre" autocomplete="off" required></label>
        <label class="field"><span>Grupo muscular</span>
          <select name="grupo">${GRUPOS.map((g) => `<option value="${esc(g)}">${esc(g)}</option>`).join('')}</select>
        </label>
        <button class="btn btn-primary btn-block" type="submit">Guardar</button>
        <button class="editor-delete" type="button">Eliminar ejercicio</button>
      </form>
    </div>
  `;
  document.body.append(sheet);
  titleEl = sheet.querySelector('#editor-title');
  form = sheet.querySelector('form');
  sheet.querySelector('.picker-backdrop').addEventListener('click', () => closeEditor());
  sheet.querySelector('.picker-close').addEventListener('click', () => closeEditor());
  sheet.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeEditor();
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    save();
  });
  form.querySelector('.editor-delete').addEventListener('click', remove);
  window.addEventListener('hashchange', () => closeEditor({ immediate: true }));
}

function closeEditor({ immediate = false } = {}) {
  if (!sheet || sheet.hidden) return;
  dismissPicker();
  onDone = null;
  sheet.classList.remove('open');
  const hide = () => {
    sheet.hidden = true;
    if (!scrollStillLocked()) document.body.classList.remove('picker-open');
  };
  if (immediate || matchMedia('(prefers-reduced-motion: reduce)').matches) hide();
  else {
    sheet.querySelector('.picker-panel').addEventListener('transitionend', hide, { once: true });
    setTimeout(hide, 280);
  }
}

function busy(on) {
  saving = on;
  form.querySelectorAll('button').forEach((b) => { b.disabled = on; });
}

async function save() {
  if (saving) return;
  const id = Number(form.dataset.id);
  const done = onDone;
  busy(true);
  try {
    await updateExercise(id, form.elements.nombre.value, form.elements.grupo.value);
    closeEditor({ immediate: true });
    await done?.({ id, deleted: false });
  } catch (e) {
    toast(e.message || 'No se pudo guardar.');
    busy(false);
  }
}

async function remove() {
  if (saving) return;
  const id = Number(form.dataset.id);
  const nombre = form.elements.nombre.value.trim() || 'este ejercicio';
  const n = await countSetsForExercise(id);
  const msg = n === 0
    ? `¿Eliminar «${nombre}»?`
    : n === 1
      ? `«${nombre}» tiene 1 serie. Si lo eliminas, esa serie sale del historial. ¿Eliminarlo?`
      : `«${nombre}» tiene ${n} series. Si lo eliminas, esas series salen del historial. ¿Eliminarlo?`;
  if (!confirm(msg)) return;
  const done = onDone;
  busy(true);
  try {
    await deleteExercise(id);
    closeEditor({ immediate: true });
    await done?.({ id, deleted: true });
  } catch (e) {
    toast(e.message || 'No se pudo eliminar.');
    busy(false);
  }
}

export async function openExerciseEditor(id, done) {
  const ex = await getExercise(id);
  if (!isOwnExercise(ex)) return;
  ensureSheet();
  dismissPicker();
  onDone = done;
  saving = false;
  form.dataset.id = String(ex.id);
  form.elements.nombre.value = ex.nombre;
  form.elements.grupo.value = GRUPOS.includes(ex.grupo) ? ex.grupo : 'Otro';
  titleEl.textContent = 'Editar ejercicio';
  busy(false);
  mountPickers(sheet);
  form.elements.grupo.dispatchEvent(new Event('change'));
  document.body.append(sheet);
  sheet.hidden = false;
  document.body.classList.add('picker-open');
  requestAnimationFrame(() => sheet.classList.add('open'));
  form.elements.nombre.focus();
  form.elements.nombre.select();
}

export function bindExerciseEdit(el, handler) {
  if (!el._editListening) {
    el._editListening = true;
    el.addEventListener('edit-exercise', (e) => el._afterEdit?.(e));
  }
  el._afterEdit = handler;
}
