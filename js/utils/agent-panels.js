/* Paneles de la asistente Bía: «Recuerdos» (perfil, rutina, notas) y «Conexión y API key».
 * Se abren desde la pantalla de Bía y desde Ajustes, así que viven aquí y no en una vista.
 * Quien abre un panel pasa onChange para redibujarse cuando cambia la conexión. */

import { getAgentConfig, setAgentConfig } from '../services/bia/config.js';
import {
  loadAllMemories, deleteMemory, clearAllMemories,
  loadAthleteProfile, saveAthleteProfile, loadWeeklyRoutine, saveWeeklyRoutine,
} from '../services/bia/memory.js';
import { listWorkoutSummaries } from '../services/workouts.js';
import { icons } from './icons.js';
import { toast, esc, go } from './dom.js';
import { askConfirm } from './confirm-sheet.js';
import { bindSheetDrag } from './sheet-drag.js';

/* Valor del perfil, o «Sin definir» atenuado cuando el atleta todavía no lo dio. */
function profileValue(value, id) {
  return value
    ? `<span class="agent-rec-value" id="${id}">${esc(value)}</span>`
    : `<span class="agent-rec-value is-empty" id="${id}">Sin definir</span>`;
}

/* --- Drawer de Recuerdos (Nuevo diseño agrupado) --- */
export async function showMemoriesPanel(agent, { onChange } = {}) {
  const [profile, routine, summaries, rawMemories] = await Promise.all([
    loadAthleteProfile(),
    loadWeeklyRoutine(),
    listWorkoutSummaries(),
    loadAllMemories(),
  ]);

  // Filtrar recuerdos de texto para excluir duplicados corruptos de sesiones si existían
  const customMemories = rawMemories.filter((m) => {
    const text = String(m.contenido || '').toLowerCase();
    if (text.includes('×') || text.includes('entrenó el') || text.includes('sesión guardada')) return false;
    return true;
  });

  const sessionCount = summaries.filter((s) => s.finishedAt || (s.totalSets && s.totalSets > 0)).length || summaries.length;

  const sheet = document.createElement('div');
  sheet.className = 'agent-sheet';
  sheet.innerHTML = `
    <div class="agent-sheet-inner">
      <div class="agent-sheet-drag" aria-hidden="true"></div>

      <div class="agent-sheet-head">
        <div class="agent-sheet-head-titles">
          <h2>Recuerdos</h2>
          <p>Lo que Bía recuerda de ti entre conversaciones. Edítalo o bórralo cuando quieras.</p>
        </div>
        <button class="agent-sheet-close" id="agent-sheet-close" type="button" aria-label="Cerrar">
          ${icons.close({ size: 22 })}
        </button>
      </div>

      <!-- 1. Sobre ti -->
      <section class="agent-rec-section">
        <div class="agent-rec-section-head">
          <h3 class="agent-rec-section-title">Sobre ti</h3>
          <span class="agent-rec-section-badge">4</span>
        </div>
        <div class="agent-rec-card" id="agent-card-profile">
          <div class="agent-rec-row" data-field="nombre">
            <span class="agent-rec-label">Nombre</span>
            <div class="agent-rec-val-wrap">
              ${profileValue(profile.nombre, 'val-nombre')}
              <button class="agent-rec-icon-btn" data-action="edit-profile" data-field="nombre" type="button" aria-label="Editar Nombre">
                ${icons.pencil({ size: 18 })}
              </button>
            </div>
          </div>
          <div class="agent-rec-row" data-field="peso">
            <span class="agent-rec-label">Peso</span>
            <div class="agent-rec-val-wrap">
              ${profileValue(profile.peso, 'val-peso')}
              <button class="agent-rec-icon-btn" data-action="edit-profile" data-field="peso" type="button" aria-label="Editar Peso">
                ${icons.pencil({ size: 18 })}
              </button>
            </div>
          </div>
          <div class="agent-rec-row" data-field="estatura">
            <span class="agent-rec-label">Estatura</span>
            <div class="agent-rec-val-wrap">
              ${profileValue(profile.estatura, 'val-estatura')}
              <button class="agent-rec-icon-btn" data-action="edit-profile" data-field="estatura" type="button" aria-label="Editar Estatura">
                ${icons.pencil({ size: 18 })}
              </button>
            </div>
          </div>
          <div class="agent-rec-row" data-field="creatina">
            <span class="agent-rec-label">Creatina</span>
            <div class="agent-rec-val-wrap">
              ${profileValue(profile.creatina, 'val-creatina')}
              <button class="agent-rec-icon-btn" data-action="edit-profile" data-field="creatina" type="button" aria-label="Editar Creatina">
                ${icons.pencil({ size: 18 })}
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- 2. Rutina semanal -->
      <section class="agent-rec-section">
        <div class="agent-rec-section-head">
          <h3 class="agent-rec-section-title">Rutina semanal</h3>
          <span class="agent-rec-section-badge">${routine.length} días</span>
        </div>
        <div class="agent-rec-card" id="agent-card-routine">
          ${routine
            .map(
              (r, i) => `
            <div class="agent-rec-row" data-index="${i}">
              <div class="agent-rec-day-main">
                <span class="agent-rec-day">${esc(r.dia)}</span>
                <span class="agent-rec-day-dot"${r.dot && r.grupo ? ` style="--dot: ${esc(r.dot)}"` : ''}></span>
                <span class="agent-rec-day-text${r.grupo ? '' : ' is-empty'}" id="val-routine-${i}">${esc(r.grupo || 'Descanso')}</span>
              </div>
              <button class="agent-rec-icon-btn" data-action="edit-routine" data-index="${i}" type="button" aria-label="Editar ${r.dia}">
                ${icons.pencil({ size: 18 })}
              </button>
            </div>
          `
            )
            .join('')}
        </div>
      </section>

      <!-- 3. Descansos y notas -->
      <section class="agent-rec-section" id="section-rests">
        <div class="agent-rec-section-head">
          <h3 class="agent-rec-section-title">Descansos y notas</h3>
          <span class="agent-rec-section-badge" id="badge-rests-count">${customMemories.length}</span>
        </div>
        <div class="agent-rec-card" id="agent-card-rests">
          ${
            customMemories.length > 0
              ? customMemories
                  .map(
                    (m) => `
              <div class="agent-rec-row" data-id="${m.id}" id="rec-item-${m.id}">
                <div>
                  <span class="agent-rec-note-text">${esc(m.contenido)}</span>
                  <span class="agent-rec-note-sub">Nota de memoria</span>
                </div>
                <button class="agent-rec-icon-btn is-trash" data-action="del-memory" data-id="${m.id}" type="button" aria-label="Borrar">
                  ${icons.trash({ size: 18 })}
                </button>
              </div>
            `
                  )
                  .join('')
              : '<p class="empty-note">No hay notas ni descansos adicionales.</p>'
          }
        </div>
      </section>

      <!-- 4. Entrenamientos -->
      <section class="agent-rec-section">
        <div class="agent-rec-section-head">
          <h3 class="agent-rec-section-title">Entrenamientos</h3>
          <span class="agent-rec-section-badge">${sessionCount}</span>
        </div>
        <button class="agent-rec-workout-card" id="btn-go-history" type="button">
          <div>
            <span class="agent-rec-workout-title">${sessionCount} sesiones guardadas</span>
            <span class="agent-rec-workout-sub">Ya están en tu Historial. Bía puede consultarlas.</span>
          </div>
          ${icons.chevronRight({ size: 20, cls: 'icon-muted' })}
        </button>
      </section>

      <!-- Pie de pantalla -->
      <div class="agent-rec-footer">
        <button class="agent-rec-danger-btn" id="btn-clear-all-memories" type="button">
          Borrar todos los recuerdos
        </button>
        <button class="agent-rec-quiet-btn" data-action="change-key" type="button">
          Conexión y API key ›
        </button>
      </div>

      <!-- Barra flotante de deshacer -->
      <div id="agent-undo-container" hidden></div>
    </div>
  `;

  document.body.appendChild(sheet);
  requestAnimationFrame(() => sheet.classList.add('open'));

  const close = ({ immediate = false } = {}) => {
    sheet.classList.remove('open');
    if (immediate) {
      sheet.remove();
    } else {
      sheet.addEventListener('transitionend', () => sheet.remove(), { once: true });
      setTimeout(() => {
        if (sheet.parentElement) sheet.remove();
      }, 260);
    }
  };

  sheet.querySelector('#agent-sheet-close').addEventListener('click', () => close());

  bindSheetDrag({
    sheet,
    panel: sheet.querySelector('.agent-sheet-inner'),
    backdrop: sheet,
    zones: [
      sheet.querySelector('.agent-sheet-drag'),
      sheet.querySelector('.agent-sheet-head'),
    ],
    onClose: () => close({ immediate: true }),
  });

  // Undo manager
  let pendingDeleteTimer = null;
  let pendingDeleteId = null;
  let pendingDeleteRow = null;

  function triggerUndo(id, row) {
    if (pendingDeleteTimer) {
      clearTimeout(pendingDeleteTimer);
      deleteMemory(pendingDeleteId);
      pendingDeleteRow?.remove();
    }

    pendingDeleteId = id;
    pendingDeleteRow = row;
    row.hidden = true;

    const undoBox = sheet.querySelector('#agent-undo-container');
    undoBox.hidden = false;
    undoBox.innerHTML = `
      <div class="agent-undo-bar">
        <span>Recuerdo borrado</span>
        <button type="button" class="agent-undo-btn" id="btn-undo-action">Deshacer</button>
      </div>
    `;

    undoBox.querySelector('#btn-undo-action').onclick = () => {
      clearTimeout(pendingDeleteTimer);
      row.hidden = false;
      undoBox.hidden = true;
      pendingDeleteId = null;
      pendingDeleteRow = null;
      toast('Recuerdo restaurado');
    };

    pendingDeleteTimer = setTimeout(async () => {
      await deleteMemory(id);
      row.remove();
      undoBox.hidden = true;
      pendingDeleteId = null;
      pendingDeleteRow = null;
      const count = sheet.querySelectorAll('#agent-card-rests .agent-rec-row').length;
      const badge = sheet.querySelector('#badge-rests-count');
      if (badge) badge.textContent = count;
      if (count === 0) {
        sheet.querySelector('#agent-card-rests').innerHTML = '<p class="empty-note">No hay notas ni descansos adicionales.</p>';
      }
    }, 4500);
  }

  sheet.addEventListener('click', async (e) => {
    if (e.target === sheet) close();

    // 1. Editar perfil (Nombre, Peso, Estatura, Creatina)
    const editProfBtn = e.target.closest('[data-action="edit-profile"]');
    if (editProfBtn) {
      const field = editProfBtn.dataset.field;
      const row = editProfBtn.closest('.agent-rec-row');
      const wrap = row.querySelector('.agent-rec-val-wrap');
      const valSpan = row.querySelector('.agent-rec-value');
      const currVal = profile[field] || '';

      wrap.hidden = true;
      const form = document.createElement('div');
      form.className = 'agent-rec-edit-form';
      form.innerHTML = `
        <input type="text" class="agent-rec-edit-input" value="${esc(currVal)}" autocomplete="off" spellcheck="false">
        <button type="button" class="agent-rec-edit-btn agent-rec-edit-save" title="Guardar">${icons.check({ size: 16 })}</button>
        <button type="button" class="agent-rec-edit-btn agent-rec-edit-cancel" title="Cancelar">${icons.close({ size: 16 })}</button>
      `;
      row.appendChild(form);
      const input = form.querySelector('input');
      input.focus();
      input.select();

      const finishEdit = async (save) => {
        if (save) {
          const newVal = input.value.trim();
          if (newVal) {
            profile[field] = newVal;
            await saveAthleteProfile({ [field]: newVal });
            valSpan.textContent = newVal;
            valSpan.classList.remove('is-empty');
            toast(`${field.charAt(0).toUpperCase() + field.slice(1)} actualizado`);
          }
        }
        form.remove();
        wrap.hidden = false;
      };

      form.querySelector('.agent-rec-edit-save').onclick = () => finishEdit(true);
      form.querySelector('.agent-rec-edit-cancel').onclick = () => finishEdit(false);
      input.onkeydown = (ev) => {
        if (ev.key === 'Enter') finishEdit(true);
        if (ev.key === 'Escape') finishEdit(false);
      };
      return;
    }

    // 2. Editar rutina semanal
    const editRoutBtn = e.target.closest('[data-action="edit-routine"]');
    if (editRoutBtn) {
      const idx = Number(editRoutBtn.dataset.index);
      const row = editRoutBtn.closest('.agent-rec-row');
      const textSpan = row.querySelector('.agent-rec-day-text');
      const currVal = routine[idx].grupo;

      editRoutBtn.hidden = true;
      textSpan.hidden = true;

      const form = document.createElement('div');
      form.className = 'agent-rec-edit-form';
      form.innerHTML = `
        <input type="text" class="agent-rec-edit-input" value="${esc(currVal)}" autocomplete="off" spellcheck="false" class="agent-rec-edit-input--short">
        <button type="button" class="agent-rec-edit-btn agent-rec-edit-save" title="Guardar">${icons.check({ size: 16 })}</button>
        <button type="button" class="agent-rec-edit-btn agent-rec-edit-cancel" title="Cancelar">${icons.close({ size: 16 })}</button>
      `;
      row.appendChild(form);
      const input = form.querySelector('input');
      input.focus();
      input.select();

      const finishRout = async (save) => {
        if (save) {
          const newVal = input.value.trim();
          routine[idx].grupo = newVal;
          await saveWeeklyRoutine(routine);
          textSpan.textContent = newVal || 'Descanso';
          textSpan.classList.toggle('is-empty', !newVal);
          toast(newVal ? 'Rutina actualizada' : 'Día marcado como descanso');
        }
        form.remove();
        textSpan.hidden = false;
        editRoutBtn.hidden = false;
      };

      form.querySelector('.agent-rec-edit-save').onclick = () => finishRout(true);
      form.querySelector('.agent-rec-edit-cancel').onclick = () => finishRout(false);
      input.onkeydown = (ev) => {
        if (ev.key === 'Enter') finishRout(true);
        if (ev.key === 'Escape') finishRout(false);
      };
      return;
    }

    // 3. Borrar recuerdo individual
    const delBtn = e.target.closest('[data-action="del-memory"]');
    if (delBtn) {
      const id = Number(delBtn.dataset.id);
      const row = delBtn.closest('.agent-rec-row');
      triggerUndo(id, row);
      return;
    }

    // 4. Ir a Historial
    if (e.target.closest('#btn-go-history')) {
      close();
      go('history');
      return;
    }

    // 5. Borrar todos los recuerdos
    if (e.target.closest('#btn-clear-all-memories')) {
      const ok = await askConfirm({
        title: 'Borrar todos los recuerdos',
        body: 'Se eliminarán las notas y descansos adicionales. Los entrenamientos en tu historial y tus datos personales no se tocan.',
        confirmLabel: 'Borrar todo',
        danger: true,
      });
      if (!ok) return;
      await clearAllMemories();
      const restsCard = sheet.querySelector('#agent-card-rests');
      if (restsCard) {
        restsCard.innerHTML = '<p class="empty-note">No hay notas ni descansos adicionales.</p>';
      }
      const badge = sheet.querySelector('#badge-rests-count');
      if (badge) badge.textContent = '0';
      toast('Recuerdos adicionales eliminados');
      return;
    }

    // 6. Conexión y API key
    if (e.target.closest('[data-action="change-key"]')) {
      close();
      showConnectionPanel(agent, { onChange });
      return;
    }
  });
}

