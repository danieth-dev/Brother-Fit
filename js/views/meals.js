/* Vista Tablero 20 · Comida de hoy (#/meals).
 * Diario completo de calorías y macronutrientes con anillo circular de progreso,
 * escáner IA por foto, integración con Fit y edición por comida. */

import { todayMealsSummary, getMealById } from '../services/meals.js';
import { triggerPhotoPicker, openMealResultSheet } from '../utils/meal-scanner.js';
import { saveSettings } from '../store.js';
import { delegate, esc, fmtNum, toast, go, num } from '../utils/dom.js';
import { formatMedium, todayISO } from '../utils/dates.js';
import { icons } from '../utils/icons.js';

const OBJETIVO_LABELS = {
  ganar: 'ganar masa',
  mantener: 'mantener peso',
  definir: 'definición',
};

function largeCalorieRingSvg(kcal, targetKcal) {
  const r = 76;
  const circ = 2 * Math.PI * r; // ~477.52
  const ratio = targetKcal > 0 ? Math.min(1, Math.max(0, kcal / targetKcal)) : 0;
  const dash = (ratio * circ).toFixed(1);
  const totalCirc = circ.toFixed(1);

  return `
    <svg width="170" height="170" viewBox="0 0 180 180" role="img" aria-label="${fmtNum(kcal)} de ${fmtNum(targetKcal)} kcal" class="meal-ring-svg">
      <circle cx="90" cy="90" r="${r}" fill="none" stroke="var(--line)" stroke-width="14"></circle>
      <circle cx="90" cy="90" r="${r}" fill="none" stroke="#10B981" stroke-width="14" stroke-linecap="round" stroke-dasharray="${dash} ${totalCirc}" transform="rotate(-90 90 90)"></circle>
      <text x="90" y="92" text-anchor="middle" fill="var(--text)" font-size="36" font-weight="800" font-family="Inter, system-ui, sans-serif">${fmtNum(kcal)}</text>
      <text x="90" y="114" text-anchor="middle" fill="var(--muted)" font-size="13" font-family="Inter, system-ui, sans-serif">de ${fmtNum(targetKcal)} kcal</text>
    </svg>
  `;
}

