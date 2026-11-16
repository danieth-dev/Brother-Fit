/* Panel «Recuerdos» de Bía: perfil, rutina semanal, notas y acceso al historial.
 * Se abre desde Bía y desde Ajustes; quien lo abre pasa onChange para redibujarse. */
import {
  loadAllMemories, deleteMemory, clearAllMemories,
  loadAthleteProfile, saveAthleteProfile, loadWeeklyRoutine, saveWeeklyRoutine,
} from '../services/bia/memory.js';
import { listWorkoutSummaries } from '../services/workouts.js';
import { icons } from './icons.js';
import { toast, esc, go } from './dom.js';
import { askConfirm } from './confirm-sheet.js';
import { openAgentSheet } from './agent-sheet.js';
import { showConnectionPanel } from './connection-panel.js';

/* Tiempo para «Deshacer» antes de borrar de verdad una nota. */
const UNDO_MS = 4500;
const PROFILE_FIELDS = [
  ['nombre', 'Nombre'],
  ['peso', 'Peso'],
  ['estatura', 'Estatura'],
  ['creatina', 'Creatina'],
];
const EMPTY_NOTES = '<p class="empty-note">No hay notas ni descansos adicionales.</p>';
/* Restos de versiones viejas que guardaban cada sesión como recuerdo: no son notas del atleta. */
const LEGACY_SESSION_NOTE = /×|entrenó el|sesión guardada/i;

const pencil = (action, attrs, label) =>
  `<button class="agent-rec-icon-btn" data-action="${action}" ${attrs} type="button" aria-label="${label}">${icons.pencil({ size: 18 })}</button>`;

function section(title, badge, body, { id = '', badgeId = '' } = {}) {
  return `
    <section class="agent-rec-section"${id ? ` id="${id}"` : ''}>
      <div class="agent-rec-section-head">
        <h3 class="agent-rec-section-title">${title}</h3>
        <span class="agent-rec-section-badge"${badgeId ? ` id="${badgeId}"` : ''}>${badge}</span>
      </div>
      ${body}
    </section>`;
}

/* Valor del perfil, o «Sin definir» atenuado cuando el atleta todavía no lo dio. */
function profileRow([field, label], profile) {
  const value = profile[field];
  return `
    <div class="agent-rec-row" data-field="${field}">
      <span class="agent-rec-label">${label}</span>
      <div class="agent-rec-val-wrap">
        <span class="agent-rec-value${value ? '' : ' is-empty'}">${esc(value || 'Sin definir')}</span>
        ${pencil('edit-profile', `data-field="${field}"`, `Editar ${label}`)}
      </div>
    </div>`;
}

function routineRow(r, i) {
  const dot = r.dot && r.grupo ? ` style="--dot: ${esc(r.dot)}"` : '';
  return `
    <div class="agent-rec-row" data-index="${i}">
      <div class="agent-rec-day-main">
        <span class="agent-rec-day">${esc(r.dia)}</span>
        <span class="agent-rec-day-dot"${dot}></span>
        <span class="agent-rec-day-text${r.grupo ? '' : ' is-empty'}">${esc(r.grupo || 'Descanso')}</span>
      </div>
      ${pencil('edit-routine', `data-index="${i}"`, `Editar ${esc(r.dia)}`)}
    </div>`;
}

function noteRow(m) {
  return `
    <div class="agent-rec-row" data-id="${m.id}">
      <div>
        <span class="agent-rec-note-text">${esc(m.contenido)}</span>
        <span class="agent-rec-note-sub">Nota de memoria</span>
      </div>
      <button class="agent-rec-icon-btn is-trash" data-action="del-memory" data-id="${m.id}" type="button" aria-label="Borrar">
        ${icons.trash({ size: 18 })}
      </button>
    </div>`;
}

function panelBody({ profile, routine, notes, sessionCount }) {
  return [
    section('Sobre ti', PROFILE_FIELDS.length,
      `<div class="agent-rec-card">${PROFILE_FIELDS.map((f) => profileRow(f, profile)).join('')}</div>`),
    section('Rutina semanal', `${routine.length} días`,
      `<div class="agent-rec-card">${routine.map(routineRow).join('')}</div>`),
    section('Descansos y notas', notes.length,
      `<div class="agent-rec-card" id="agent-card-rests">${notes.length ? notes.map(noteRow).join('') : EMPTY_NOTES}</div>`,
      { id: 'section-rests', badgeId: 'badge-rests-count' }),
    section('Entrenamientos', sessionCount, `
      <button class="agent-rec-workout-card" id="btn-go-history" type="button">
        <div>
          <span class="agent-rec-workout-title">${sessionCount} sesiones guardadas</span>
          <span class="agent-rec-workout-sub">Ya están en tu Historial. Bía puede consultarlas.</span>
        </div>
        ${icons.chevronRight({ size: 20, cls: 'icon-muted' })}
      </button>`),
    `<div class="agent-rec-footer">
      <button class="agent-rec-danger-btn" id="btn-clear-all-memories" type="button">Borrar todos los recuerdos</button>
      <button class="agent-rec-quiet-btn" data-action="change-key" type="button">Conexión y clave ›</button>
    </div>
    <div id="agent-undo-container" hidden></div>`,
  ].join('');
}

/**
 * Cambia una fila por un campo de texto con Guardar y Cancelar.
 * onSave(valor) guarda; hide son los nodos que se ocultan mientras se edita.
 */