/* --- Panel de Conexión y API Key --- */
export async function showConnectionPanel(agent, { onChange } = {}) {
  const config = await getAgentConfig();
  let selectedProvider = config.provider || 'gemini';
  let selectedModel = config.openaiModel || 'gpt-4o-mini-realtime-preview';
  const isOnline = !!(agent && agent.connected);

  const activeProviderName = agent?.provider === 'openai' ? 'OpenAI Realtime' : 'Gemini Live';
  const activeVoiceName = agent?.provider === 'openai' ? 'Coral' : 'Aoede';

  const sheet = document.createElement('div');
  sheet.className = 'agent-sheet';
  sheet.innerHTML = `
    <div class="agent-sheet-inner">
      <div class="agent-sheet-drag" aria-hidden="true"></div>

      <div class="agent-sheet-head">
        <div class="agent-sheet-head-titles">
          <h2>Conexión y API key</h2>
          <p>Configuración de voz en tiempo real con Gemini o OpenAI.</p>
        </div>
        <button class="agent-sheet-close" id="conn-sheet-close" type="button" aria-label="Cerrar">
          ${icons.close({ size: 22 })}
        </button>
      </div>

      <!-- Estado de conexión -->
      <section class="agent-rec-section">
        <div class="agent-rec-section-head">
          <h3 class="agent-rec-section-title">Estado del servicio</h3>
        </div>
        <div class="agent-rec-card conn-status${isOnline ? ' is-online' : ''}">
          <div class="conn-status-main">
            <span class="conn-status-dot" aria-hidden="true"></span>
            <div>
              <span class="conn-status-title">
                ${isOnline ? `Bía en línea (${activeProviderName})` : 'Desconectado'}
              </span>
              <span class="conn-status-sub">
                Voz activa: <b>${activeVoiceName}</b> · Bidireccional
              </span>
            </div>
          </div>
          <span class="conn-status-badge">
            ${isOnline ? 'EN LÍNEA' : 'OFFLINE'}
          </span>
        </div>
      </section>

      <!-- Selector de Proveedor -->
      <section class="agent-rec-section">
        <div class="agent-rec-section-head">
          <h3 class="agent-rec-section-title">Proveedor de Inteligencia Artificial</h3>
        </div>

        <div class="agent-provider-tabs agent-provider-tabs--spaced">
          <button type="button" class="agent-provider-tab ${selectedProvider === 'gemini' ? 'is-active' : ''}" data-provider="gemini">
            Google Gemini
          </button>
          <button type="button" class="agent-provider-tab ${selectedProvider === 'openai' ? 'is-active' : ''}" data-provider="openai">
            OpenAI Realtime
          </button>
        </div>

        <!-- Panel Google Gemini -->
        <div class="agent-rec-card conn-panel" id="conn-panel-gemini" ${selectedProvider === 'gemini' ? '' : 'hidden'}>
          <div>
            <span class="conn-panel-title">Gemini Live</span>
            <span class="conn-panel-sub">
              Voz: <b class="conn-voice">Aoede</b> (cálida, motivadora y clara) · Cuota gratuita
            </span>
          </div>

          <label class="conn-key-field">
            <span class="conn-key-label">API Key de Google AI Studio</span>
            <div class="conn-key-row">
              <input 
                id="conn-gemini-input" 
                type="password" 
                value="${esc(config.geminiKey || '')}" 
                placeholder="AIza..." 
                autocomplete="off" 
                spellcheck="false"
                class="agent-rec-edit-input conn-key-input"
              >
              <button type="button" class="btn btn-toggle-mask conn-key-toggle" data-target="conn-gemini-input" title="Ver/Ocultar clave">
                Ver
              </button>
            </div>
          </label>

          <a 
            href="https://aistudio.google.com/app/apikey" 
            target="_blank" 
            rel="noopener" 
            class="conn-key-link"
          >
            ${icons.bolt({ size: 14 })} Obtener o cambiar clave en Google AI Studio ›
          </a>
        </div>

        <!-- Panel OpenAI Realtime -->
        <div class="agent-rec-card conn-panel" id="conn-panel-openai" ${selectedProvider === 'openai' ? '' : 'hidden'}>
          <div>
            <span class="conn-panel-title">OpenAI Realtime</span>
            <span class="conn-panel-sub">
              Voz: <b class="conn-voice">Coral</b> (equivalente gemela de Aoede: cálida y segura)
            </span>
          </div>

          <p class="conn-key-label">Modelo:</p>
          <div class="agent-model-select">
            <button type="button" class="agent-model-btn ${selectedModel === 'gpt-4o-mini-realtime-preview' ? 'is-active' : ''}" data-model="gpt-4o-mini-realtime-preview">
              gpt-4o-mini (Económico)
            </button>
            <button type="button" class="agent-model-btn ${selectedModel === 'gpt-4o-realtime-preview' ? 'is-active' : ''}" data-model="gpt-4o-realtime-preview">
              gpt-4o (Ultra)
            </button>
          </div>

          <label class="conn-key-field">
            <span class="conn-key-label">API Key de OpenAI</span>
            <div class="conn-key-row">
              <input 
                id="conn-openai-input" 
                type="password" 
                value="${esc(config.openaiKey || '')}" 
                placeholder="sk-..." 
                autocomplete="off" 
                spellcheck="false"
                class="agent-rec-edit-input conn-key-input"
              >
              <button type="button" class="btn btn-toggle-mask conn-key-toggle" data-target="conn-openai-input" title="Ver/Ocultar clave">
                Ver
              </button>
            </div>
          </label>

          <a 
            href="https://platform.openai.com/api-keys" 
            target="_blank" 
            rel="noopener" 
            class="conn-key-link"
          >
            ${icons.bolt({ size: 14 })} Obtener o cambiar clave en OpenAI Platform ›
          </a>
        </div>
      </section>

      <!-- Botón guardar -->
      <button type="button" class="btn btn-primary btn-block conn-save" id="btn-save-conn-config">
        Guardar y activar proveedor
      </button>

      <!-- Desconectar -->
      <div class="conn-footer">
        <button class="agent-rec-danger-btn" id="btn-disconnect-key" type="button">
          Desconectar Bía
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(sheet);
  requestAnimationFrame(() => sheet.classList.add('open'));

  const close = ({ immediate = false } = {}) => {
    sheet.classList.remove('open');
    if (immediate) {
      sheet.remove();
    } else {
      sheet.addEventListener('transitionend', () => sheet.remove(), { once: true });
      setTimeout(() => { if (sheet.parentElement) sheet.remove(); }, 260);
    }
  };

  sheet.querySelector('#conn-sheet-close').addEventListener('click', () => close());
  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) close();
  });

  bindSheetDrag({
    sheet,
    panel: sheet.querySelector('.agent-sheet-inner'),
    backdrop: sheet,
    zones: [
      sheet.querySelector('.agent-sheet-drag'),
      sheet.querySelector('.agent-sheet-head'),
    ],
    onClose: () => close({ immediate: true }),
  });

  // Selector de tabs
  sheet.querySelectorAll('.agent-provider-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      selectedProvider = tab.dataset.provider;
      sheet.querySelectorAll('.agent-provider-tab').forEach((t) => t.classList.remove('is-active'));
      tab.classList.add('is-active');

      const isGemini = selectedProvider === 'gemini';
      sheet.querySelector('#conn-panel-gemini').hidden = !isGemini;
      sheet.querySelector('#conn-panel-openai').hidden = isGemini;
    });
  });

  // Selector de modelo OpenAI
  sheet.querySelectorAll('.agent-model-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedModel = btn.dataset.model;
      sheet.querySelectorAll('.agent-model-btn').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
    });
  });

  // Toggle mask de passwords
  sheet.querySelectorAll('.btn-toggle-mask').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetInput = sheet.querySelector(`#${btn.dataset.target}`);
      if (!targetInput) return;
      const isPass = targetInput.type === 'password';
      targetInput.type = isPass ? 'text' : 'password';
      btn.textContent = isPass ? 'Ocultar' : 'Ver';
    });
  });

  // Guardar configuración
  sheet.querySelector('#btn-save-conn-config').addEventListener('click', async () => {
    const isGemini = selectedProvider === 'gemini';
    const geminiVal = sheet.querySelector('#conn-gemini-input').value.trim();
    const openaiVal = sheet.querySelector('#conn-openai-input').value.trim();

    const activeKey = isGemini ? geminiVal : openaiVal;
    if (!activeKey || activeKey.length < 15) {
      toast(`Ingresa una clave válida para ${isGemini ? 'Google Gemini' : 'OpenAI'}.`);
      return;
    }

    await setAgentConfig({
      provider: selectedProvider,
      geminiKey: geminiVal,
      openaiKey: openaiVal,
      openaiModel: selectedModel,
    });

    toast(`Conectado a ${isGemini ? 'Google Gemini (Voz Aoede)' : 'OpenAI (Voz Coral)'}`);
    close();
    agent?.disconnect();
    await onChange?.();
  });

  // Desconectar
  sheet.querySelector('#btn-disconnect-key').addEventListener('click', async () => {
    const ok = await askConfirm({
      title: 'Desconectar Bía',
      body: 'Se desconectará el asistente de voz hasta que vuelvas a activar una clave.',
      confirmLabel: 'Desconectar',
      danger: true,
    });
    if (!ok) return;
    close();
    agent?.disconnect();
    if (selectedProvider === 'gemini') {
      await setAgentConfig({ geminiKey: '' });
    } else {
      await setAgentConfig({ openaiKey: '' });
    }
    await onChange?.();
  });
}
