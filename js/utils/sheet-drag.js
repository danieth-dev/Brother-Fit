/**
 * sheet-drag.js - Soporte nativo de arrastrar hacia abajo para cerrar (pull-to-close).
 * Añade interacción táctil fluida a cualquier bottom sheet o modal con barrita superior.
 */

export function bindSheetDrag({ sheet, panel, backdrop, zones, onClose }) {
  if (!panel) return;
  const targetZones = (zones || []).filter(Boolean);
  if (!targetZones.length) return;

  let startY = 0, lastY = 0, lastT = 0, velocity = 0, dragging = false, pointerId = null;

  const reset = () => {
    panel.style.transition = '';
    panel.style.transform = '';
    if (backdrop) {
      backdrop.style.transition = '';
      backdrop.style.opacity = '';
    }
  };

  const onDown = (e) => {
    if (e.button > 0) return;
    if (e.target.closest('button:not(.agent-sheet-drag):not(.picker-grabber):not(.confirm-grabber), input, select, textarea, a')) return;

    dragging = true;
    pointerId = e.pointerId;
    startY = lastY = e.clientY;
    lastT = e.timeStamp;
    velocity = 0;
    try {
      e.currentTarget.setPointerCapture(pointerId);
    } catch (_) {}
    panel.style.transition = 'none';
    if (backdrop) backdrop.style.transition = 'none';
  };

  const onMove = (e) => {
    if (!dragging || (pointerId != null && e.pointerId !== pointerId)) return;
    const raw = e.clientY - startY;
    // Resistencia elástica hacia arriba (raw / 6), seguimiento libre hacia abajo
    const dy = raw > 0 ? raw : raw / 6;
    const dt = Math.max(1, e.timeStamp - lastT);
    velocity = (e.clientY - lastY) / dt;
    lastY = e.clientY;
    lastT = e.timeStamp;

    panel.style.transform = `translateY(${dy}px)`;
    if (backdrop) {
      const h = panel.offsetHeight || 1;
      backdrop.style.opacity = String(Math.max(0, 1 - Math.max(0, dy) / h));
    }
  };

  const onUp = (e) => {
    if (!dragging || (pointerId != null && e.pointerId !== pointerId)) return;
    dragging = false;
    const dy = e.clientY - startY;
    const h = panel.offsetHeight || 1;
    const shouldClose = dy > Math.min(130, h * 0.28) || (velocity > 0.45 && dy > 25);

    if (!shouldClose) {
      panel.style.transition = 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
      if (backdrop) {
        backdrop.style.transition = 'opacity 0.2s ease';
        backdrop.style.opacity = '1';
      }
      panel.style.transform = 'translateY(0)';
      setTimeout(reset, 220);
      return;
    }

    panel.style.transition = 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)';
    panel.style.transform = `translateY(${h}px)`;
    if (backdrop) {
      backdrop.style.transition = 'opacity 0.22s ease';
      backdrop.style.opacity = '0';
    }
    setTimeout(() => {
      reset();
      onClose?.({ immediate: true });
    }, 220);
  };

  for (const z of targetZones) {
    z.style.touchAction = 'none';
    z.style.cursor = 'grab';
    z.addEventListener('pointerdown', onDown);
    z.addEventListener('pointermove', onMove);
    z.addEventListener('pointerup', onUp);
    z.addEventListener('pointercancel', onUp);
  }
}