function inlineEdit(row, value, hide, onSave, { short = false } = {}) {
  hide.forEach((n) => { n.hidden = true; });
  const form = document.createElement('div');
  form.className = 'agent-rec-edit-form';
  form.innerHTML = `
    <input type="text" class="agent-rec-edit-input${short ? ' agent-rec-edit-input--short' : ''}" value="${esc(value)}" autocomplete="off" spellcheck="false">
    <button type="button" class="agent-rec-edit-btn agent-rec-edit-save" title="Guardar">${icons.check({ size: 16 })}</button>
    <button type="button" class="agent-rec-edit-btn agent-rec-edit-cancel" title="Cancelar">${icons.close({ size: 16 })}</button>`;
  row.appendChild(form);
  const input = form.querySelector('input');
  input.focus();
  input.select();
  const finish = async (save) => {
    if (save) await onSave(input.value.trim());
    form.remove();
    hide.forEach((n) => { n.hidden = false; });
  };
  form.querySelector('.agent-rec-edit-save').onclick = () => finish(true);
  form.querySelector('.agent-rec-edit-cancel').onclick = () => finish(false);
  input.onkeydown = (ev) => {
    if (ev.key === 'Enter') finish(true);
    if (ev.key === 'Escape') finish(false);
  };
}

function setEmptyText(span, text, empty) {
  span.textContent = text;
  span.classList.toggle('is-empty', empty);
}

/* Borrar una nota se puede deshacer unos segundos; borrar otra confirma la anterior. */
function createUndo(sheet) {
  const pending = { timer: null, id: null, row: null };
  const box = sheet.querySelector('#agent-undo-container');

  const refreshCount = () => {
    const count = sheet.querySelectorAll('#agent-card-rests .agent-rec-row').length;
    sheet.querySelector('#badge-rests-count').textContent = count;
    if (!count) sheet.querySelector('#agent-card-rests').innerHTML = EMPTY_NOTES;
  };
  const clear = () => {
    pending.timer = null;
    pending.id = null;
    pending.row = null;
  };

  return function remove(id, row) {
    if (pending.timer) {
      clearTimeout(pending.timer);
      deleteMemory(pending.id);
      pending.row?.remove();
    }
    Object.assign(pending, { id, row });
    row.hidden = true;
    box.hidden = false;
    box.innerHTML = `
      <div class="agent-undo-bar">
        <span>Recuerdo borrado</span>
        <button type="button" class="agent-undo-btn">Deshacer</button>
      </div>`;
    box.querySelector('.agent-undo-btn').onclick = () => {
      clearTimeout(pending.timer);
      row.hidden = false;
      box.hidden = true;
      clear();
      toast('Recuerdo restaurado');
    };
    pending.timer = setTimeout(async () => {
      await deleteMemory(id);
      row.remove();
      box.hidden = true;
      clear();
      refreshCount();
    }, UNDO_MS);
  };
}

export async function showMemoriesPanel(agent, { onChange } = {}) {
  const [profile, routine, summaries, memories] = await Promise.all([
    loadAthleteProfile(),
    loadWeeklyRoutine(),
    listWorkoutSummaries(),
    loadAllMemories(),
  ]);
  const notes = memories.filter((m) => !LEGACY_SESSION_NOTE.test(String(m.contenido || '')));
  const sessionCount = summaries.filter((s) => s.finishedAt || s.totalSets > 0).length || summaries.length;
  const { sheet, close } = openAgentSheet({
    title: 'Recuerdos',
    subtitle: 'Lo que Bía recuerda de ti entre conversaciones. Edítalo o bórralo cuando quieras.',
    body: panelBody({ profile, routine, notes, sessionCount }),
  });
  const removeNote = createUndo(sheet);

  const actions = {
    'edit-profile': (btn) => {
      const { field } = btn.dataset;
      const row = btn.closest('.agent-rec-row');
      const valueEl = row.querySelector('.agent-rec-value');
      inlineEdit(row, profile[field] || '', [row.querySelector('.agent-rec-val-wrap')], async (value) => {
        if (!value) return;
        profile[field] = value;
        await saveAthleteProfile({ [field]: value });
        setEmptyText(valueEl, value, false);
        const label = PROFILE_FIELDS.find(([f]) => f === field)?.[1] || field;
        toast(`${label} actualizado`);
      });
    },
    'edit-routine': (btn) => {
      const idx = Number(btn.dataset.index);
      const row = btn.closest('.agent-rec-row');
      const textEl = row.querySelector('.agent-rec-day-text');
      inlineEdit(row, routine[idx].grupo, [btn, textEl], async (value) => {
        routine[idx].grupo = value;
        await saveWeeklyRoutine(routine);
        setEmptyText(textEl, value || 'Descanso', !value);
        toast(value ? 'Rutina actualizada' : 'Día marcado como descanso');
      }, { short: true });
    },
    'del-memory': (btn) => removeNote(Number(btn.dataset.id), btn.closest('.agent-rec-row')),
    'change-key': () => {
      close();
      showConnectionPanel(agent, { onChange });
    },
  };

  sheet.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (btn && actions[btn.dataset.action]) {
      actions[btn.dataset.action](btn);
      return;
    }
    if (e.target.closest('#btn-go-history')) {
      close();
      go('/history');
      return;
    }
    if (e.target.closest('#btn-clear-all-memories')) {
      const ok = await askConfirm({
        title: 'Borrar todos los recuerdos',
        body: 'Se eliminarán las notas y descansos adicionales. Los entrenamientos en tu historial y tus datos personales no se tocan.',
        confirmLabel: 'Borrar todo',
        danger: true,
      });
      if (!ok) return;
      await clearAllMemories();
      sheet.querySelector('#agent-card-rests').innerHTML = EMPTY_NOTES;
      sheet.querySelector('#badge-rests-count').textContent = '0';
      toast('Recuerdos adicionales eliminados');
    }
  });
}
