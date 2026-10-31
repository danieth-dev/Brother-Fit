/**
 * agent view — Gemini 3.8 Live Interface for Brother Fit.
 * Real-time voice conversation with precision transcription + live voice playback + long-term memory.
 * Athletic Dark Chat with Interactive Action Cards & Prompt Chips.
 */

import {
  FitAgent, getActiveAgent, loadAllMemories, deleteMemory, visibleFitText,
  loadAthleteProfile, saveAthleteProfile, loadWeeklyRoutine, saveWeeklyRoutine, clearAllMemories
} from '../services/agent.js';
import { loadFitChat, appendFitChat, clearFitChat, formatChatForContext } from '../services/fit-chat.js';
import { getActiveWorkout, startWorkout, listExercises, listWorkoutSummaries, muscleName } from '../services/workouts.js';
import { state } from '../store.js';
import { db } from '../db.js';
import { icons } from '../utils/icons.js';
import { toast, esc, go } from '../utils/dom.js';
import { askConfirm } from '../utils/confirm-sheet.js';
import { bindSheetDrag } from '../utils/sheet-drag.js';

const API_KEY_STORE = 'geminiApiKey';

async function getApiKey() {
  const row = await db.get('meta', API_KEY_STORE);
  return row?.value ?? '';
}

async function setApiKey(key) {
  await db.put('meta', { key: API_KEY_STORE, value: key });
}

export async function render(el) {
  const apiKey = await getApiKey();

  if (!apiKey) {
    renderKeyPrompt(el);
    return;
  }

  await renderLiveChat(el, apiKey);
}

/* --- API Key entry screen --- */
function renderKeyPrompt(el) {
  el.innerHTML = `
    <header class="page-head">
      <h1>Fit AI · Gemini Live</h1>
      <p>Compañera técnica por voz. Puedes llamarla Fit o Bía.</p>
    </header>

    <div class="agent-key-card">
      <p class="agent-key-desc">
        Tu cuaderno de entrenamientos, series y marcas quedan <b>100% en tu teléfono</b> de forma local. 
        Al activar la voz, tu audio se transmite a Google (Gemini Live) para el diálogo bidireccional. 
        Tu clave se guarda exclusivamente en tu dispositivo.
      </p>
      <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener" class="btn btn-block" id="btn-get-key">
        ${icons.bolt({ size: 18 })} Obtener clave gratis en Google AI Studio
      </a>
      <div class="field" style="margin-top:16px">
        <label class="field">
          <span>API Key de Gemini (AIza...)</span>
          <input id="agent-key-input" type="password" placeholder="AIza..." autocomplete="off" spellcheck="false">
        </label>
      </div>
      <button class="btn btn-primary btn-block" id="btn-save-key" type="button" style="margin-top:12px">
        Guardar y conectar en vivo
      </button>
    </div>
  `;

  el.querySelector('#btn-save-key').addEventListener('click', async () => {
    const val = el.querySelector('#agent-key-input').value.trim();
    if (!val || val.length < 15) {
      toast('Pega una API key valida de Google AI Studio.');
      return;
    }
    await setApiKey(val);
    await renderLiveChat(el, val);
  });
}

