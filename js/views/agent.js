/**
 * agent view — Gemini 3.8 Live Interface for Bía.
 * Real-time voice conversation with precision transcription + live voice playback + long-term memory.
 * Athletic Dark Chat with Interactive Action Cards & Prompt Chips.
 */

import { FitAgent, getActiveAgent } from '../voice/fit-agent.js';
import { visibleFitText } from '../services/bia/text.js';
import { getAgentConfig, setAgentConfig } from '../services/bia/config.js';
import { deleteMemory } from '../services/bia/memory.js';
import { loadFitChat, appendFitChat, clearFitChat, formatChatForContext } from '../services/fit-chat.js';
import { getActiveWorkout, startWorkout, listExercises, muscleName } from '../services/workouts.js';
import { state } from '../store.js';
import { icons } from '../utils/icons.js';
import { toast, esc, go } from '../utils/dom.js';
import { askConfirm } from '../utils/confirm-sheet.js';
import { showMemoriesPanel, showConnectionPanel } from '../utils/agent-panels.js';
import { triggerPhotoPicker, openMealResultSheet } from '../utils/meal-scanner.js';
import { analyzeMealText } from '../services/meals.js';
import { saveAiReport, reportMailtoUrl } from '../services/bia/reports.js';
import { openReportSheet } from '../utils/report-sheet.js';

export async function render(el) {
  const config = await getAgentConfig();

  if (!config.activeKey) {
    renderKeyPrompt(el, config);
    return;
  }

  await renderLiveChat(el, config);
}

/* --- Multi-Provider Setup screen --- */
function renderKeyPrompt(el, config = {}) {
  let selectedProvider = config.provider || 'gemini';
  let selectedModel = config.openaiModel || 'gpt-4o-mini-realtime-preview';

  el.innerHTML = `
    <header class="page-head">
      <h1>Bía · Voz en vivo</h1>
      <p>Compañera técnica por voz. Elige tu motor de inteligencia artificial.</p>
    </header>

    <div class="agent-key-card">
      <div class="agent-provider-tabs">
        <button type="button" class="agent-provider-tab ${selectedProvider === 'gemini' ? 'is-active' : ''}" data-provider="gemini">
          Google Gemini (Recomendado)
        </button>
        <button type="button" class="agent-provider-tab ${selectedProvider === 'openai' ? 'is-active' : ''}" data-provider="openai">
          OpenAI Realtime
        </button>
      </div>

      <!-- Sección Gemini -->
      <div id="section-prompt-gemini" ${selectedProvider === 'gemini' ? '' : 'hidden'}>
        <p class="agent-key-desc">
          Conexión multimodal nativa de Google con voz <b>Aoede</b> (cálida y motivadora). 
          Acceso ultrarrápido y cuota gratuita para tu uso diario.
        </p>
        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener" class="btn btn-block" id="btn-get-gemini-key">
          ${icons.bolt({ size: 18 })} Obtener clave gratis en Google AI Studio
        </a>
        <div class="field agent-key-field">
          <label class="field">
            <span>API Key de Gemini (AIza...)</span>
            <input id="agent-gemini-input" type="password" value="${esc(config.geminiKey || '')}" placeholder="AIza..." autocomplete="off" spellcheck="false">
          </label>
        </div>
      </div>

      <!-- Sección OpenAI -->
      <div id="section-prompt-openai" ${selectedProvider === 'openai' ? '' : 'hidden'}>
        <p class="agent-key-desc">
          Voz ultraexpresiva <b>Coral</b> (equivalente gemela de Aoede: cálida, segura y natural). 
          Requiere cuenta con créditos activos en OpenAI.
        </p>
        <p class="agent-key-label">Modelo de voz:</p>
        <div class="agent-model-select">
          <button type="button" class="agent-model-btn ${selectedModel === 'gpt-4o-mini-realtime-preview' ? 'is-active' : ''}" data-model="gpt-4o-mini-realtime-preview">
            gpt-4o-mini (Económico)
          </button>
          <button type="button" class="agent-model-btn ${selectedModel === 'gpt-4o-realtime-preview' ? 'is-active' : ''}" data-model="gpt-4o-realtime-preview">
            gpt-4o (Ultra)
          </button>
        </div>
        <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" class="btn btn-block" id="btn-get-openai-key">
          ${icons.bolt({ size: 18 })} Obtener clave en OpenAI Platform
        </a>
        <div class="field agent-key-field">
          <label class="field">
            <span>API Key de OpenAI (sk-...)</span>
            <input id="agent-openai-input" type="password" value="${esc(config.openaiKey || '')}" placeholder="sk-..." autocomplete="off" spellcheck="false">
          </label>
        </div>
      </div>

      <button class="btn btn-primary btn-block agent-key-save" id="btn-save-key" type="button">
        Guardar y conectar en vivo
      </button>
    </div>
  `;

  // Selector de tabs
  el.querySelectorAll('.agent-provider-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      selectedProvider = tab.dataset.provider;
      el.querySelectorAll('.agent-provider-tab').forEach((t) => t.classList.remove('is-active'));
      tab.classList.add('is-active');

      const isGemini = selectedProvider === 'gemini';
      el.querySelector('#section-prompt-gemini').hidden = !isGemini;
      el.querySelector('#section-prompt-openai').hidden = isGemini;
    });
  });

  // Selector de modelo OpenAI
  el.querySelectorAll('.agent-model-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedModel = btn.dataset.model;
      el.querySelectorAll('.agent-model-btn').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
    });
  });

  el.querySelector('#btn-save-key').addEventListener('click', async () => {
    const isGemini = selectedProvider === 'gemini';
    const key = (isGemini ? el.querySelector('#agent-gemini-input').value : el.querySelector('#agent-openai-input').value).trim();

    if (!key || key.length < 15) {
      toast(`Pega una API key válida de ${isGemini ? 'Google AI Studio' : 'OpenAI'}.`);
      return;
    }

    if (isGemini) {
      await setAgentConfig({ provider: 'gemini', geminiKey: key });
    } else {
      await setAgentConfig({ provider: 'openai', openaiKey: key, openaiModel: selectedModel });
    }

    const updatedConfig = await getAgentConfig();
    await renderLiveChat(el, updatedConfig);
  });
}

