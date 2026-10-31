/**
 * components.js — Componentes reutilizables de UI compartidos entre vistas.
 * Evitan la duplicacion de HTML entre vistas que renderizan los mismos elementos.
 */
import { icons } from './icons.js';
import { fmtNum, esc } from './dom.js';

/**
 * Renderiza el disco olimpico de creatina (reutilizado en home y creatine).
 *
 * @param {Object} cr      - Resultado de creatineSummary()
 * @param {number} g       - Gramos configurados por el usuario
 * @param {string} action  - Valor de data-action del boton (ej: 'creatine' | 'log')
 * @param {string} caption - HTML de la leyenda bajo el disco (libre por vista)
 * @param {Object} [opts]
 * @param {string|null} [opts.brand='CREATINA'] - Texto superior de marca ('CREATINA' en inicio; null para omitir).
 * @param {boolean} [opts.showGrams=true]      - Si muestra la linea inferior con gramos ("5 g hoy").
 * @param {boolean} [opts.showSat=false]        - Muestra el % de saturacion como senal secundaria.
 * @param {string} [opts.pendingLabel='Registrar'] - Texto central cuando falta la toma.
 * @param {string} [opts.doneLabel='Tomada']       - Texto central cuando ya esta tomada.
 */
export function creatinePlate(cr, g, action, caption, {
  brand = 'CREATINA',
  showGrams = true,
  showSat = false,
  pendingLabel = 'Registrar',
  doneLabel = 'Tomada',
} = {}) {
  const done = cr.tomadaHoy;
  const sat = cr.saturacion?.porcentajeSaturacion;
  const satHtml = showSat && sat != null
    ? `<span class="plate-sat num">${sat}% sat</span>`
    : '';
  const brandHtml = brand
    ? `<span class="plate-brand">${esc(brand)}</span>`
    : '';
  const gramsHtml = showGrams
    ? `<small class="num">${fmtNum(g)} g hoy</small>`
    : '';
  const cleanClass = (!brand && !showGrams) ? 'plate--clean' : '';

  return `
    <div class="plate-wrapper">
      <button class="plate ${done ? 'done' : ''} ${cleanClass}" data-action="${action}" type="button"
        aria-label="${done ? 'Quitar toma de creatina de hoy' : 'Registrar toma de creatina'}">
        ${brandHtml}
        <b>${done ? `${icons.check({ size: 20 })} ${esc(doneLabel)}` : esc(pendingLabel)}</b>
        ${gramsHtml}
        ${satHtml}
      </button>
      <div class="plate-caption">${caption}</div>
    </div>
  `;
}