/* --- Live Chat Interface --- */
async function renderLiveChat(el, apiKey) {
  let agent = getActiveAgent();
  const isExisting = !!(agent && agent.connected);
  if (!agent) {
    agent = new FitAgent(apiKey);
  }

  const allExercises = await listExercises();
  const history = await loadFitChat();
  const hadHistory = history.length > 0;
  let currentBotText = '';
  let botBubble = null;

  el.innerHTML = `
    <div class="agent-view">
      <header class="page-head agent-chat-head">
        <div class="agent-chat-head-left">
          <button class="agent-back-btn" id="btn-agent-back" aria-label="Volver a Entreno" type="button">
            ${icons.arrowLeft({ size: 26 })}
          </button>
          <div class="agent-chat-head-title">
            <h1>Fit</h1>
            <p class="agent-chat-status" id="agent-status" data-ok="${isExisting ? '1' : '0'}">
              <span class="agent-chat-status-dot" aria-hidden="true"></span>
              <span id="agent-status-text">${isExisting ? 'En línea' : 'Conectando con Gemini Live...'}</span>
            </p>
          </div>
        </div>
        <div class="agent-chat-head-actions">
          <button class="agent-head-btn" data-action="new-chat" type="button" aria-label="Nuevo chat" id="btn-new-chat" title="Nuevo chat">
            ${icons.chat({ size: 22 })}
          </button>
          <button class="agent-head-btn" data-action="memories" type="button" aria-label="Acciones rápidas / Recuerdos" id="btn-memories" title="Acciones y recuerdos">
            ${icons.bolt({ size: 22 })}
          </button>
        </div>
      </header>

      <div class="agent-msgs" id="agent-msgs" aria-live="polite" aria-label="Conversación">
        <span class="agent-date-badge">Hoy</span>
      </div>

      <div class="agent-dock" id="agent-dock">
        <div class="agent-chips-wrap">
          <div class="agent-chips-scroll">
            <button type="button" class="agent-chip" data-prompt="Registrar mi peso">Registrar mi peso</button>
            <button type="button" class="agent-chip" data-prompt="¿Qué hice ayer?">¿Qué hice ayer?</button>
            <button type="button" class="agent-chip" data-prompt="Ver mi progreso">Ver mi progreso</button>
            <button type="button" class="agent-chip" data-prompt="¿Qué rutina me toca hoy?">¿Qué rutina me toca?</button>
          </div>
          <div class="agent-chips-fade" aria-hidden="true"></div>
        </div>

        <div class="agent-input-row">
          <input id="agent-input" class="agent-input-pill" type="text" placeholder="Escribe a Fit…" autocomplete="off" aria-label="Escribe a Fit" disabled>
          <button class="agent-action-btn" id="btn-action-trigger" type="button" aria-label="Hablar con Fit" disabled>
            ${icons.waveform({ size: 24 })}
          </button>
        </div>
      </div>
    </div>
  `;

  const msgsEl = el.querySelector('#agent-msgs');
  const statusEl = el.querySelector('#agent-status');
  const statusTextEl = el.querySelector('#agent-status-text');
  const inputEl = el.querySelector('#agent-input');
  const actionBtn = el.querySelector('#btn-action-trigger');
  const memoriesBtn = el.querySelector('#btn-memories');
  const newChatBtn = el.querySelector('#btn-new-chat');
  const backBtn = el.querySelector('#btn-agent-back');

  function setStatus(text, ok = true) {
    statusTextEl.textContent = text;
    statusEl.dataset.ok = ok ? '1' : '0';
  }

  function updateActionButton() {
    const hasText = inputEl.value.trim().length > 0;
    if (hasText) {
      actionBtn.classList.remove('active-live');
      actionBtn.classList.add('is-send');
      actionBtn.innerHTML = icons.send({ size: 22 });
      actionBtn.setAttribute('aria-label', 'Enviar mensaje');
    } else {
      actionBtn.classList.remove('is-send');
      if (agent.isLiveMode) {
        actionBtn.classList.add('active-live');
        actionBtn.innerHTML = icons.mic({ size: 22 });
        actionBtn.setAttribute('aria-label', 'Detener voz en vivo');
      } else {
        actionBtn.classList.remove('active-live');
        actionBtn.innerHTML = icons.waveform({ size: 24 });
        actionBtn.setAttribute('aria-label', 'Hablar con Fit');
      }
    }
  }

  function appendMsg(role, text, id) {
    const div = document.createElement('div');
    div.className = `agent-bubble agent-bubble-${role}`;
    if (id) div.id = id;
    div.textContent = text;
    msgsEl.appendChild(div);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    return div;
  }

  function paintHistory(list) {
    msgsEl.replaceChildren();
    const dateBadge = document.createElement('span');
    dateBadge.className = 'agent-date-badge';
    dateBadge.textContent = 'Hoy';
    msgsEl.appendChild(dateBadge);

    if (!list || list.length === 0) return;
    for (const m of list) {
      appendMsg(m.role, m.text);
    }
  }

  async function persist(role, text) {
    const t = String(text || '').trim();
    if (!t) return;
    await appendFitChat(role, t);
  }

  function enableControls(on) {
    inputEl.disabled = !on;
    actionBtn.disabled = !on;
  }

  function renderExerciseActionCard(ex) {
    if (!ex) return;
    const gName = muscleName(ex.grupo) || ex.grupo || 'General';
    const card = document.createElement('div');
    card.className = 'agent-card-exercise';
    card.innerHTML = `
      <div>
        <p class="agent-card-exercise-head">
          <span class="agent-card-exercise-dot muscle-dot" data-g="${esc(gName)}"></span>
          ${esc(ex.nombre)}
        </p>
        <p class="agent-card-exercise-sub">${esc(gName)} · listo para la serie 1</p>
      </div>
      <button class="agent-card-exercise-btn" data-action="go-exercise" data-exercise-id="${ex.id}" type="button">
        Registrar serie 1
      </button>
    `;
    msgsEl.appendChild(card);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function sendText() {
    const text = inputEl.value.trim();
    if (!text || !agent.connected) return;
    inputEl.value = '';
    updateActionButton();
    currentBotText = '';
    botBubble = null;
    try {
      agent.sendText(text);
    } catch (e) {
      toast('Error al enviar: ' + e.message);
    }
  }

  paintHistory(history);

  /* Eventos del agente */
  agent
    .on('ready', () => {
      setStatus('En línea', true);
      enableControls(true);
      if (hadHistory) {
        agent.seedPriorChat(formatChatForContext(history));
      } else {
        appendMsg('bot', 'Hola, estoy en línea. Escríbeme o pulsa el audio para hablar.');
      }
    })
    .on('user_message', (text) => {
      appendMsg('user', text);
      persist('user', text);
      currentBotText = '';
      botBubble = null;
    })
    .on('effort_saved', (res) => {
      const line = String(res?.mensaje || '').includes('sin esfuerzo') ? 'Quedó sin esfuerzo.' : 'Anotado.';
      appendMsg('bot', line);
      persist('bot', line);
      currentBotText = '';
      botBubble = null;
    })
    .on('live_mode_started', () => {
      updateActionButton();
      setStatus('Escuchando...', true);
    })
    .on('live_mode_stopped', () => {
      updateActionButton();
      setStatus('En línea', true);
    })
    .on('listening', () => {
      if (agent.isLiveMode) {
        setStatus('Escuchando...', true);
      }
    })
    .on('interim_speech', (text) => {
      if (agent.isLiveMode) {
        const said = String(text || '').trim();
        setStatus(said ? `"${said}"` : 'Escuchando...', true);
      }
    })
    .on('speaking_start', () => {
      if (agent.isLiveMode) {
        setStatus('Fit habla...', true);
      }
    })
    .on('speaking_end', () => {
      if (agent.isLiveMode) {
        setStatus('Escuchando...', true);
      }
    })
    .on('transcript_chunk', (chunk) => {
      currentBotText += chunk;
      const shown = visibleFitText(currentBotText);
      if (!shown) {
        botBubble?.remove();
        botBubble = null;
        return;
      }
      if (!botBubble) {
        botBubble = appendMsg('bot', shown, 'agent-bot-live');
      } else {
        botBubble.textContent = shown;
        msgsEl.scrollTop = msgsEl.scrollHeight;
      }
    })
    .on('turn_complete', () => {
      const shown = visibleFitText(currentBotText);
      if (shown) {
        persist('bot', shown);
      }
      botBubble = null;
      currentBotText = '';
    })
    .on('exercise_selected', (exercise) => {
      renderExerciseActionCard(exercise);
    })
    .on('memory_updated', (toolName, args, result) => {
      if (toolName === 'guardar_recuerdo') {
        const card = document.createElement('div');
        card.className = 'agent-card-memory';
        if (result?.id) card.id = `mem-card-${result.id}`;
        card.innerHTML = `
          <div class="agent-card-memory-icon">${icons.check({ size: 18, stroke: '#10B981' })}</div>
          <div class="agent-card-memory-body">
            <span class="agent-card-memory-tag">Guardado en recuerdos</span>
            <span class="agent-card-memory-text">${esc(args?.contenido || 'Preferencia guardada')}</span>
          </div>
          ${result?.id ? `<button class="agent-card-memory-undo" data-id="${result.id}" type="button">Deshacer</button>` : ''}
        `;
        msgsEl.appendChild(card);
        msgsEl.scrollTop = msgsEl.scrollHeight;
      }
    })
    .on('error', (err) => {
      setStatus('Error de conexión', false);
      toast(err.message);
    })
    .on('mic_paused', (message) => {
      toast(message);
    })
    .on('disconnected', () => {
      setStatus('Desconectado', false);
      enableControls(false);
    });

  /* Disparador de Acción (Enviar texto o Conmutar Voz en vivo) */
  actionBtn.addEventListener('click', async () => {
    const text = inputEl.value.trim();
    if (text) {
      sendText();
    } else {
      if (!agent.isLiveMode) {
        try {
          await agent.startLiveMode();
        } catch (e) {
          toast('Acceso al micrófono: ' + e.message);
        }
      } else {
        agent.stopLiveMode();
      }
    }
  });

  inputEl.addEventListener('input', updateActionButton);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendText();
    }
  });

  /* Sugerencias Rápidas (Chips) */
  el.querySelectorAll('.agent-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prompt = btn.dataset.prompt;
      if (prompt && agent.connected) {
        inputEl.value = prompt;
        sendText();
      }
    });
  });

  /* Interacción con tarjetas dentro del chat */
  msgsEl.addEventListener('click', async (e) => {
    const undoBtn = e.target.closest('.agent-card-memory-undo');
    if (undoBtn) {
      const id = Number(undoBtn.dataset.id);
      if (id) {
        await deleteMemory(id);
        const card = undoBtn.closest('.agent-card-memory');
        if (card) {
          card.style.opacity = '0.4';
          undoBtn.textContent = 'Deshecho';
          undoBtn.disabled = true;
          setTimeout(() => card.remove(), 1200);
        }
        toast('Recuerdo eliminado');
      }
      return;
    }

    const exBtn = e.target.closest('[data-action="go-exercise"]');
    if (exBtn) {
      const exId = Number(exBtn.dataset.exerciseId);
      let activeW = await getActiveWorkout();
      if (!activeW) {
        activeW = await startWorkout();
      }
      state.selectedExerciseId = exId;
      go('workout');
      return;
    }
  });

  /* Botón volver */
  backBtn.addEventListener('click', () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      go('workout');
    }
  });

  /* Recuerdos */
  memoriesBtn.addEventListener('click', () => {
    showMemoriesPanel(el, agent);
  });

  /* Nuevo Chat */
  newChatBtn.addEventListener('click', async () => {
    const ok = await askConfirm({
      title: 'Nuevo chat',
      body: 'Se borrará la conversación actual. Los recuerdos se quedan.',
      confirmLabel: 'Empezar de nuevo',
    });
    if (!ok) return;
    agent.disconnect();
    await clearFitChat();
    await renderLiveChat(el, apiKey);
  });

  if (!el._changeKeyBound) {
    el._changeKeyBound = true;
    el.addEventListener('click', async (e) => {
      if (!e.target.closest('[data-action="change-key"]')) return;
      const ok = await askConfirm({
        title: 'Cambiar API key',
        body: 'Se desconecta Fit hasta que pegues otra clave.',
        confirmLabel: 'Cambiar',
        danger: false,
      });
      if (!ok) return;
      getActiveAgent()?.disconnect();
      await db.put('meta', { key: API_KEY_STORE, value: '' });
      await render(el);
    });
  }

  if (isExisting) {
    setStatus('En línea', true);
    enableControls(true);
    if (agent.isLiveMode) {
      updateActionButton();
      setStatus('Escuchando...', true);
    }
  } else {
    agent.connect().catch((err) => {
      setStatus('Fallo al conectar', false);
      toast('No se pudo conectar a Gemini 3.8 Live: ' + err.message);
    });
  }
}

