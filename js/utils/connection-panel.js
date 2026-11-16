/* Panel «Conexión y clave» de Bía: estado, proveedor (Gemini u OpenAI), modelo, claves y
 * desconectar. Se abre desde Bía y desde Ajustes; quien lo abre pasa onChange para redibujarse. */
import { getAgentConfig, setAgentConfig, OPENAI_VOICE_MODELS, MIN_KEY_LENGTH } from '../services/bia/config.js';
import { icons } from './icons.js';
import { toast, esc } from './dom.js';
import { askConfirm } from './confirm-sheet.js';
import { openAgentSheet } from './agent-sheet.js';

const PROVIDERS = {
  gemini: { name: 'Gemini Live', label: 'Google Gemini', voice: 'Aoede' },
  openai: { name: 'OpenAI Realtime', label: 'OpenAI', voice: 'Coral' },
};

function statusSection(agent) {
  const online = Boolean(agent?.connected);
  const p = PROVIDERS[agent?.provider === 'openai' ? 'openai' : 'gemini'];
  return `
    <section class="agent-rec-section">
      <div class="agent-rec-section-head">
        <h3 class="agent-rec-section-title">Estado del servicio</h3>
      </div>
      <div class="agent-rec-card conn-status${online ? ' is-online' : ''}">
        <div class="conn-status-main">
          <span class="conn-status-dot" aria-hidden="true"></span>
          <div>
            <span class="conn-status-title">${online ? `Bía en línea (${p.name})` : 'Desconectado'}</span>
            <span class="conn-status-sub">Voz activa: <b>${p.voice}</b> · Bidireccional</span>
          </div>
        </div>
        <span class="conn-status-badge">${online ? 'EN LÍNEA' : 'DESCONECTADA'}</span>
      </div>
    </section>`;
}

function keyField(id, label, value, placeholder) {
  return `
    <label class="conn-key-field">
      <span class="conn-key-label">${label}</span>
      <div class="conn-key-row">
        <input id="${id}" type="password" value="${esc(value || '')}" placeholder="${placeholder}" autocomplete="off" spellcheck="false" class="agent-rec-edit-input conn-key-input">
        <button type="button" class="btn btn-toggle-mask conn-key-toggle" data-target="${id}" title="Ver u ocultar la clave">Ver</button>
      </div>
    </label>`;
}

function providerSection(config, provider, model) {
  const tab = (id, label) =>
    `<button type="button" class="agent-provider-tab ${provider === id ? 'is-active' : ''}" data-provider="${id}">${label}</button>`;
  const modelBtn = ({ id, label }) =>
    `<button type="button" class="agent-model-btn ${model === id ? 'is-active' : ''}" data-model="${id}">${label}</button>`;
  return `
    <section class="agent-rec-section">
      <div class="agent-rec-section-head">
        <h3 class="agent-rec-section-title">Proveedor de inteligencia artificial</h3>
      </div>
      <div class="agent-provider-tabs agent-provider-tabs--spaced">
        ${tab('gemini', 'Google Gemini')}
        ${tab('openai', 'OpenAI Realtime')}
      </div>

      <div class="agent-rec-card conn-panel" id="conn-panel-gemini" ${provider === 'gemini' ? '' : 'hidden'}>
        <div>
          <span class="conn-panel-title">Gemini Live</span>
          <span class="conn-panel-sub">Voz: <b class="conn-voice">Aoede</b> (cálida, motivadora y clara) · Uso gratuito</span>
        </div>
        ${keyField('conn-gemini-input', 'Clave de Google AI Studio', config.geminiKey, 'AIza...')}
        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener" class="conn-key-link">
          ${icons.bolt({ size: 14 })} Obtener o cambiar clave en Google AI Studio ›
        </a>
      </div>

      <div class="agent-rec-card conn-panel" id="conn-panel-openai" ${provider === 'openai' ? '' : 'hidden'}>
        <div>
          <span class="conn-panel-title">OpenAI Realtime</span>
          <span class="conn-panel-sub">Voz: <b class="conn-voice">Coral</b> (cálida y segura)</span>
        </div>
        <p class="conn-key-label">Modelo:</p>
        <div class="agent-model-select">${OPENAI_VOICE_MODELS.map(modelBtn).join('')}</div>
        ${keyField('conn-openai-input', 'Clave de OpenAI', config.openaiKey, 'sk-...')}
        <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" class="conn-key-link">
          ${icons.bolt({ size: 14 })} Obtener o cambiar clave en OpenAI Platform ›
        </a>
      </div>
    </section>`;
}

const FOOTER = `
  <button type="button" class="btn btn-primary btn-block conn-save" id="btn-save-conn-config">
    Guardar y activar proveedor
  </button>
  <div class="conn-footer">
    <button class="agent-rec-danger-btn" id="btn-disconnect-key" type="button">Desconectar Bía</button>
  </div>`;

function selectOne(root, selector, active) {
  root.querySelectorAll(selector).forEach((b) => b.classList.toggle('is-active', b === active));
}

export async function showConnectionPanel(agent, { onChange } = {}) {
  const config = await getAgentConfig();
  let provider = config.provider || 'gemini';
  let model = config.openaiModel || OPENAI_VOICE_MODELS[0].id;
  const { sheet, close } = openAgentSheet({
    title: 'Conexión y clave',
    subtitle: 'Voz en tiempo real con Gemini u OpenAI.',
    body: statusSection(agent) + providerSection(config, provider, model) + FOOTER,
  });

  sheet.querySelectorAll('.agent-provider-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      provider = tab.dataset.provider;
      selectOne(sheet, '.agent-provider-tab', tab);
      sheet.querySelector('#conn-panel-gemini').hidden = provider !== 'gemini';
      sheet.querySelector('#conn-panel-openai').hidden = provider === 'gemini';
    });
  });

  sheet.querySelectorAll('.agent-model-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      model = btn.dataset.model;
      selectOne(sheet, '.agent-model-btn', btn);
    });
  });

  sheet.querySelectorAll('.btn-toggle-mask').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = sheet.querySelector(`#${btn.dataset.target}`);
      if (!input) return;
      const hidden = input.type === 'password';
      input.type = hidden ? 'text' : 'password';
      btn.textContent = hidden ? 'Ocultar' : 'Ver';
    });
  });

  sheet.querySelector('#btn-save-conn-config').addEventListener('click', async () => {
    const geminiKey = sheet.querySelector('#conn-gemini-input').value.trim();
    const openaiKey = sheet.querySelector('#conn-openai-input').value.trim();
    const p = PROVIDERS[provider];
    if ((provider === 'gemini' ? geminiKey : openaiKey).length < MIN_KEY_LENGTH) {
      toast(`Ingresa una clave válida para ${p.label}.`);
      return;
    }
    await setAgentConfig({ provider, geminiKey, openaiKey, openaiModel: model });
    toast(`Conectado a ${p.label} (voz ${p.voice})`);
    close();
    agent?.disconnect();
    await onChange?.();
  });

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
    await setAgentConfig(provider === 'gemini' ? { geminiKey: '' } : { openaiKey: '' });
    await onChange?.();
  });
}
