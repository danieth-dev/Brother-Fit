/* Plantilla de la charla con Bía: encabezado, mensajes, atajos y barra de escritura. */
import { icons } from '../../utils/icons.js';

const QUICK_PROMPTS = [
  ['¿Cuánta proteína me falta hoy?', '¿Cuánta proteína me falta?'],
  ['Registrar mi peso', 'Registrar mi peso'],
  ['¿Qué hice ayer?', '¿Qué hice ayer?'],
  ['Ver mi progreso', 'Ver mi progreso'],
  ['¿Qué rutina me toca hoy?', '¿Qué rutina me toca?'],
];

export const providerLabel = (provider) => (provider === 'openai' ? 'OpenAI Realtime' : 'Gemini Live');

export function chatMarkup({ online, provider }) {
  const chips = QUICK_PROMPTS
    .map(([prompt, label]) => `<button type="button" class="agent-chip" data-prompt="${prompt}">${label}</button>`)
    .join('');
  return `
    <div class="agent-view">
      <header class="page-head agent-chat-head">
        <div class="agent-chat-head-left">
          <button class="agent-back-btn" id="btn-agent-back" aria-label="Volver a Entreno" type="button">
            ${icons.chevronLeft({ size: 24 })}
          </button>
          <div class="agent-chat-head-title">
            <h1>Bía</h1>
            <p class="agent-chat-status" id="agent-status" data-ok="${online ? '1' : '0'}">
              <span class="agent-chat-status-dot" aria-hidden="true"></span>
              <span id="agent-status-text">${online ? 'En línea' : `Conectando con ${providerLabel(provider)}...`}</span>
            </p>
          </div>
        </div>
        <div class="agent-chat-head-actions">
          <button class="agent-head-btn" type="button" aria-label="Nuevo chat" id="btn-new-chat" title="Nuevo chat">
            ${icons.chat({ size: 22 })}
          </button>
          <button class="agent-head-btn" type="button" aria-label="Acciones rápidas / Recuerdos" id="btn-memories" title="Acciones y recuerdos">
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
            ${chips}
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
    </div>`;
}

/* El botón de la derecha: enviar si hay texto, si no, abrir o cerrar la voz en vivo. */
export function paintActionButton(btn, { hasText, live }) {
  btn.classList.toggle('is-send', hasText);
  btn.classList.toggle('active-live', !hasText && live);
  if (hasText) {
    btn.innerHTML = icons.send({ size: 22 });
    btn.setAttribute('aria-label', 'Enviar mensaje');
  } else if (live) {
    btn.innerHTML = icons.mic({ size: 22 });
    btn.setAttribute('aria-label', 'Detener voz en vivo');
  } else {
    btn.innerHTML = icons.waveform({ size: 24 });
    btn.setAttribute('aria-label', 'Hablar con Bía');
  }
}
