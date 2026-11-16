/* Primera vez en Bía: elegir proveedor (Gemini u OpenAI), modelo de OpenAI y pegar la clave. */
import { setAgentConfig, OPENAI_VOICE_MODELS, MIN_KEY_LENGTH } from '../../services/bia/config.js';
import { icons } from '../../utils/icons.js';
import { toast, esc } from '../../utils/dom.js';


function keyField({ id, label, value, placeholder }) {
  return `
    <div class="field agent-key-field">
      <label class="field">
        <span>${label}</span>
        <input id="${id}" type="password" value="${esc(value || '')}" placeholder="${placeholder}" autocomplete="off" spellcheck="false">
      </label>
    </div>`;
}

function markup(config, provider, model) {
  const tab = (id, label) =>
    `<button type="button" class="agent-provider-tab ${provider === id ? 'is-active' : ''}" data-provider="${id}">${label}</button>`;
  const modelBtn = ({ id, label }) =>
    `<button type="button" class="agent-model-btn ${model === id ? 'is-active' : ''}" data-model="${id}">${label}</button>`;
  return `
    <header class="page-head">
      <h1>Bía · Voz en vivo</h1>
      <p>Compañera técnica por voz. Elige tu motor de inteligencia artificial.</p>
    </header>

    <div class="agent-key-card">
      <div class="agent-provider-tabs">
        ${tab('gemini', 'Google Gemini (Recomendado)')}
        ${tab('openai', 'OpenAI Realtime')}
      </div>

      <div id="section-prompt-gemini" ${provider === 'gemini' ? '' : 'hidden'}>
        <p class="agent-key-desc">
          Conexión de Google con voz <b>Aoede</b> (cálida y motivadora). Rápida y con uso gratuito para el día a día.
        </p>
        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener" class="btn btn-block" id="btn-get-gemini-key">
          ${icons.bolt({ size: 18 })} Obtener clave gratis en Google AI Studio
        </a>
        ${keyField({ id: 'agent-gemini-input', label: 'Clave de Gemini (AIza...)', value: config.geminiKey, placeholder: 'AIza...' })}
      </div>

      <div id="section-prompt-openai" ${provider === 'openai' ? '' : 'hidden'}>
        <p class="agent-key-desc">
          Voz <b>Coral</b>: cálida, segura y natural. Necesita una cuenta de OpenAI con saldo.
        </p>
        <p class="agent-key-label">Modelo de voz:</p>
        <div class="agent-model-select">${OPENAI_VOICE_MODELS.map(modelBtn).join('')}</div>
        <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" class="btn btn-block" id="btn-get-openai-key">
          ${icons.bolt({ size: 18 })} Obtener clave en OpenAI Platform
        </a>
        ${keyField({ id: 'agent-openai-input', label: 'Clave de OpenAI (sk-...)', value: config.openaiKey, placeholder: 'sk-...' })}
      </div>

      <button class="btn btn-primary btn-block agent-key-save" id="btn-save-key" type="button">
        Guardar y conectar en vivo
      </button>
    </div>`;
}

function selectOne(el, selector, active) {
  el.querySelectorAll(selector).forEach((b) => b.classList.toggle('is-active', b === active));
}

/** onSaved(): la clave quedó guardada; la pantalla abre la charla. */
export function renderKeySetup(el, config, { onSaved }) {
  let provider = config.provider || 'gemini';
  let model = config.openaiModel || OPENAI_VOICE_MODELS[0].id;
  el.innerHTML = markup(config, provider, model);

  el.querySelectorAll('.agent-provider-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      provider = tab.dataset.provider;
      selectOne(el, '.agent-provider-tab', tab);
      el.querySelector('#section-prompt-gemini').hidden = provider !== 'gemini';
      el.querySelector('#section-prompt-openai').hidden = provider === 'gemini';
    });
  });

  el.querySelectorAll('.agent-model-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      model = btn.dataset.model;
      selectOne(el, '.agent-model-btn', btn);
    });
  });

  el.querySelector('#btn-save-key').addEventListener('click', async () => {
    const isGemini = provider === 'gemini';
    const key = el.querySelector(isGemini ? '#agent-gemini-input' : '#agent-openai-input').value.trim();
    if (key.length < MIN_KEY_LENGTH) {
      toast(`Pega una clave válida de ${isGemini ? 'Google AI Studio' : 'OpenAI'}.`);
      return;
    }
    await setAgentConfig(isGemini
      ? { provider: 'gemini', geminiKey: key }
      : { provider: 'openai', openaiKey: key, openaiModel: model });
    await onSaved();
  });
}
