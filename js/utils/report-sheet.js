/* Hoja para reportar una respuesta de Bía: motivo obligatorio y comentario opcional.
 * Usa la misma hoja inferior que las listas (clases .picker-*). */
import { REPORT_REASONS } from '../services/bia/reports.js';
import { icons } from './icons.js';
import { bindSheetDrag } from './sheet-drag.js';

/** @returns {Promise<{ reason: string, note: string } | null>} null si se cierra sin enviar. */
export function openReportSheet() {
  return new Promise((resolve) => {
    let reason = '';
    const sheet = document.createElement('div');
    sheet.className = 'picker-sheet report-sheet';
    sheet.innerHTML = `
      <button type="button" class="picker-backdrop" aria-label="Cerrar"></button>
      <div class="picker-panel" role="dialog" aria-modal="true" aria-labelledby="report-title">
        <div class="picker-grabber" aria-hidden="true"><span></span></div>
        <div class="picker-head">
          <p class="picker-title" id="report-title">Reportar respuesta</p>
          <button type="button" class="picker-close" aria-label="Cerrar">${icons.x({ size: 18 })}</button>
        </div>
        <p class="report-sheet-intro">¿Qué tiene de malo esta respuesta de Bía?</p>
        <div class="picker-list report-sheet-reasons" role="listbox" aria-label="Motivo">
          ${REPORT_REASONS.map((r) => `
            <button type="button" class="picker-option" role="option" aria-selected="false" data-reason="${r.id}">
              <span class="picker-copy"><span class="picker-name">${r.label}</span></span>
              <span class="picker-mark" aria-hidden="true">${icons.check({ size: 18 })}</span>
            </button>`).join('')}
        </div>
        <label class="field report-sheet-note">
          <span>Comentario (opcional)</span>
          <input type="text" maxlength="500" autocomplete="off" placeholder="Qué pasó">
        </label>
        <button type="button" class="btn btn-primary btn-block" data-action="send" disabled>Enviar reporte</button>
      </div>
    `;
    document.body.append(sheet);
    document.body.classList.add('picker-open');
    requestAnimationFrame(() => sheet.classList.add('open'));

    const panel = sheet.querySelector('.picker-panel');
    const sendBtn = sheet.querySelector('[data-action="send"]');
    const noteInput = sheet.querySelector('.report-sheet-note input');

    let settled = false;
    const close = (result) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('hashchange', onRoute);
      sheet.classList.remove('open');
      setTimeout(() => {
        sheet.remove();
        if (!document.querySelector('.picker-sheet.open')) document.body.classList.remove('picker-open');
      }, 260);
      resolve(result);
    };
    const onRoute = () => close(null);
    window.addEventListener('hashchange', onRoute);

    sheet.querySelector('.picker-backdrop').addEventListener('click', () => close(null));
    sheet.querySelector('.picker-close').addEventListener('click', () => close(null));
    sheet.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(null); });
    sheet.querySelector('.report-sheet-reasons').addEventListener('click', (e) => {
      const opt = e.target.closest('[data-reason]');
      if (!opt) return;
      reason = opt.dataset.reason;
      sheet.querySelectorAll('[data-reason]').forEach((b) => b.setAttribute('aria-selected', String(b === opt)));
      sendBtn.disabled = false;
    });
    sendBtn.addEventListener('click', () => close({ reason, note: noteInput.value }));

    bindSheetDrag({
      sheet,
      panel,
      backdrop: sheet.querySelector('.picker-backdrop'),
      zones: [sheet.querySelector('.picker-grabber'), sheet.querySelector('.picker-head')],
      onClose: () => close(null),
    });
  });
}
