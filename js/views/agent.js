/**
 * agent view — Gemini 3.8 Live Interface for Brother Fit.
 * Real-time voice conversation with precision transcription + live voice playback + long-term memory.
 */

import { FitAgent, getActiveAgent, loadAllMemories, deleteMemory } from '../services/agent.js';
import { state } from '../store.js';
import { db } from '../db.js';
import { icons } from '../utils/icons.js';
import { toast, esc } from '../utils/dom.js';

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

  renderLiveChat(el, apiKey);
}

/* --- API Key entry screen --- */
function renderKeyPrompt(el) {
  el.innerHTML = `
    <header class="page-head">
      <h1>Gemini 3.8 Live</h1>
      <p>Conecta tu API key para activar la conversacion en voz en tiempo real</p>
    </header>

    <div class="agent-key-card">
      <p class="agent-key-desc">
        Fit utiliza el modelo <b>gemini-3.8-live</b> para dialogo bidireccional fluido con voz y memoria a largo plazo. 
        Tu clave se guarda exclusivamente en tu dispositivo.
      </p>
      <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener" class="btn btn-block" id="btn-get-key">
        ${icons.bolt({ size: 18 })} Obtener clave gratis en AI Studio
      </a>
      <div class="field" style="margin-top:16px">
        <label class="field">
          <span>API Key de Gemini (AQ... o AIza...)</span>
          <input id="agent-key-input" type="password" placeholder="AQ... o AIza..." autocomplete="off" spellcheck="false">
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
    renderLiveChat(el, val);
  });
}

/* --- Live Chat Interface --- */
function renderLiveChat(el, apiKey) {
  let agent = getActiveAgent();
  const isExisting = agent && agent.connected;
  if (!agent) {
    agent = new FitAgent(apiKey);
  }
  let currentBotText = '';
  let botBubble = null;

  el.innerHTML = `
    <header class="page-head agent-chat-head">
      <div>
        <h1>Fit <span class="chip chip-accent" style="font-size:10px;vertical-align:middle;margin-left:6px">3.8 LIVE</span></h1>
        <p id="agent-status">Conectando con Gemini 3.8 Live...</p>
      </div>
      <button class="agent-head-btn" data-action="memories" type="button" aria-label="Ver recuerdos" id="btn-memories">
        ${icons.bolt({ size: 20 })}
      </button>
    </header>

    <!-- BANNER DE VOZ EN TIEMPO REAL -->
    <div class="agent-live-banner" id="agent-live-banner">
      <div class="agent-live-pulse" id="agent-live-pulse">
        ${icons.mic({ size: 28 })}
      </div>
      <div class="agent-live-info">
        <strong id="agent-live-title">Hablar en tiempo real</strong>
        <span id="agent-live-desc">Toca "Iniciar" para hablar directamente por voz con Fit</span>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <button class="btn btn-primary btn-sm" id="btn-toggle-live" type="button">
          Iniciar
        </button>
      </div>
    </div>

    <div class="agent-msgs" id="agent-msgs" aria-live="polite" aria-label="Conversacion"></div>

    <div class="agent-bar" id="agent-bar">
      <div class="agent-input-wrap">
        <textarea id="agent-input" class="agent-input" placeholder="O escribe un mensaje..." rows="1"
          disabled aria-label="Mensaje de texto"></textarea>
      </div>
      <button class="agent-send" id="agent-send" type="button" aria-label="Enviar mensaje" disabled>
        ${icons.chevronRight({ size: 22 })}
      </button>
    </div>
  `;

  const msgsEl = el.querySelector('#agent-msgs');
  const statusEl = el.querySelector('#agent-status');
  const inputEl = el.querySelector('#agent-input');
  const sendBtn = el.querySelector('#agent-send');
  const liveBanner = el.querySelector('#agent-live-banner');
  const toggleLiveBtn = el.querySelector('#btn-toggle-live');
  const liveTitle = el.querySelector('#agent-live-title');
  const liveDesc = el.querySelector('#agent-live-desc');
  const memoriesBtn = el.querySelector('#btn-memories');

  function setStatus(text, ok = true) {
    statusEl.textContent = text;
    statusEl.dataset.ok = ok ? '1' : '0';
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

  function enableControls(on) {
    inputEl.disabled = !on;
    sendBtn.disabled = !on;
    toggleLiveBtn.disabled = !on;
  }

  function sendText() {
    const text = inputEl.value.trim();
    if (!text || !agent.connected) return;
    inputEl.value = '';
    autoResize();
    currentBotText = '';
    botBubble = null;
    try {
      agent.sendText(text);
    } catch (e) {
      toast('Error al enviar: ' + e.message);
    }
  }

  function autoResize() {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + 'px';
  }

  /* Eventos del agente */
  agent
    .on('ready', () => {
      setStatus('Conectado a Gemini 3.8 Live', true);
      enableControls(true);
      appendMsg('bot', 'Hola, estoy en línea. Toca "Iniciar" para hablarme por voz o escríbeme.');
    })
    .on('user_message', (text) => {
      appendMsg('user', text);
      currentBotText = '';
      botBubble = null;
    })
    .on('live_mode_started', () => {
      liveBanner.classList.add('active');
      toggleLiveBtn.textContent = 'Detener';
      toggleLiveBtn.className = 'btn btn-danger btn-sm';
      liveTitle.textContent = 'Fit te esta escuchando...';
      liveDesc.textContent = 'Hablale claro. Veras lo que dices en pantalla.';
    })
    .on('live_mode_stopped', () => {
      liveBanner.classList.remove('active');
      liveBanner.classList.remove('speaking');
      toggleLiveBtn.textContent = 'Iniciar';
      toggleLiveBtn.className = 'btn btn-primary btn-sm';
      liveTitle.textContent = 'Hablar en tiempo real';
      liveDesc.textContent = 'Toca "Iniciar" para hablar directamente por voz con Fit';
    })
    .on('listening', () => {
      if (agent.isLiveMode) {
        liveTitle.textContent = 'Te estoy escuchando...';
        liveDesc.textContent = 'Hablale a Fit normalmente.';
      }
    })
    .on('interim_speech', (text) => {
      if (agent.isLiveMode) {
        liveTitle.textContent = 'Escuchando: "' + text.slice(-40) + '"';
      }
    })
    .on('speaking_start', () => {
      liveBanner.classList.add('speaking');
      liveTitle.textContent = 'Fit te esta respondiendo...';
      liveDesc.textContent = 'Escuchando la voz en directo...';
    })
    .on('speaking_end', () => {
      liveBanner.classList.remove('speaking');
      if (agent.isLiveMode) {
        liveTitle.textContent = 'Fit te esta escuchando...';
        liveDesc.textContent = 'Puedes responderle cuando quieras.';
      }
    })
    .on('transcript_chunk', (chunk) => {
      currentBotText += chunk;
      if (!botBubble) {
        botBubble = appendMsg('bot', currentBotText, 'agent-bot-live');
      } else {
        botBubble.textContent = currentBotText;
        msgsEl.scrollTop = msgsEl.scrollHeight;
      }
    })
    .on('turn_complete', () => {
      botBubble = null;
      currentBotText = '';
    })
    .on('memory_updated', (toolName) => {
      if (toolName === 'guardar_recuerdo') {
        const note = document.createElement('div');
        note.className = 'agent-memory-note';
        note.textContent = 'Nuevo recuerdo guardado en memoria';
        msgsEl.appendChild(note);
        msgsEl.scrollTop = msgsEl.scrollHeight;
        setTimeout(() => note.remove(), 4000);
      }
    })
    .on('error', (err) => {
      setStatus('Error de conexion', false);
      toast(err.message);
    })
    .on('disconnected', () => {
      setStatus('Desconectado', false);
      enableControls(false);
    });

  /* Boton Iniciar/Detener Live Mode */
  toggleLiveBtn.addEventListener('click', async () => {
    if (!agent.isLiveMode) {
      try {
        await agent.startLiveMode();
      } catch (e) {
        toast('Acceso al microfono: ' + e.message);
      }
    } else {
      agent.stopLiveMode();
    }
  });

  /* Enviar texto */
  sendBtn.addEventListener('click', sendText);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendText();
    }
  });
  inputEl.addEventListener('input', autoResize);

  /* Panel de recuerdos */
  memoriesBtn.addEventListener('click', () => {
    showMemoriesPanel(el, agent);
  });

  /* Cambiar API Key */
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="change-key"]')) {
      if (!confirm('Deseas cambiar tu API Key de Gemini?')) return;
      agent.disconnect();
      db.put('meta', { key: API_KEY_STORE, value: '' });
      render(el);
    }
  });

  /* Conectar solo si no estaba ya conectado */
  if (isExisting) {
    setStatus('En línea · Conectado', true);
    enableControls(true);
    if (agent.isLiveMode) {
      liveBanner.classList.add('active');
      toggleLiveBtn.textContent = 'Detener';
      toggleLiveBtn.className = 'btn btn-danger btn-sm';
      liveTitle.textContent = 'Fit te está escuchando...';
      liveDesc.textContent = 'Habla claro. El micro está abierto.';
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
        Fit recuerda estos datos sobre vos entre sesiones con <b>gemini-3.8-live</b>. Podes borrarlos cuando quieras.
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
            : '<p class="agent-mem-empty">Todavia no hay recuerdos guardados.</p>'
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
  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) close();

    const delBtn = e.target.closest('.agent-mem-del');
    if (delBtn) {
      const id = Number(delBtn.dataset.id);
      deleteMemory(id).then(() => {
        delBtn.closest('.agent-mem-item')?.remove();
        const list = sheet.querySelector('#agent-mem-list');
        if (!list.querySelector('.agent-mem-item')) {
          list.innerHTML = '<p class="agent-mem-empty">Todavia no hay recuerdos guardados.</p>';
        }
        toast('Recuerdo eliminado');
      });
    }

    if (e.target.closest('[data-action="change-key"]')) {
      close();
      parentEl.dispatchEvent(new MouseEvent('click', { bubbles: true, target: e.target }));
    }
  });
}