/* --- Live Chat Interface --- */
async function renderLiveChat(el, config) {
  let agent = getActiveAgent();
  const isExisting = !!(agent && agent.connected);
  if (!agent) {
    agent = new FitAgent(config);
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
            ${icons.chevronLeft({ size: 24 })}
          </button>
          <div class="agent-chat-head-title">
            <h1>Bía</h1>
            <p class="agent-chat-status" id="agent-status" data-ok="${isExisting ? '1' : '0'}">
              <span class="agent-chat-status-dot" aria-hidden="true"></span>
              <span id="agent-status-text">${isExisting ? 'En línea' : `Conectando con ${agent.provider === 'openai' ? 'OpenAI Realtime' : 'Gemini Live'}...`}</span>
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
            <button type="button" class="agent-chip" data-action="scan-food-chip">Escanear comida</button>
            <button type="button" class="agent-chip" data-prompt="¿Cuánta proteína me falta hoy?">¿Cuánta proteína me falta?</button>
            <button type="button" class="agent-chip" data-prompt="Registrar mi peso">Registrar mi peso</button>
            <button type="button" class="agent-chip" data-prompt="¿Qué hice ayer?">¿Qué hice ayer?</button>
            <button type="button" class="agent-chip" data-prompt="Ver mi progreso">Ver mi progreso</button>
            <button type="button" class="agent-chip" data-prompt="¿Qué rutina me toca hoy?">¿Qué rutina me toca?</button>
          </div>
          <div class="agent-chips-fade" aria-hidden="true"></div>
        </div>

        <div class="agent-input-row">
          <button class="agent-camera-btn" id="btn-agent-camera" type="button" aria-label="Escanear comida con foto" title="Escanear comida">
            ${icons.camera({ size: 22 })}
          </button>
          <input id="agent-input" class="agent-input-pill" type="text" placeholder="Escribe a Bía…" autocomplete="off" aria-label="Escribe a Bía" disabled>
          <button class="agent-action-btn" id="btn-action-trigger" type="button" aria-label="Hablar con Bía" disabled>
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
        actionBtn.setAttribute('aria-label', 'Hablar con Bía');
      }
    }
  }

  function appendMsg(role, text, id) {
    const div = document.createElement('div');
    div.className = `agent-bubble agent-bubble-${role}`;
    if (id) div.id = id;
    if (role === 'bot') {
      div.tabIndex = 0;
      div.title = 'Toca para reportar esta respuesta';
    }
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

  async function handleMealSavedInChat(savedMeal, summary) {
    if (!savedMeal || !summary) return;
    const userLine = `Comida (${savedMeal.tipo}): ${savedMeal.nombre}`;
    appendMsg('user', userLine);
    await persist('user', userLine);

    const protFalta = Math.max(0, summary.targets.proteina - summary.totals.proteina);
    const botLine = `Listo: ${savedMeal.kcal} kcal (${savedMeal.proteina} g de proteína) en ${savedMeal.tipo}. Te quedan ${summary.remainingKcal.toLocaleString('es-ES')} kcal y ${protFalta} g de proteína hoy.`;
    appendMsg('bot', botLine);
    await persist('bot', botLine);

    if (agent.connected) {
      try {
        agent.sendContext(
          `[SISTEMA: El atleta acaba de guardar en su diario (${savedMeal.tipo}): ${savedMeal.nombre} (${savedMeal.kcal} kcal, ${savedMeal.proteina}g P, ${savedMeal.carbos}g C, ${savedMeal.grasa}g G). Total hoy: ${summary.totals.kcal}/${summary.targets.kcal} kcal, proteína ${summary.totals.proteina}/${summary.targets.proteina}g.]`
        );
      } catch {}
    }
  }

  async function sendText() {
    const text = inputEl.value.trim();
    if (!text) return;

    // Si viene del atajo "Anótame esta comida: ..." abrimos la tarjeta de confirmación editable primero
    const mealPrefixMatch = text.match(/^an[oó]tame esta comida:\s*(.+)$/i);
    if (mealPrefixMatch) {
      const foodDesc = mealPrefixMatch[1].trim();
      inputEl.value = '';
      updateActionButton();
      const parsed = await analyzeMealText(foodDesc);
      await openMealResultSheet({
        initialResult: parsed,
        onSaved: handleMealSavedInChat,
      });
      return;
    }

    if (!agent.connected) return;
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
        setStatus('Bía habla...', true);
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
      botBubble?.removeAttribute('id');
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
          <div class="agent-card-memory-icon">${icons.check({ size: 18, cls: 'icon-ok' })}</div>
          <div class="agent-card-memory-body">
            <span class="agent-card-memory-tag">Guardado en recuerdos</span>
            <span class="agent-card-memory-text">${esc(args?.contenido || 'Preferencia guardada')}</span>
          </div>
          ${result?.id ? `<button class="agent-card-memory-undo" data-id="${result.id}" type="button">Deshacer</button>` : ''}
        `;
        msgsEl.appendChild(card);
        msgsEl.scrollTop = msgsEl.scrollHeight;
      } else if ((toolName === 'registrar_comida' || toolName === 'corregir_comida') && result?.ok) {
        const card = document.createElement('div');
        card.className = 'agent-card-memory';
        const tag = toolName === 'registrar_comida' ? 'Guardado en diario de comidas' : 'Diario de comidas actualizado';
        const detail = result.comida
          ? `${result.comida.tipo.toUpperCase()} · ${result.comida.nombre} (${result.comida.kcal} kcal · ${result.comida.proteina}g P)`
          : (result.mensaje || 'Registro actualizado');
        card.innerHTML = `
          <div class="agent-card-memory-icon">${icons.check({ size: 18, cls: 'icon-ok' })}</div>
          <div class="agent-card-memory-body">
            <span class="agent-card-memory-tag">${esc(tag)}</span>
            <span class="agent-card-memory-text">${esc(detail)}</span>
          </div>
        `;
        msgsEl.appendChild(card);
        msgsEl.scrollTop = msgsEl.scrollHeight;
      } else if (toolName === 'registrar_peso_corporal' && result?.ok) {
        const card = document.createElement('div');
        card.className = 'agent-card-memory';
        card.innerHTML = `
          <div class="agent-card-memory-icon">${icons.check({ size: 18, cls: 'icon-ok' })}</div>
          <div class="agent-card-memory-body">
            <span class="agent-card-memory-tag">Guardado en Peso corporal</span>
            <span class="agent-card-memory-text">${esc(result.mensaje || `${result.pesoKg} kg (${result.fecha})`)}</span>
          </div>
        `;
        msgsEl.appendChild(card);
        msgsEl.scrollTop = msgsEl.scrollHeight;
      } else if (toolName === 'registrar_creatina' && result?.ok) {
        const card = document.createElement('div');
        card.className = 'agent-card-memory';
        card.innerHTML = `
          <div class="agent-card-memory-icon">${icons.check({ size: 18, cls: 'icon-ok' })}</div>
          <div class="agent-card-memory-body">
            <span class="agent-card-memory-tag">Registro de creatina</span>
            <span class="agent-card-memory-text">${esc(result.mensaje || 'Creatina actualizada')}</span>
          </div>
        `;
        msgsEl.appendChild(card);
        msgsEl.scrollTop = msgsEl.scrollHeight;
      } else if (toolName === 'gestionar_entrenamiento' && result?.ok) {
        const card = document.createElement('div');
        card.className = 'agent-card-memory';
        const tag = result.accion === 'finalizar' ? 'Entrenamiento finalizado' : 'Entrenamiento iniciado';
        card.innerHTML = `
          <div class="agent-card-memory-icon">${icons.check({ size: 18, cls: 'icon-ok' })}</div>
          <div class="agent-card-memory-body">
            <span class="agent-card-memory-tag">${esc(tag)}</span>
            <span class="agent-card-memory-text">${esc(result.mensaje || '')}</span>
          </div>
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

  /* Botón Cámara (Escanear comida desde Bía) */
  const cameraBtn = el.querySelector('#btn-agent-camera');
  if (cameraBtn) {
    cameraBtn.addEventListener('click', () => {
      triggerPhotoPicker({
        onSaved: handleMealSavedInChat,
      });
    });
  }

  /* Sugerencias Rápidas (Chips) */
  el.querySelectorAll('.agent-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.action === 'scan-food-chip') {
        triggerPhotoPicker({
          onSaved: handleMealSavedInChat,
        });
        return;
      }
      const prompt = btn.dataset.prompt;
      if (prompt && agent.connected) {
        inputEl.value = prompt;
        sendText();
      }
    });
  });

  const prefill = sessionStorage.getItem('brother_fit_prefill_prompt');
  if (prefill) {
    sessionStorage.removeItem('brother_fit_prefill_prompt');
    inputEl.disabled = false;
    actionBtn.disabled = false;
    inputEl.value = prefill;
    updateActionButton();
    setTimeout(() => inputEl.focus(), 80);
  }

  /* Reportar una respuesta de Bía. Tocarla muestra «Reportar respuesta»: la política de Play
   * pide poder marcar contenido de IA ofensivo o dañino sin salir de la app. */
  async function reportBubble(bubble) {
    const choice = await openReportSheet();
    if (!choice) return;
    try {
      const report = await saveAiReport({ text: bubble.textContent, ...choice });
      bubble.classList.add('is-reported');
      const next = bubble.nextElementSibling;
      if (next?.classList.contains('agent-bubble-actions')) next.remove();
      const mailto = reportMailtoUrl(report);
      toast(mailto ? 'Reporte guardado. Se abrirá tu correo para enviarlo.' : 'Reporte guardado. Gracias por avisar.');
      if (mailto) setTimeout(() => { window.location.href = mailto; }, 600);
    } catch (err) {
      toast(err.message || 'No se pudo guardar el reporte.', { tone: 'danger' });
    }
  }

  function toggleBubbleActions(bubble) {
    const next = bubble.nextElementSibling;
    if (next?.classList.contains('agent-bubble-actions')) {
      next.remove();
      return;
    }
    msgsEl.querySelectorAll('.agent-bubble-actions').forEach((n) => n.remove());
    if (bubble.classList.contains('is-reported')) return;
    const actions = document.createElement('div');
    actions.className = 'agent-bubble-actions';
    actions.innerHTML = `<button type="button" class="agent-bubble-report" data-action="report-bubble">${icons.flag({ size: 16 })} Reportar respuesta</button>`;
    bubble.after(actions);
  }

  msgsEl.addEventListener('keydown', (e) => {
    const bubble = e.target.closest?.('.agent-bubble-bot');
    if (bubble && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      toggleBubbleActions(bubble);
    }
  });

  /* Interacción con tarjetas dentro del chat */
  msgsEl.addEventListener('click', async (e) => {
    const reportBtn = e.target.closest('[data-action="report-bubble"]');
    if (reportBtn) {
      const bubble = reportBtn.parentElement.previousElementSibling;
      if (bubble?.classList.contains('agent-bubble-bot')) await reportBubble(bubble);
      return;
    }
    const tappedBubble = e.target.closest('.agent-bubble-bot');
    if (tappedBubble && tappedBubble !== botBubble) {
      toggleBubbleActions(tappedBubble);
      return;
    }

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
    showMemoriesPanel(agent, { onChange: () => render(el) });
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
    await renderLiveChat(el, config);
  });

  if (!el._changeKeyBound) {
    el._changeKeyBound = true;
    el.addEventListener('click', (e) => {
      if (!e.target.closest('[data-action="change-key"]')) return;
      showConnectionPanel(agent, { onChange: () => render(el) });
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
      toast(`No se pudo conectar a ${agent.provider === 'openai' ? 'OpenAI Realtime' : 'Gemini Live'}: ${err.message}`);
    });
  }
}
