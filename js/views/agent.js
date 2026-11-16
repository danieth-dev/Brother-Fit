/* Pantalla de Bía: la clave la primera vez y, después, la charla en directo por texto o voz.
 * Partes en js/views/agent/: alta de clave, plantilla, mensajes y tarjetas de herramientas. */
import { FitAgent, getActiveAgent } from '../voice/fit-agent.js';
import { visibleFitText } from '../services/bia/text.js';
import { getAgentConfig } from '../services/bia/config.js';
import { deleteMemory } from '../services/bia/memory.js';
import { loadFitChat, appendFitChat, clearFitChat, formatChatForContext } from '../services/fit-chat.js';
import { getActiveWorkout, startWorkout } from '../services/workouts.js';
import { analyzeMealText } from '../services/meal-ai.js';
import { state } from '../store.js';
import { toast, go } from '../utils/dom.js';
import { askConfirm } from '../utils/confirm-sheet.js';
import { showMemoriesPanel } from '../utils/memories-panel.js';
import { triggerPhotoPicker, openMealResultSheet } from '../utils/meal-scanner.js';
import { renderKeySetup } from './agent/key-setup.js';
import { chatMarkup, paintActionButton, providerLabel } from './agent/chat-markup.js';
import { createMessageList } from './agent/messages.js';
import { toolCard, exerciseCard } from './agent/chat-cards.js';

/* Lo deja Comida en «Decírselo a Bía» para abrir la charla con la frase empezada. */
const PREFILL_KEY = 'brother_fit_prefill_prompt';
const MEAL_SHORTCUT = /^an[oó]tame esta comida:\s*(.+)$/i;
const UNDO_REMOVE_MS = 1200;
const FOCUS_DELAY_MS = 80;

export async function render(el) {
  const config = await getAgentConfig();
  if (!config.activeKey) {
    renderKeySetup(el, config, { onSaved: async () => renderLiveChat(el, await getAgentConfig()) });
    return;
  }
  await renderLiveChat(el, config);
}

function takePrefill() {
  try {
    const text = sessionStorage.getItem(PREFILL_KEY);
    if (text) sessionStorage.removeItem(PREFILL_KEY);
    return text;
  } catch {
    return null;
  }
}

