/**
 * agent view — Gemini 3.8 Live Interface for Brother Fit.
 * Real-time voice conversation with precision transcription + live voice playback + long-term memory.
 * Athletic Dark Chat with Interactive Action Cards & Prompt Chips.
 */

import { FitAgent, getActiveAgent, loadAllMemories, deleteMemory, visibleFitText } from '../services/agent.js';
import { loadFitChat, appendFitChat, clearFitChat, formatChatForContext } from '../services/fit-chat.js';
import { getActiveWorkout, startWorkout, listExercises, muscleName } from '../services/workouts.js';
import { state } from '../store.js';
import { db } from '../db.js';
import { icons } from '../utils/icons.js';
import { toast, esc, go } from '../utils/dom.js';
import { askConfirm } from '../utils/confirm-sheet.js';

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
  let renderedExerciseCard = null;

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

  function checkExerciseInText(text) {
    if (!text) return null;
    const lower = text.toLowerCase();
    for (const ex of allExercises) {
      const nameLower = ex.nombre.toLowerCase();
      if (nameLower.length >= 4 && lower.includes(nameLower)) {
        return ex;
      }
    }
    return null;
  }

  function maybeAppendExerciseCard(text) {
    if (renderedExerciseCard) return;
    const ex = checkExerciseInText(text);
    if (!ex) return;
    renderedExerciseCard = ex.id;
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
    renderedExerciseCard = null;
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
      renderedExerciseCard = null;
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
        maybeAppendExerciseCard(shown);
      }
      botBubble = null;
      currentBotText = '';
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

/* --- Drawer de Recuerdos --- */
async function showMemoriesPanel(parentEl, agent) {
  const memories = await loadAllMemories();

  const sheet = document.createElement('div');
  sheet.className = 'agent-sheet';
  sheet.innerHTML = `
    <div class="agent-sheet-inner">
      <header class="agent-sheet-head">
        <h2>Recuerdos guardados</h2>
        <button class="agent-sheet-close" id="agent-sheet-close" type="button" aria-label="Cerrar">${icons.close({ size: 20 })}</button>
      </header>
      <p class="agent-sheet-desc">
        Fit recuerda estos datos sobre ti entre sesiones con <b>gemini-3.8-live</b>. Puedes borrarlos cuando quieras.
      </p>
      <div class="agent-mem-list" id="agent-mem-list">
        ${
          memories.length > 0
            ? memories
                .map(
                  (m) => `
              <div class="agent-mem-item" data-id="${m.id}">
                <span>${esc(m.contenido)}</span>
                <button class="agent-mem-del" data-id="${m.id}" type="button" aria-label="Borrar recuerdo">${icons.trash({ size: 16 })}</button>
              </div>`
                )
                .join('')
            : '<p class="agent-mem-empty">Todavía no hay recuerdos guardados.</p>'
        }
      </div>
      <button class="btn btn-block" data-action="change-key" type="button" style="margin-top:24px;border-color:var(--red);color:var(--red)">
        Cambiar API key
      </button>
    </div>
  `;

  document.body.appendChild(sheet);
  requestAnimationFrame(() => sheet.classList.add('open'));

  const close = () => {
    sheet.classList.remove('open');
    sheet.addEventListener('transitionend', () => sheet.remove(), { once: true });
  };

  sheet.querySelector('#agent-sheet-close').addEventListener('click', close);
  sheet.addEventListener('click', async (e) => {
    if (e.target === sheet) close();

    const delBtn = e.target.closest('.agent-mem-del');
    if (delBtn) {
      const id = Number(delBtn.dataset.id);
      const ok = await askConfirm({
        title: 'Borrar recuerdo',
        body: 'Fit deja de usar este dato en las próximas sesiones.',
      });
      if (!ok) return;
      await deleteMemory(id);
      delBtn.closest('.agent-mem-item')?.remove();
      const list = sheet.querySelector('#agent-mem-list');
      if (!list.querySelector('.agent-mem-item')) {
        list.innerHTML = '<p class="agent-mem-empty">Todavia no hay recuerdos guardados.</p>';
      }
      toast('Recuerdo eliminado');
      return;
    }

    if (e.target.closest('[data-action="change-key"]')) {
      close();
      parentEl.dispatchEvent(new MouseEvent('click', { bubbles: true, target: e.target }));
    }
  });
}
