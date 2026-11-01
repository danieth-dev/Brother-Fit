/* Hoja / Modal de Escaneo y Edición de Comida (Tablero 21: Foto → resultado).
 * Permite:
 * 1. Tomar o elegir foto (comprimida en memoria, sin guardar imagen en IndexedDB).
 * 2. Ver el desglose de alimentos detectados por IA o añadidos a mano.
 * 3. Ajustar gramos con − / + recalculando kcal y macros en tiempo real.
 * 4. Añadir alimentos faltantes desde el catálogo rápido o escribiendo nombre y gramos.
 * 5. Elegir comida (Desayuno, Almuerzo, Merienda, Cena) y guardar en el día. */

import {
  MEAL_TYPES,
  COMMON_FOODS,
  defaultMealTypeByHour,
  stepForGrams,
  recalcItemGrams,
  buildItemFromCatalog,
  summarizeItems,
  buildMealTitle,
  compressImageFile,
  analyzeMealImage,
  analyzeMealText,
  saveMeal,
  deleteMeal,
  getDemoPhotoResult,
} from '../services/meals.js';
import { esc, fmtNum, toast } from './dom.js';
import { icons } from './icons.js';

let activeOverlay = null;

function revokeIfNeeded(url) {
  if (url && url.startsWith('blob:')) {
    try { URL.revokeObjectURL(url); } catch { /* ignore */ }
  }
}

/* Abre el selector nativo de archivo/cámara o abre directamente la hoja de resultado. */
export function triggerPhotoPicker({ onSaved, defaultTipo } = {}) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.style.display = 'none';
  document.body.appendChild(input);

  let handled = false;
  const cleanup = () => {
    setTimeout(() => input.remove(), 500);
  };

  input.addEventListener('change', async () => {
    handled = true;
    const file = input.files?.[0];
    cleanup();
    if (!file) return;
    await openMealResultSheet({ file, onSaved, defaultTipo });
  });

  input.click();
}

