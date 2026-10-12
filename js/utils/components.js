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
 */
export function creatinePlate(cr, g, action, caption) {
  const done = cr.tomadaHoy;
  return `
    <div class="plate-wrapper">
      <button class="plate ${done ? 'done' : ''}" data-action="${action}" type="button"
        aria-label="${done ? 'Creatina registrada hoy' : 'Registrar toma de creatina'}">
        <span class="plate-brand">BROTHER FIT</span>
        <b>${done ? `${icons.check({ size: 20 })} Tomada` : 'Registrar'}</b>
        <small class="num">${fmtNum(g)} g hoy</small>
      </button>
      <div class="plate-caption">${caption}</div>
    </div>
  `;
}
