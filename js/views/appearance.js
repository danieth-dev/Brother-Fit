import { state, saveSettings } from '../store.js';
import { delegate, toast } from '../utils/dom.js';
import { icons } from '../utils/icons.js';

export async function render(el) {
  const s = state.settings;
  const modo = s.modo || 'oscuro';
  const tema = s.tema || 'amarillo';

  el.innerHTML = `
    <header class="page-head">
      <div class="page-head-row">
        <a class="head-back" href="#/settings" aria-label="Volver a Ajustes">
          ${icons.chevronLeft({ size: 24 })}
        </a>
        <h1>Aspecto</h1>
      </div>
      <p>Personaliza el tema y el modo visual de la aplicación.</p>
    </header>

    <div class="form-card stack">
      <div class="field">
        <span>Modo de pantalla</span>
        <div class="seg seg--3" role="group" aria-label="Modo de pantalla">
          <button type="button" data-action="modo" data-modo="oscuro" aria-pressed="${modo === 'oscuro'}">
            ${icons.moon ? icons.moon({ size: 16 }) : '☾'} Oscuro
          </button>
          <button type="button" data-action="modo" data-modo="claro" aria-pressed="${modo === 'claro'}">
            ${icons.sun ? icons.sun({ size: 16 }) : '☼'} Claro
          </button>
          <button type="button" data-action="modo" data-modo="sistema" aria-pressed="${modo === 'sistema'}">
            ${icons.sliders ? icons.sliders({ size: 16 }) : '⚙'} Sistema
          </button>
        </div>
      </div>
      <p class="hint">Oscuro es negro OLED carbón. Sistema sigue el ajuste de tu teléfono.</p>

      <div class="field" style="margin-top:12px">
        <span id="tema-label">Color de acento</span>
        <div class="tema-pick" role="group" aria-labelledby="tema-label">
          ${['amarillo', 'azul', 'rosado'].map((t) => `
            <button type="button" data-action="tema" data-tema="${t}" aria-pressed="${tema === t}">
              ${t}
            </button>`).join('')}
        </div>
      </div>
      <p class="hint">Acentos en botones principales, pestañas activas, métricas y gráficas.</p>
    </div>
  `;

  delegate(el, {
    modo: async (t) => {
      const next = t.dataset.modo;
      if (next === state.settings.modo) return;
      await saveSettings({ modo: next });
      el.querySelectorAll('[data-action="modo"]').forEach((b) => {
        b.setAttribute('aria-pressed', String(b.dataset.modo === next));
      });
      toast(`Modo ${next} aplicado`);
    },
    tema: async (t) => {
      const next = t.dataset.tema;
      if (next === state.settings.tema) return;
      await saveSettings({ tema: next });
      el.querySelectorAll('[data-action="tema"]').forEach((b) => {
        b.setAttribute('aria-pressed', String(b.dataset.tema === next));
      });
      toast(`Color ${next} aplicado`);
    }
  });
}
