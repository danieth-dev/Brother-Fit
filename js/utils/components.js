/**
 * components.js — Componentes reutilizables de UI compartidos entre vistas.
 * Evitan la duplicacion de HTML entre vistas que renderizan los mismos elementos.
 */
import { icons } from './icons.js';
import { fmtNum } from './dom.js';

/**
 * Renderiza el disco olimpico de creatina (reutilizado en home y creatine).
 * @param {Object} cr      - Resultado de creatineSummary()
 * @param {number} g       - Gramos configurados por el usuario
 * @param {string} action  - Valor de data-action del boton (ej: 'creatine' | 'log')
 * @param {string} caption - HTML de la leyenda bajo el disco (libre por vista)
 * @param {{ showSat?: boolean }} [opts] - En Creatina, showSat muestra % sat como señal secundaria (no sustituye Registrar/Tomada)
 */
export function creatinePlate(cr, g, action, caption, { showSat = false } = {}) {
  const done = cr.tomadaHoy;
  const sat = cr.saturacion?.porcentajeSaturacion;
  const satHtml = showSat && sat != null
    ? `<span class="plate-sat num">${sat}% sat</span>`
    : '';
  return `
    <div class="plate-wrapper">
      <button class="plate ${done ? 'done' : ''}" data-action="${action}" type="button"
        aria-label="${done ? 'Quitar toma de creatina de hoy' : 'Registrar toma de creatina'}">
        <span class="plate-brand">BROTHER FIT</span>
        <b>${done ? `${icons.check({ size: 20 })} Tomada` : 'Registrar'}</b>
        <small class="num">${fmtNum(g)} g hoy</small>
        ${satHtml}
      </button>
      <div class="plate-caption">${caption}</div>
    </div>
  `;
}