async function renderLiveChat(el, config) {
  const agent = getActiveAgent() || new FitAgent(config);
  const online = agent.connected;
  const history = await loadFitChat();
  el.innerHTML = chatMarkup({ online, provider: agent.provider });

  const ui = {
    msgs: el.querySelector('#agent-msgs'),
    status: el.querySelector('#agent-status'),
    statusText: el.querySelector('#agent-status-text'),
    input: el.querySelector('#agent-input'),
    action: el.querySelector('#btn-action-trigger'),
  };
  const list = createMessageList(ui.msgs);
  /* La respuesta de Bía que se está escribiendo ahora mismo. */
  const live = { text: '', bubble: null };
  const resetLive = () => { live.text = ''; live.bubble = null; };

  const setStatus = (text, ok = true) => {
    ui.statusText.textContent = text;
    ui.status.dataset.ok = ok ? '1' : '0';
  };
  const syncAction = () => paintActionButton(ui.action, { hasText: Boolean(ui.input.value.trim()), live: agent.isLiveMode });
  const enableControls = (on) => {
    ui.input.disabled = !on;
    ui.action.disabled = !on;
  };
  const persist = async (role, text) => {
    const t = String(text || '').trim();
    if (t) await appendFitChat(role, t);
  };
  const say = (role, text) => {
    list.append(role, text);
    persist(role, text);
  };

  /* Una comida guardada desde el chat queda escrita y Bía la sabe sin decir nada. */
  async function onMealSaved(meal, summary) {
    if (!meal || !summary) return;
    say('user', `Comida (${meal.tipo}): ${meal.nombre}`);
    const protFalta = Math.max(0, summary.targets.proteina - summary.totals.proteina);
    say('bot', `Listo: ${meal.kcal} kcal (${meal.proteina} g de proteína) en ${meal.tipo}. Te quedan ${summary.remainingKcal.toLocaleString('es-ES')} kcal y ${protFalta} g de proteína hoy.`);
    if (agent.connected) {
      agent.sendContext(
        `[SISTEMA: El atleta acaba de guardar en su diario (${meal.tipo}): ${meal.nombre} (${meal.kcal} kcal, ${meal.proteina}g P, ${meal.carbos}g C, ${meal.grasa}g G). Total hoy: ${summary.totals.kcal}/${summary.targets.kcal} kcal, proteína ${summary.totals.proteina}/${summary.targets.proteina}g.]`
      );
    }
  }

  const scanFood = () => triggerPhotoPicker({ onSaved: onMealSaved });

  async function sendText() {
    const text = ui.input.value.trim();
    if (!text) return;
    const meal = text.match(MEAL_SHORTCUT);
    if (meal) {
      ui.input.value = '';
      syncAction();
      await openMealResultSheet({ initialResult: await analyzeMealText(meal[1].trim()), onSaved: onMealSaved });
      return;
    }
    if (!agent.connected) return;
    ui.input.value = '';
    syncAction();
    resetLive();
    try {
      agent.sendText(text);
    } catch (e) {
      toast(`No se pudo enviar: ${e.message}`);
    }
  }

  list.paintHistory(history);
  bindAgentEvents(agent, { list, live, resetLive, setStatus, syncAction, enableControls, persist, say, history });

  ui.action.addEventListener('click', async () => {
    if (ui.input.value.trim()) {
      sendText();
    } else if (agent.isLiveMode) {
      agent.stopLiveMode();
    } else {
      try {
        await agent.startLiveMode();
      } catch (e) {
        toast(`Micrófono: ${e.message}`);
      }
    }
  });
  ui.input.addEventListener('input', syncAction);
  ui.input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    sendText();
  });
  el.querySelector('#btn-agent-camera').addEventListener('click', scanFood);
  el.querySelectorAll('.agent-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.action === 'scan-food-chip') {
        scanFood();
      } else if (btn.dataset.prompt && agent.connected) {
        ui.input.value = btn.dataset.prompt;
        sendText();
      }
    });
  });

  const prefill = takePrefill();
  if (prefill) {
    enableControls(true);
    ui.input.value = prefill;
    syncAction();
    setTimeout(() => ui.input.focus(), FOCUS_DELAY_MS);
  }

  bindMessageClicks(ui.msgs, list, live);
  bindHeader(el, agent, config);

  if (online) {
    setStatus(agent.isLiveMode ? 'Escuchando...' : 'En línea', true);
    enableControls(true);
    if (agent.isLiveMode) syncAction();
  } else {
    agent.connect().catch((err) => {
      setStatus('Fallo al conectar', false);
      toast(`No se pudo conectar a ${providerLabel(agent.provider)}: ${err.message}`);
    });
  }
}

/* ---------- Eventos de la sesión de voz ---------- */