/* --- Drawer de Recuerdos (Nuevo diseño agrupado) --- */
async function showMemoriesPanel(parentEl, agent) {
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
          <p>Lo que Fit recuerda de ti entre conversaciones. Edítalo o bórralo cuando quieras.</p>
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
              <span class="agent-rec-value" id="val-nombre">${esc(profile.nombre || 'Daniel')}</span>
              <button class="agent-rec-icon-btn" data-action="edit-profile" data-field="nombre" type="button" aria-label="Editar Nombre">
                ${icons.pencil({ size: 18 })}
              </button>
            </div>
          </div>
          <div class="agent-rec-row" data-field="peso">
            <span class="agent-rec-label">Peso</span>
            <div class="agent-rec-val-wrap">
              <span class="agent-rec-value" id="val-peso">${esc(profile.peso || '49 kg')}</span>
              <button class="agent-rec-icon-btn" data-action="edit-profile" data-field="peso" type="button" aria-label="Editar Peso">
                ${icons.pencil({ size: 18 })}
              </button>
            </div>
          </div>
          <div class="agent-rec-row" data-field="estatura">
            <span class="agent-rec-label">Estatura</span>
            <div class="agent-rec-val-wrap">
              <span class="agent-rec-value" id="val-estatura">${esc(profile.estatura || '1,63 m')}</span>
              <button class="agent-rec-icon-btn" data-action="edit-profile" data-field="estatura" type="button" aria-label="Editar Estatura">
                ${icons.pencil({ size: 18 })}
              </button>
            </div>
          </div>
          <div class="agent-rec-row" data-field="creatina">
            <span class="agent-rec-label">Creatina</span>
            <div class="agent-rec-val-wrap">
              <span class="agent-rec-value" id="val-creatina">${esc(profile.creatina || '5 g al día')}</span>
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
              <div style="display:flex;align-items:center;gap:12px">
                <span class="agent-rec-day">${esc(r.dia)}</span>
                <span class="agent-rec-day-dot" style="background:${r.dot || '#FFD166'}"></span>
                <span class="agent-rec-day-text" id="val-routine-${i}">${esc(r.grupo)}</span>
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
                  <span style="display:block;font-size:16px;font-weight:600;color:#F5F5F5">${esc(m.contenido)}</span>
                  <span style="display:block;font-size:13px;color:#A8A8A8;margin-top:2px">Nota de memoria</span>
                </div>
                <button class="agent-rec-icon-btn is-trash" data-action="del-memory" data-id="${m.id}" type="button" aria-label="Borrar">
                  ${icons.trash({ size: 18 })}
                </button>
              </div>
            `
                  )
                  .join('')
              : '<p style="padding:18px;text-align:center;color:#8A8A8A;margin:0;font-size:14px">No hay notas ni descansos adicionales.</p>'
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
            <span class="agent-rec-workout-sub">Ya están en tu Historial. Fit puede consultarlas.</span>
          </div>
          ${icons.chevronRight({ size: 20, stroke: '#8A8A8A' })}
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
      <div id="agent-undo-container" style="display:none"></div>
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
    row.style.display = 'none';

    const undoBox = sheet.querySelector('#agent-undo-container');
    undoBox.style.display = 'block';
    undoBox.innerHTML = `
      <div class="agent-undo-bar">
        <span>Recuerdo borrado</span>
        <button type="button" class="agent-undo-btn" id="btn-undo-action">Deshacer</button>
      </div>
    `;

    undoBox.querySelector('#btn-undo-action').onclick = () => {
      clearTimeout(pendingDeleteTimer);
      row.style.display = '';
      undoBox.style.display = 'none';
      pendingDeleteId = null;
      pendingDeleteRow = null;
      toast('Recuerdo restaurado');
    };

    pendingDeleteTimer = setTimeout(async () => {
      await deleteMemory(id);
      row.remove();
      undoBox.style.display = 'none';
      pendingDeleteId = null;
      pendingDeleteRow = null;
      const count = sheet.querySelectorAll('#agent-card-rests .agent-rec-row').length;
      const badge = sheet.querySelector('#badge-rests-count');
      if (badge) badge.textContent = count;
      if (count === 0) {
        sheet.querySelector('#agent-card-rests').innerHTML = '<p style="padding:18px;text-align:center;color:#8A8A8A;margin:0;font-size:14px">No hay notas ni descansos adicionales.</p>';
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
      const currVal = profile[field] || valSpan.textContent.trim();

      wrap.style.display = 'none';
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
            toast(`${field.charAt(0).toUpperCase() + field.slice(1)} actualizado`);
          }
        }
        form.remove();
        wrap.style.display = 'flex';
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

      editRoutBtn.style.display = 'none';
      textSpan.style.display = 'none';

      const form = document.createElement('div');
      form.className = 'agent-rec-edit-form';
      form.innerHTML = `
        <input type="text" class="agent-rec-edit-input" value="${esc(currVal)}" autocomplete="off" spellcheck="false" style="max-width:170px">
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
          if (newVal) {
            routine[idx].grupo = newVal;
            await saveWeeklyRoutine(routine);
            textSpan.textContent = newVal;
            toast('Rutina actualizada');
          }
        }
        form.remove();
        textSpan.style.display = '';
        editRoutBtn.style.display = '';
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
        restsCard.innerHTML = '<p style="padding:18px;text-align:center;color:#8A8A8A;margin:0;font-size:14px">No hay notas ni descansos adicionales.</p>';
      }
      const badge = sheet.querySelector('#badge-rests-count');
      if (badge) badge.textContent = '0';
      toast('Recuerdos adicionales eliminados');
      return;
    }

    // 6. Cambiar API key
    if (e.target.closest('[data-action="change-key"]')) {
      close();
      parentEl.dispatchEvent(new MouseEvent('click', { bubbles: true, target: e.target }));
      return;
    }
  });
}
