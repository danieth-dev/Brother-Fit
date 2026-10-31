/**
 * appearance view — High-Tech Athletic Theme & Accent Customizer for Brother Fit.
 * Modes: Oscuro / Claro / Sistema.
 * Accents: Amarillo / Azul / Rosado with high-contrast dynamic previews.
 */

import { state, saveSettings, applyModo, applyTema } from '../store.js';
import { toast } from '../utils/dom.js';
import { icons } from '../utils/icons.js';

export async function render(el) {
  const s = state.settings;
  const isSystem = s.modo === 'sistema';
  const effectiveModo = isSystem
    ? (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'claro' : 'oscuro')
    : (s.modo || 'oscuro');
  const activeTema = s.tema || 'amarillo';

  el.innerHTML = `
    <header class="aspecto-head">
      <a class="aspecto-back-btn" href="#/settings" aria-label="Volver a Ajustes">
        ${icons.arrowLeft({ size: 26 })}
      </a>
      <h1 class="aspecto-title">Aspecto</h1>
    </header>

    <div class="aspecto-view">
      <!-- 1. TEMA -->
      <section>
        <h2 class="aspecto-section-title">Tema</h2>
        <div class="aspecto-theme-grid">
          <!-- Tarjeta Oscuro -->
          <button 
            type="button" 
            class="aspecto-theme-card" 
            data-action="set-modo" 
            data-modo="oscuro" 
            aria-pressed="${effectiveModo === 'oscuro' ? 'true' : 'false'}"
          >
            <span class="aspecto-card-check" aria-hidden="true">
              ${icons.check({ size: 14, strokeWidth: 3.4 })}
            </span>
            <span class="aspecto-mini-preview is-dark">
              <span class="aspecto-mini-head"></span>
              <span class="aspecto-mini-card">
                <span class="aspecto-mini-line-1"></span>
                <span class="aspecto-mini-line-2"></span>
              </span>
              <span class="aspecto-mini-btn"></span>
            </span>
            <div class="aspecto-card-info">
              <span class="aspecto-card-name">Oscuro</span>
              <span class="aspecto-card-desc">Negro, ideal de noche</span>
            </div>
          </button>

          <!-- Tarjeta Claro -->
          <button 
            type="button" 
            class="aspecto-theme-card" 
            data-action="set-modo" 
            data-modo="claro" 
            aria-pressed="${effectiveModo === 'claro' ? 'true' : 'false'}"
          >
            <span class="aspecto-card-check" aria-hidden="true">
              ${icons.check({ size: 14, strokeWidth: 3.4 })}
            </span>
            <span class="aspecto-mini-preview is-light">
              <span class="aspecto-mini-head"></span>
              <span class="aspecto-mini-card">
                <span class="aspecto-mini-line-1"></span>
                <span class="aspecto-mini-line-2"></span>
              </span>
              <span class="aspecto-mini-btn"></span>
            </span>
            <div class="aspecto-card-info">
              <span class="aspecto-card-name">Claro</span>
              <span class="aspecto-card-desc">Fondo claro, mejor a pleno sol</span>
            </div>
          </button>
        </div>

        <!-- Switch tema del teléfono (Sistema) -->
        <div class="aspecto-system-row">
          <div class="aspecto-system-info">
            <span class="aspecto-system-label">Usar el tema del teléfono</span>
            <span class="aspecto-system-sub">Cambia solo entre claro y oscuro</span>
          </div>
          <button 
            type="button" 
            role="switch" 
            class="settings-switch" 
            id="switch-system-theme" 
            aria-checked="${isSystem ? 'true' : 'false'}"
            aria-label="Usar el tema del teléfono"
          >
            <span class="settings-switch-thumb"></span>
          </button>
        </div>
      </section>

      <!-- 2. COLOR DE ACENTO -->
      <section>
        <h2 class="aspecto-section-title">Color de acento</h2>
        <div class="aspecto-swatches">
          <!-- Amarillo -->
          <button 
            type="button" 
            class="aspecto-swatch-btn" 
            data-action="set-tema" 
            data-tema="amarillo" 
            aria-pressed="${activeTema === 'amarillo' ? 'true' : 'false'}"
            aria-label="Color Amarillo"
          >
            <span class="aspecto-swatch-ring">
              <span class="aspecto-swatch-circle is-amarillo">
                ${
                  activeTema === 'amarillo'
                    ? `<span class="aspecto-swatch-check">${icons.check({ size: 24, strokeWidth: 3.4 })}</span>`
                    : ''
                }
              </span>
            </span>
            <span class="aspecto-swatch-label">Amarillo</span>
          </button>

          <!-- Azul -->
          <button 
            type="button" 
            class="aspecto-swatch-btn" 
            data-action="set-tema" 
            data-tema="azul" 
            aria-pressed="${activeTema === 'azul' ? 'true' : 'false'}"
            aria-label="Color Azul"
          >
            <span class="aspecto-swatch-ring">
              <span class="aspecto-swatch-circle is-azul">
                ${
                  activeTema === 'azul'
                    ? `<span class="aspecto-swatch-check">${icons.check({ size: 24, strokeWidth: 3.4 })}</span>`
                    : ''
                }
              </span>
            </span>
            <span class="aspecto-swatch-label">Azul</span>
          </button>

          <!-- Rosado -->
          <button 
            type="button" 
            class="aspecto-swatch-btn" 
            data-action="set-tema" 
            data-tema="rosado" 
            aria-pressed="${activeTema === 'rosado' ? 'true' : 'false'}"
            aria-label="Color Rosado"
          >
            <span class="aspecto-swatch-ring">
              <span class="aspecto-swatch-circle is-rosado">
                ${
                  activeTema === 'rosado'
                    ? `<span class="aspecto-swatch-check">${icons.check({ size: 24, strokeWidth: 3.4 })}</span>`
                    : ''
                }
              </span>
            </span>
            <span class="aspecto-swatch-label">Rosado</span>
          </button>
        </div>
      </section>

      <!-- 3. VISTA PREVIA -->
      <section>
        <h2 class="aspecto-section-title">Vista previa</h2>
        <div class="aspecto-preview-card" id="aspecto-preview-box">
          <div class="aspecto-preview-ring-wrap">
            <span class="aspecto-preview-ring" aria-hidden="true"></span>
            <div>
              <span class="aspecto-preview-ring-title">Registrar</span>
              <span class="aspecto-preview-ring-sub">5 g · hoy</span>
            </div>
          </div>
          <div class="aspecto-preview-bar-track">
            <div class="aspecto-preview-bar-fill"></div>
          </div>
          <div class="aspecto-preview-btn" aria-hidden="true">
            Guardar serie
          </div>
        </div>
      </section>
    </div>
  `;

  // --- Handlers ---

  // 1. Selección directa de Modo (Oscuro o Claro)
  el.querySelectorAll('[data-action="set-modo"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const targetModo = btn.dataset.modo;
      await saveSettings({ modo: targetModo });
      applyModo(targetModo);
      toast(`Modo ${targetModo} activado`);
      await render(el);
    });
  });

  // 2. Switch sistema
  const systemSwitch = el.querySelector('#switch-system-theme');
  systemSwitch?.addEventListener('click', async () => {
    const nextIsSystem = !isSystem;
    const newModo = nextIsSystem ? 'sistema' : effectiveModo;
    await saveSettings({ modo: newModo });
    applyModo(newModo);
    toast(nextIsSystem ? 'Siguiendo el tema del teléfono' : `Fijado en modo ${effectiveModo}`);
    await render(el);
  });

  // 3. Selección de Color de Acento
  el.querySelectorAll('[data-action="set-tema"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const targetTema = btn.dataset.tema;
      if (targetTema === state.settings.tema) return;
      await saveSettings({ tema: targetTema });
      applyTema(targetTema);
      toast(`Color ${targetTema} activado`);
      await render(el);
    });
  });
}
