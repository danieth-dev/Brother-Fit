/* La lista de mensajes del chat: burbujas, historial y «Reportar respuesta».
 * Tocar una respuesta de Bía muestra «Reportar respuesta»: la política de Play pide poder
 * marcar contenido de IA ofensivo o dañino sin salir de la app. */
import { saveAiReport, reportMailtoUrl } from '../../services/bia/reports.js';
import { openReportSheet } from '../../utils/report-sheet.js';
import { icons } from '../../utils/icons.js';
import { toast } from '../../utils/dom.js';

/* Margen para leer el aviso antes de que se abra el correo. */
const MAILTO_DELAY_MS = 600;

export function createMessageList(msgsEl) {
  const scrollDown = () => { msgsEl.scrollTop = msgsEl.scrollHeight; };

  function append(role, text, id) {
    const div = document.createElement('div');
    div.className = `agent-bubble agent-bubble-${role}`;
    if (id) div.id = id;
    if (role === 'bot') {
      div.tabIndex = 0;
      div.title = 'Toca para reportar esta respuesta';
    }
    div.textContent = text;
    msgsEl.appendChild(div);
    scrollDown();
    return div;
  }

  function appendNode(node) {
    msgsEl.appendChild(node);
    scrollDown();
  }

  function paintHistory(list = []) {
    const badge = document.createElement('span');
    badge.className = 'agent-date-badge';
    badge.textContent = 'Hoy';
    msgsEl.replaceChildren(badge);
    for (const m of list) append(m.role, m.text);
  }

  function toggleActions(bubble) {
    const next = bubble.nextElementSibling;
    if (next?.classList.contains('agent-bubble-actions')) {
      next.remove();
      return;
    }
    msgsEl.querySelectorAll('.agent-bubble-actions').forEach((n) => n.remove());
    if (bubble.classList.contains('is-reported')) return;
    const actions = document.createElement('div');
    actions.className = 'agent-bubble-actions';
    actions.innerHTML = `<button type="button" class="agent-bubble-report" data-action="report-bubble">${icons.flag({ size: 16 })} Reportar respuesta</button>`;
    bubble.after(actions);
  }

  async function report(bubble) {
    const choice = await openReportSheet();
    if (!choice) return;
    try {
      const saved = await saveAiReport({ text: bubble.textContent, ...choice });
      bubble.classList.add('is-reported');
      const next = bubble.nextElementSibling;
      if (next?.classList.contains('agent-bubble-actions')) next.remove();
      const mailto = reportMailtoUrl(saved);
      toast(mailto ? 'Reporte guardado. Se abrirá tu correo para enviarlo.' : 'Reporte guardado. Gracias por avisar.');
      if (mailto) setTimeout(() => { window.location.href = mailto; }, MAILTO_DELAY_MS);
    } catch (err) {
      toast(err.message || 'No se pudo guardar el reporte.', { tone: 'danger' });
    }
  }

  return { append, appendNode, paintHistory, toggleActions, report, scrollDown };
}