/* Abre la hoja Tablero 21 ("Foto → resultado" o "Añadir / Editar comida"). */
export async function openMealResultSheet({
  file = null,
  existingMeal = null,
  initialResult = null,
  manualMode = false,
  defaultTipo = null,
  onSaved = null,
} = {}) {
  if (activeOverlay) {
    activeOverlay.remove();
    activeOverlay = null;
  }

  let previewUrl = null;
  let isAnalyzing = Boolean(file);
  let selectedTipo = existingMeal?.tipo || defaultTipo || defaultMealTypeByHour();
  if (!MEAL_TYPES.includes(selectedTipo)) selectedTipo = 'Almuerzo';

  let items = [];
  let customPlatoName = existingMeal?.nombre || '';
  let showAddForm = Boolean(manualMode && !existingMeal && !initialResult && !file);

  if (existingMeal) {
    items = (existingMeal.items && existingMeal.items.length)
      ? existingMeal.items.map((i) => recalcItemGrams(i, i.gramos))
      : [
          recalcItemGrams(
            {
              nombre: existingMeal.nombre || 'Plato registrado',
              gramos: 250,
              kcal: existingMeal.kcal,
              proteina: existingMeal.proteina,
              carbos: existingMeal.carbos,
              grasa: existingMeal.grasa,
            },
            250
          ),
        ];
  } else if (initialResult) {
    items = (initialResult.items || []).map((i) => recalcItemGrams(i, i.gramos));
    customPlatoName = initialResult.plato || '';
  } else if (!file && !manualMode) {
    const demo = getDemoPhotoResult();
    items = demo.items;
    customPlatoName = demo.plato;
  }

  const overlay = document.createElement('div');
  overlay.className = 'meal-sheet-backdrop';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Resultado de comida');
  activeOverlay = overlay;

  const closeSheet = () => {
    revokeIfNeeded(previewUrl);
    overlay.remove();
    if (activeOverlay === overlay) activeOverlay = null;
  };

  const renderHeroPlate = () => {
    if (previewUrl) {
      return `
        <div class="meal-photo-hero">
          <img src="${esc(previewUrl)}" alt="Foto del plato" class="meal-photo-img" />
          <div class="meal-photo-frame" aria-hidden="true"></div>
          ${isAnalyzing ? `
            <div class="meal-photo-scanning">
              <div class="meal-scan-spinner"></div>
              <span>Fit está analizando tu plato…</span>
            </div>
          ` : ''}
        </div>
      `;
    }
    return `
      <div class="meal-photo-hero meal-photo-hero--art" aria-hidden="true">
        <div class="meal-plate-art">
          <span class="meal-plate-item meal-plate-item--rice"></span>
          <span class="meal-plate-item meal-plate-item--protein"></span>
          <span class="meal-plate-item meal-plate-item--veg"></span>
        </div>
        <div class="meal-photo-frame"></div>
        ${isAnalyzing ? `
          <div class="meal-photo-scanning">
            <div class="meal-scan-spinner"></div>
            <span>Fit está analizando tu plato…</span>
          </div>
        ` : ''}
      </div>
    `;
  };

  const renderItemsAndTotals = () => {
    const listEl = overlay.querySelector('#meal-items-list');
    const totalsEl = overlay.querySelector('#meal-totals-box');
    const saveBtn = overlay.querySelector('#btn-save-meal');

    if (listEl) {
      if (isAnalyzing) {
        listEl.innerHTML = `
          <div style="padding: 28px 16px; text-align: center; color: var(--muted); font-size: 14px">
            Detectando ingredientes y calculando porciones…
          </div>
        `;
      } else if (!items.length) {
        listEl.innerHTML = `
          <div style="padding: 24px 16px; text-align: center; color: var(--muted); font-size: 14px">
            Aún no hay alimentos en el plato. Pulsa «Añadir alimento que falta» abajo.
          </div>
        `;
      } else {
        listEl.innerHTML = items.map((it, idx) => `
          <div class="meal-item-row" data-idx="${idx}">
            <span class="meal-item-name">${esc(it.nombre)}</span>
            <span class="meal-item-stepper">
              <button type="button" class="meal-step-btn" data-action="step-item" data-idx="${idx}" data-dir="-1" aria-label="Menos ${esc(it.nombre)}">−</button>
              <span class="meal-item-grams">${fmtNum(it.gramos)} g</span>
              <button type="button" class="meal-step-btn" data-action="step-item" data-idx="${idx}" data-dir="1" aria-label="Más ${esc(it.nombre)}">+</button>
            </span>
            <span class="meal-item-kcal">${fmtNum(it.kcal)} <span class="meal-item-kcal-unit">kcal</span></span>
          </div>
        `).join('');
      }
    }

    const totals = summarizeItems(items);
    if (totalsEl) {
      totalsEl.innerHTML = `
        <span>
          <span class="meal-total-label">Total</span>
          <span class="meal-total-kcal">${fmtNum(totals.kcal)} <span class="meal-total-kcal-unit">kcal</span></span>
        </span>
        <span class="meal-total-macros">
          <span class="meal-macro-line"><span class="meal-macro-dot" style="background: #4DB8FF"></span>Proteína ${fmtNum(totals.proteina)} g</span>
          <span class="meal-macro-line"><span class="meal-macro-dot" style="background: #FF9F43"></span>Carbohidratos ${fmtNum(totals.carbos)} g</span>
          <span class="meal-macro-line"><span class="meal-macro-dot" style="background: #B38CFF"></span>Grasa ${fmtNum(totals.grasa)} g</span>
        </span>
      `;
    }

    if (saveBtn) {
      saveBtn.disabled = isAnalyzing || items.length === 0;
      saveBtn.textContent = existingMeal
        ? `Guardar cambios en ${selectedTipo}`
        : `Guardar en ${selectedTipo}`;
    }
  };

  const renderFull = () => {
    overlay.innerHTML = `
      <div class="meal-sheet-modal">
        <div id="meal-hero-slot">
          ${renderHeroPlate()}
        </div>

        <div class="meal-photo-topbar">
          <button type="button" class="meal-topbar-close" data-action="close" aria-label="Cerrar">
            ${icons.close({ size: 22 })}
          </button>
          <button type="button" class="meal-topbar-retake" data-action="retake">
            ${previewUrl ? 'Repetir foto' : 'Subir foto'}
          </button>
        </div>

        <div class="meal-sheet-body">
          <div class="meal-sheet-handle" aria-hidden="true"></div>

          <div class="meal-sheet-head">
            <h1 class="meal-sheet-title">${existingMeal ? 'Editar comida' : 'Esto es lo que veo'}</h1>
            <span class="meal-est-badge">
              ${icons.info({ size: 14 })}
              Estimado · revisa porciones
            </span>
          </div>

          <div class="meal-type-pills" role="group" aria-label="Momento de la comida">
            ${MEAL_TYPES.map((t) => `
              <button type="button" class="meal-type-pill" data-action="select-type" data-tipo="${esc(t)}" aria-pressed="${t === selectedTipo}">
                ${esc(t)}
              </button>
            `).join('')}
          </div>

          <div class="meal-items-card" id="meal-items-list"></div>

          <button type="button" class="meal-add-missing-btn" data-action="toggle-add-food">
            ${icons.plus({ size: 18 })}
            Añadir alimento que falta
          </button>

          <div class="meal-add-drawer" id="meal-add-drawer" ${showAddForm ? '' : 'hidden'}>
            <div class="meal-add-quick-chips">
              ${COMMON_FOODS.slice(0, 10).map((f, i) => `
                <button type="button" class="meal-quick-food-chip" data-action="quick-food" data-food-idx="${i}">
                  + ${esc(f.nombre)} (${f.porcion}g)
                </button>
              `).join('')}
            </div>
            <div class="meal-add-custom-row">
              <input type="text" id="meal-custom-input" class="meal-custom-input" placeholder="Ej: 2 huevos revueltos o 150g salmón…" autocomplete="off" />
              <button type="button" class="meal-custom-add-btn" data-action="add-custom-text">Añadir</button>
            </div>
          </div>

          <div class="meal-total-card" id="meal-totals-box"></div>

          ${existingMeal ? `
            <button type="button" class="meal-delete-btn" data-action="delete-meal">
              ${icons.trash({ size: 16 })} Eliminar esta comida del día
            </button>
          ` : ''}
        </div>

        <div class="meal-sheet-footer">
          <button type="button" class="meal-save-btn" id="btn-save-meal" data-action="save-meal">
            Guardar en ${esc(selectedTipo)}
          </button>
        </div>
      </div>
    `;
    renderItemsAndTotals();
  };

  renderFull();
  document.body.appendChild(overlay);

  // Si recibimos un archivo de foto, comprimirlo y analizarlo con IA
  if (file) {
    try {
      const compressed = await compressImageFile(file);
      previewUrl = compressed.previewUrl;
      const heroSlot = overlay.querySelector('#meal-hero-slot');
      if (heroSlot) heroSlot.innerHTML = renderHeroPlate();

      const result = await analyzeMealImage({
        base64: compressed.base64,
        mimeType: compressed.mimeType,
      });
      isAnalyzing = false;
      items = (result.items || []).map((i) => recalcItemGrams(i, i.gramos));
      customPlatoName = result.plato || '';
      if (heroSlot) heroSlot.innerHTML = renderHeroPlate();
      renderItemsAndTotals();
      if (result.isDemo) {
        toast('Modo estimado local (configura tu API Key en Fit para visión IA real)');
      }
    } catch (err) {
      console.warn('Error al analizar imagen:', err);
      isAnalyzing = false;
      const demo = getDemoPhotoResult();
      items = demo.items;
      customPlatoName = demo.plato;
      const heroSlot = overlay.querySelector('#meal-hero-slot');
      if (heroSlot) heroSlot.innerHTML = renderHeroPlate();
      renderItemsAndTotals();
      toast('No se pudo conectar con la IA; puedes ajustar el plato manualmente');
    }
  }

  overlay.addEventListener('click', async (e) => {
    if (e.target === overlay) {
      closeSheet();
      return;
    }
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === 'close') {
      closeSheet();
      return;
    }

    if (action === 'retake') {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.style.display = 'none';
      document.body.appendChild(fileInput);
      fileInput.addEventListener('change', async () => {
        const nextFile = fileInput.files?.[0];
        fileInput.remove();
        if (!nextFile) return;
        revokeIfNeeded(previewUrl);
        isAnalyzing = true;
        renderItemsAndTotals();
        try {
          const compressed = await compressImageFile(nextFile);
          previewUrl = compressed.previewUrl;
          const heroSlot = overlay.querySelector('#meal-hero-slot');
          if (heroSlot) heroSlot.innerHTML = renderHeroPlate();
          const result = await analyzeMealImage({
            base64: compressed.base64,
            mimeType: compressed.mimeType,
          });
          isAnalyzing = false;
          items = (result.items || []).map((i) => recalcItemGrams(i, i.gramos));
          customPlatoName = result.plato || '';
          if (heroSlot) heroSlot.innerHTML = renderHeroPlate();
          renderItemsAndTotals();
        } catch {
          isAnalyzing = false;
          renderItemsAndTotals();
        }
      });
      fileInput.click();
      return;
    }

    if (action === 'select-type') {
      selectedTipo = btn.dataset.tipo || 'Almuerzo';
      overlay.querySelectorAll('.meal-type-pill').forEach((p) => {
        p.setAttribute('aria-pressed', String(p.dataset.tipo === selectedTipo));
      });
      renderItemsAndTotals();
      return;
    }

    if (action === 'step-item') {
      const idx = Number(btn.dataset.idx);
      const dir = Number(btn.dataset.dir);
      const item = items[idx];
      if (!item) return;
      const step = stepForGrams(item.gramos);
      const nextGrams = Math.max(0, item.gramos + dir * step);
      if (nextGrams === 0) {
        items.splice(idx, 1);
      } else {
        items[idx] = recalcItemGrams(item, nextGrams);
      }
      customPlatoName = '';
      renderItemsAndTotals();
      return;
    }

    if (action === 'toggle-add-food') {
      const drawer = overlay.querySelector('#meal-add-drawer');
      if (drawer) {
        drawer.hidden = !drawer.hidden;
        if (!drawer.hidden) {
          overlay.querySelector('#meal-custom-input')?.focus();
        }
      }
      return;
    }

    if (action === 'quick-food') {
      const fIdx = Number(btn.dataset.foodIdx);
      const food = COMMON_FOODS[fIdx];
      if (!food) return;
      const existingIdx = items.findIndex((i) => i.nombre.toLowerCase() === food.nombre.toLowerCase());
      if (existingIdx >= 0) {
        const cur = items[existingIdx];
        items[existingIdx] = recalcItemGrams(cur, cur.gramos + food.porcion);
      } else {
        items.push(buildItemFromCatalog(food));
      }
      customPlatoName = '';
      renderItemsAndTotals();
      return;
    }

    if (action === 'add-custom-text') {
      const input = overlay.querySelector('#meal-custom-input');
      const val = (input?.value || '').trim();
      if (!val) return;
      btn.disabled = true;
      btn.textContent = '…';
      try {
        const parsed = await analyzeMealText(val);
        if (parsed?.items?.length) {
          for (const newIt of parsed.items) {
            items.push(recalcItemGrams(newIt, newIt.gramos));
          }
          customPlatoName = '';
          if (input) input.value = '';
          renderItemsAndTotals();
        }
      } finally {
        btn.disabled = false;
        btn.textContent = 'Añadir';
      }
      return;
    }

    if (action === 'delete-meal' && existingMeal?.id != null) {
      await deleteMeal(existingMeal.id);
      closeSheet();
      toast('Comida eliminada');
      if (typeof onSaved === 'function') await onSaved();
      return;
    }

    if (action === 'save-meal') {
      if (!items.length) return;
      btn.disabled = true;
      const title = customPlatoName || buildMealTitle(items, selectedTipo);
      await saveMeal({
        id: existingMeal?.id,
        fecha: existingMeal?.fecha,
        ts: existingMeal?.ts,
        hora: existingMeal?.hora,
        tipo: selectedTipo,
        nombre: title,
        items,
        origen: previewUrl ? 'foto' : (existingMeal?.origen || 'manual'),
      });
      closeSheet();
      toast(`Guardado en ${selectedTipo}`);
      if (typeof onSaved === 'function') await onSaved();
    }
  });
}