function bindAgentEvents(agent, c) {
  const { list, live } = c;
  const whileLive = (text) => { if (agent.isLiveMode) c.setStatus(text, true); };
  agent
    .on('ready', () => {
      c.setStatus('En línea', true);
      c.enableControls(true);
      if (c.history.length) agent.seedPriorChat(formatChatForContext(c.history));
      else list.append('bot', 'Hola, estoy en línea. Escríbeme o pulsa el audio para hablar.');
    })
    .on('user_message', (text) => {
      c.say('user', text);
      c.resetLive();
    })
    .on('effort_saved', (res) => {
      c.say('bot', String(res?.mensaje || '').includes('sin esfuerzo') ? 'Quedó sin esfuerzo.' : 'Anotado.');
      c.resetLive();
    })
    .on('live_mode_started', () => {
      c.syncAction();
      c.setStatus('Escuchando...', true);
    })
    .on('live_mode_stopped', () => {
      c.syncAction();
      c.setStatus('En línea', true);
    })
    .on('listening', () => whileLive('Escuchando...'))
    .on('interim_speech', (text) => {
      const said = String(text || '').trim();
      whileLive(said ? `"${said}"` : 'Escuchando...');
    })
    .on('speaking_start', () => whileLive('Bía habla...'))
    .on('speaking_end', () => whileLive('Escuchando...'))
    .on('transcript_chunk', (chunk) => {
      live.text += chunk;
      const shown = visibleFitText(live.text);
      if (!shown) {
        live.bubble?.remove();
        live.bubble = null;
      } else if (!live.bubble) {
        live.bubble = list.append('bot', shown, 'agent-bot-live');
      } else {
        live.bubble.textContent = shown;
        list.scrollDown();
      }
    })
    .on('turn_complete', () => {
      const shown = visibleFitText(live.text);
      if (shown) c.persist('bot', shown);
      live.bubble?.removeAttribute('id');
      c.resetLive();
    })
    .on('exercise_selected', (ex) => {
      if (ex) list.appendNode(exerciseCard(ex));
    })
    .on('memory_updated', (toolName, args, result) => {
      const card = toolCard(toolName, args, result);
      if (card) list.appendNode(card);
    })
    .on('error', (err) => {
      c.setStatus('Error de conexión', false);
      toast(err.message);
    })
    .on('mic_paused', (message) => toast(message))
    .on('disconnected', () => {
      c.setStatus('Desconectado', false);
      c.enableControls(false);
    });
}

/* ---------- Toques dentro del chat ---------- */

async function undoMemory(btn) {
  const id = Number(btn.dataset.id);
  if (!id) return;
  await deleteMemory(id);
  const card = btn.closest('.agent-card-memory');
  card?.classList.add('is-undone');
  btn.textContent = 'Deshecho';
  btn.disabled = true;
  setTimeout(() => card?.remove(), UNDO_REMOVE_MS);
  toast('Recuerdo eliminado');
}

/* «Registrar serie 1»: abre Entreno (y lo empieza si hace falta) con ese ejercicio elegido. */
async function goToExercise(btn) {
  if (!(await getActiveWorkout())) await startWorkout();
  const { exerciseId, nombre, grupo } = btn.dataset;
  state.activeExercise = { id: Number(exerciseId), nombre, grupo };
  go('/workout');
}

function bindMessageClicks(msgsEl, list, live) {
  msgsEl.addEventListener('keydown', (e) => {
    const bubble = e.target.closest?.('.agent-bubble-bot');
    if (bubble && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      list.toggleActions(bubble);
    }
  });
  msgsEl.addEventListener('click', async (e) => {
    const reportBtn = e.target.closest('[data-action="report-bubble"]');
    if (reportBtn) {
      const bubble = reportBtn.parentElement.previousElementSibling;
      if (bubble?.classList.contains('agent-bubble-bot')) await list.report(bubble);
      return;
    }
    const bubble = e.target.closest('.agent-bubble-bot');
    if (bubble && bubble !== live.bubble) {
      list.toggleActions(bubble);
      return;
    }
    const undoBtn = e.target.closest('.agent-card-memory-undo');
    if (undoBtn) {
      await undoMemory(undoBtn);
      return;
    }
    const exBtn = e.target.closest('[data-action="go-exercise"]');
    if (exBtn) await goToExercise(exBtn);
  });
}

/* ---------- Encabezado ---------- */

function bindHeader(el, agent, config) {
  el.querySelector('#btn-agent-back').addEventListener('click', () => {
    if (window.history.length > 1) window.history.back();
    else go('/workout');
  });
  el.querySelector('#btn-memories').addEventListener('click', () => {
    showMemoriesPanel(agent, { onChange: () => render(el) });
  });
  el.querySelector('#btn-new-chat').addEventListener('click', async () => {
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
}