export async function render(el) {
  const summary = await todayMealsSummary(todayISO());
  const { meals, totals, targets, pct, remainingKcal, surplusKcal } = summary;
  const objText = OBJETIVO_LABELS[targets.objetivo] || 'ganar masa';

  el.innerHTML = `
    <div class="meals-head">
      <a class="head-back" href="#/" aria-label="Volver a Inicio">${icons.chevronLeft({ size: 24 })}</a>
      <div>
        <h1 class="meals-title">Comida</h1>
        <p class="meals-subtitle">Hoy · ${esc(formatMedium(todayISO()))}</p>
      </div>
    </div>

    <div class="meals-body">
      <!-- Tarjeta Principal de Calorías y Macros -->
      <div class="meals-hero-card">
        <div class="meals-hero-top">
          ${largeCalorieRingSvg(totals.kcal, targets.kcal)}
          <div class="meals-hero-info">
            <p class="meals-hero-kicker">${surplusKcal > 0 ? 'Meta alcanzada' : 'Te quedan'}</p>
            <p class="meals-hero-remaining">
              ${surplusKcal > 0 ? `+${fmtNum(surplusKcal)}` : fmtNum(remainingKcal)}
              <span class="meals-hero-unit">kcal</span>
            </p>
            <p class="meals-hero-note">
              Meta de ${esc(objText)}.
              <button type="button" class="meals-edit-goal-link" data-action="toggle-goal">Cambiar meta ›</button>
            </p>
          </div>
        </div>

        <!-- Editor rápido de metas nutricionales -->
        <form class="meals-goal-editor" id="meals-goal-form" hidden>
          <div class="meals-goal-grid">
            <label>
              <span>Calorías (kcal)</span>
              <input type="number" name="metaKcal" value="${targets.kcal}" min="1000" max="6000" step="50" />
            </label>
            <label>
              <span>Proteína (g)</span>
              <input type="number" name="metaProteina" value="${targets.proteina}" min="30" max="350" step="5" />
            </label>
            <label>
              <span>Carbohidratos (g)</span>
              <input type="number" name="metaCarbos" value="${targets.carbos}" min="30" max="700" step="10" />
            </label>
            <label>
              <span>Grasa (g)</span>
              <input type="number" name="metaGrasa" value="${targets.grasa}" min="20" max="250" step="5" />
            </label>
          </div>
          <div class="meals-goal-actions">
            <button type="button" class="btn btn-sm" data-action="toggle-goal">Cancelar</button>
            <button type="submit" class="btn btn-primary btn-sm">Guardar meta</button>
          </div>
        </form>

        <!-- Barras de Macronutrientes -->
        <div class="meals-macros-bars">
          <div class="meals-macro-item">
            <div class="meals-macro-head">
              <span class="meals-macro-name">Proteína</span>
              <span class="meals-macro-val">${fmtNum(totals.proteina)} <span class="meals-macro-target">/ ${fmtNum(targets.proteina)} g</span></span>
            </div>
            <div class="meals-macro-track">
              <div class="meals-macro-fill" style="width: ${pct.proteina}%; background: #4DB8FF"></div>
            </div>
          </div>

          <div class="meals-macro-item">
            <div class="meals-macro-head">
              <span class="meals-macro-name">Carbohidratos</span>
              <span class="meals-macro-val">${fmtNum(totals.carbos)} <span class="meals-macro-target">/ ${fmtNum(targets.carbos)} g</span></span>
            </div>
            <div class="meals-macro-track">
              <div class="meals-macro-fill" style="width: ${pct.carbos}%; background: #FF9F43"></div>
            </div>
          </div>

          <div class="meals-macro-item">
            <div class="meals-macro-head">
              <span class="meals-macro-name">Grasa</span>
              <span class="meals-macro-val">${fmtNum(totals.grasa)} <span class="meals-macro-target">/ ${fmtNum(targets.grasa)} g</span></span>
            </div>
            <div class="meals-macro-track">
              <div class="meals-macro-fill" style="width: ${pct.grasa}%; background: #B38CFF"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Botones de Acción -->
      <button type="button" class="meals-scan-primary-btn" data-action="scan-photo">
        ${icons.camera({ size: 24 })}
        Escanear comida
      </button>

      <div class="meals-secondary-actions">
        <button type="button" class="meals-sec-btn" data-action="ask-fit">
          ${icons.message({ size: 20 })}
          Decírselo a Fit
        </button>
        <button type="button" class="meals-sec-btn" data-action="add-manual">
          ${icons.plus({ size: 20 })}
          Añadir a mano
        </button>
      </div>

      <!-- Lista de Comidas del Día -->
      <section>
        <h2 class="meals-section-heading">Comidas de hoy</h2>
        ${meals.length ? `
          <div class="meals-list-card">
            ${meals.map((m) => `
              <button type="button" class="meals-list-row" data-action="edit-meal" data-id="${m.id}">
                <span class="meals-row-time">${esc(m.hora || '—')}</span>
                <span class="meals-row-main">
                  <span class="meals-row-title">${esc(m.nombre)}</span>
                  <span class="meals-row-sub">${esc(m.tipo || 'Comida')} · Proteína ${fmtNum(m.proteina)} g</span>
                </span>
                <span class="meals-row-kcal">${fmtNum(m.kcal)} <span class="meals-row-kcal-unit">kcal</span></span>
              </button>
            `).join('')}
          </div>
          <p class="meals-list-footnote">Son estimados. Toca una comida para ajustar porciones o borrarla.</p>
        ` : `
          <div class="meals-empty-card">
            <p class="meals-empty-title">Todavía no has registrado comidas hoy</p>
            <p class="meals-empty-sub">Escanea tu plato con una foto, díselo a Fit o añade alimentos manualmente.</p>
          </div>
        `}
      </section>
    </div>
  `;

  const goalForm = el.querySelector('#meals-goal-form');
  if (goalForm) {
    goalForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(goalForm);
      const metaKcal = Math.max(800, Math.round(num(fd.get('metaKcal')) || 2400));
      const metaProteina = Math.max(30, Math.round(num(fd.get('metaProteina')) || 120));
      const metaCarbos = Math.max(30, Math.round(num(fd.get('metaCarbos')) || 300));
      const metaGrasa = Math.max(20, Math.round(num(fd.get('metaGrasa')) || 80));
      await saveSettings({ metaKcal, metaProteina, metaCarbos, metaGrasa });
      toast('Meta nutricional actualizada');
      await render(el);
    });
  }

  delegate(el, {
    'toggle-goal': () => {
      if (goalForm) goalForm.hidden = !goalForm.hidden;
    },
    'scan-photo': () => {
      triggerPhotoPicker({
        onSaved: () => render(el),
      });
    },
    'add-manual': () => {
      openMealResultSheet({
        manualMode: false,
        onSaved: () => render(el),
      });
    },
    'ask-fit': () => {
      sessionStorage.setItem('brother_fit_prefill_prompt', 'Anótame esta comida: ');
      go('/agent');
    },
    'edit-meal': async (btn) => {
      const meal = await getMealById(btn.dataset.id);
      if (!meal) return;
      openMealResultSheet({
        existingMeal: meal,
        onSaved: () => render(el),
      });
    },
  });
}
