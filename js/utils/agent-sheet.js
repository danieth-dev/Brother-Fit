/* Hoja de los paneles de Bía (Recuerdos, Conexión): la crea con su barrita, título y botón
 * de cerrar, la abre, la cierra tocando el fondo o arrastrando, y la quita del documento. */
import { icons } from './icons.js';
import { bindSheetDrag } from './sheet-drag.js';

/* Margen para que termine la animación de salida antes de quitar la hoja. */
const CLOSE_FALLBACK_MS = 260;

/** { title, subtitle, body } → { sheet, close }. body es HTML ya escapado. */
export function openAgentSheet({ title, subtitle, body }) {
  const sheet = document.createElement('div');
  sheet.className = 'agent-sheet';
  sheet.innerHTML = `
    <div class="agent-sheet-inner">
      <div class="agent-sheet-drag" aria-hidden="true"></div>
      <div class="agent-sheet-head">
        <div class="agent-sheet-head-titles">
          <h2>${title}</h2>
          <p>${subtitle}</p>
        </div>
        <button class="agent-sheet-close" type="button" aria-label="Cerrar">
          ${icons.close({ size: 22 })}
        </button>
      </div>
      ${body}
    </div>`;
  document.body.appendChild(sheet);
  requestAnimationFrame(() => sheet.classList.add('open'));

  const close = ({ immediate = false } = {}) => {
    sheet.classList.remove('open');
    if (immediate) {
      sheet.remove();
      return;
    }
    sheet.addEventListener('transitionend', () => sheet.remove(), { once: true });
    setTimeout(() => sheet.remove(), CLOSE_FALLBACK_MS);
  };

  sheet.querySelector('.agent-sheet-close').addEventListener('click', () => close());
  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) close();
  });
  bindSheetDrag({
    sheet,
    panel: sheet.querySelector('.agent-sheet-inner'),
    backdrop: sheet,
    zones: [sheet.querySelector('.agent-sheet-drag'), sheet.querySelector('.agent-sheet-head')],
    onClose: () => close({ immediate: true }),
  });
  return { sheet, close };
}
