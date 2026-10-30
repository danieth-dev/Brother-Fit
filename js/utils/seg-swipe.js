/* Pastilla amarilla del .seg: se arrastra con el dedo y al soltar encaja.
 * Un toque (también con un poco de temblor) sigue eligiendo la opción. */

const BOUND = new WeakSet();
const AXIS_SLOP = 8;
const DRAG_MIN = 18; /* por debajo = toque; el clic nativo elige */

function buttonsOf(seg) {
  return [...seg.querySelectorAll(':scope > button')].filter((b) => !b.disabled);
}

function activeIndex(btns) {
  const i = btns.findIndex((b) => b.getAttribute('aria-pressed') === 'true');
  return i >= 0 ? i : 0;
}

function ensureThumb(seg) {
  let thumb = seg.querySelector(':scope > .seg-thumb');
  if (!thumb) {
    thumb = document.createElement('span');
    thumb.className = 'seg-thumb';
    thumb.setAttribute('aria-hidden', 'true');
    seg.prepend(thumb);
  }
  return thumb;
}

export function syncSegThumb(seg) {
  if (!(seg instanceof HTMLElement) || !seg.classList.contains('seg')) return;
  const thumb = ensureThumb(seg);
  const btns = buttonsOf(seg);
  const active = btns.find((b) => b.getAttribute('aria-pressed') === 'true') || btns[0];
  if (!active) {
    thumb.hidden = true;
    return;
  }
  if (!seg.isConnected || active.offsetWidth === 0) {
    requestAnimationFrame(() => {
      if (seg.isConnected && active.offsetWidth > 0) syncSegThumb(seg);
    });
    return;
  }
  thumb.hidden = false;
  thumb.style.width = `${active.offsetWidth}px`;
  thumb.style.height = `${active.offsetHeight}px`;
  thumb.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
}

function placeThumb(seg, x, y, w, h) {
  const thumb = ensureThumb(seg);
  thumb.hidden = false;
  thumb.style.width = `${w}px`;
  thumb.style.height = `${h}px`;
  thumb.style.transform = `translate(${x}px, ${y}px)`;
}

function centers(btns) {
  return btns.map((b) => ({
    x: b.offsetLeft + b.offsetWidth / 2,
    y: b.offsetTop + b.offsetHeight / 2,
    w: b.offsetWidth,
    h: b.offsetHeight,
    left: b.offsetLeft,
    top: b.offsetTop,
  }));
}

/* Más de una fila (p. ej. métricas en Progreso). */
function isWrapped(btns) {
  if (btns.length < 2) return false;
  const top0 = btns[0].offsetTop;
  return btns.some((b) => b.offsetTop !== top0);
}

function nearestIndex(btns, centerX, centerY = null) {
  let best = 0;
  let bestDist = Infinity;
  const pts = centers(btns);
  pts.forEach((p, i) => {
    const d = centerY == null
      ? Math.abs(p.x - centerX)
      : Math.hypot(p.x - centerX, p.y - centerY);
    if (d < bestDist) { bestDist = d; best = i; }
  });
  return best;
}

function thumbLayout(btns, centerX, centerY = null) {
  if (!btns.length) return null;
  if (btns.length === 1) {
    const b = btns[0];
    return { x: b.offsetLeft, y: b.offsetTop, w: b.offsetWidth, h: b.offsetHeight };
  }

  /* Varias filas: pastilla bajo el dedo, tamaño de la opción más cercana. */
  if (centerY != null && isWrapped(btns)) {
    const idx = nearestIndex(btns, centerX, centerY);
    const b = btns[idx];
    const halfW = b.offsetWidth / 2;
    const halfH = b.offsetHeight / 2;
    const xs = centers(btns).map((p) => p.x);
    const ys = centers(btns).map((p) => p.y);
    const cx = Math.min(Math.max(...xs), Math.max(Math.min(...xs), centerX));
    const cy = Math.min(Math.max(...ys), Math.max(Math.min(...ys), centerY));
    return { x: cx - halfW, y: cy - halfH, w: b.offsetWidth, h: b.offsetHeight };
  }

  const first = btns[0];
  const last = btns[btns.length - 1];
  const minC = first.offsetLeft + first.offsetWidth / 2;
  const maxC = last.offsetLeft + last.offsetWidth / 2;
  const c = Math.min(maxC, Math.max(minC, centerX));

  for (let i = 0; i < btns.length - 1; i++) {
    const a = btns[i];
    const b = btns[i + 1];
    const am = a.offsetLeft + a.offsetWidth / 2;
    const bm = b.offsetLeft + b.offsetWidth / 2;
    if (c >= am && c <= bm) {
      const t = (c - am) / (bm - am || 1);
      const w = a.offsetWidth + (b.offsetWidth - a.offsetWidth) * t;
      const h = a.offsetHeight + (b.offsetHeight - a.offsetHeight) * t;
      const mid = am + (bm - am) * t;
      return { x: mid - w / 2, y: a.offsetTop + (b.offsetTop - a.offsetTop) * t, w, h };
    }
  }
  const edge = c <= minC ? first : last;
  return { x: edge.offsetLeft, y: edge.offsetTop, w: edge.offsetWidth, h: edge.offsetHeight };
}

function bindSeg(seg) {
  if (BOUND.has(seg)) {
    syncSegThumb(seg);
    return;
  }
  BOUND.add(seg);
  seg.classList.add('seg--swipeable');
  ensureThumb(seg);
  syncSegThumb(seg);

  const mo = new MutationObserver(() => {
    if (!seg.classList.contains('seg--dragging')) syncSegThumb(seg);
  });
  mo.observe(seg, { attributes: true, subtree: true, attributeFilter: ['aria-pressed', 'disabled'] });

  let startX = 0;
  let startY = 0;
  let originCenterX = 0;
  let originCenterY = 0;
  let axis = null; /* 'x' | 'y' | 'free' | null */
  let tracking = false;
  let didDrag = false;
  let swallowClick = false;
  let swallowTimer = 0;
  let pointerId = null;
  let wrapped = false;

  const releaseCapture = () => {
    if (pointerId != null && seg.releasePointerCapture) {
      try { seg.releasePointerCapture(pointerId); } catch { /* ok */ }
    }
    pointerId = null;
  };

  const beginDrag = () => {
    seg.classList.add('seg--dragging');
    if (seg.setPointerCapture && pointerId != null) {
      try { seg.setPointerCapture(pointerId); } catch { /* ok */ }
    }
  };

  const onDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const btns = buttonsOf(seg);
    if (btns.length < 2) return;
    const active = btns[activeIndex(btns)] || btns[0];
    const point = e.touches ? e.touches[0] : e;
    startX = point.clientX;
    startY = point.clientY;
    originCenterX = active.offsetLeft + active.offsetWidth / 2;
    originCenterY = active.offsetTop + active.offsetHeight / 2;
    wrapped = isWrapped(btns);
    axis = null;
    tracking = true;
    didDrag = false;
    pointerId = e.pointerId ?? null;
    /* No capturar aún: un toque debe poder completar el click en el botón. */
  };

  const onMove = (e) => {
    if (!tracking) return;
    const btns = buttonsOf(seg);
    if (btns.length < 2) return;
    const point = e.touches ? e.touches[0] : e;
    const dx = point.clientX - startX;
    const dy = point.clientY - startY;
    if (!axis) {
      if (Math.abs(dx) < AXIS_SLOP && Math.abs(dy) < AXIS_SLOP) return;
      if (wrapped) {
        axis = 'free';
        beginDrag();
      } else {
        axis = Math.abs(dx) > Math.abs(dy) * 1.1 ? 'x' : 'y';
        if (axis === 'x') beginDrag();
      }
    }
    if (axis !== 'x' && axis !== 'free') return;
    if (e.cancelable) e.preventDefault();
    const travel = axis === 'free' ? Math.hypot(dx, dy) : Math.abs(dx);
    if (travel >= DRAG_MIN) didDrag = true;
    const layout = axis === 'free'
      ? thumbLayout(btns, originCenterX + dx, originCenterY + dy)
      : thumbLayout(btns, originCenterX + dx);
    if (layout) placeThumb(seg, layout.x, layout.y, layout.w, layout.h);
  };

  const finish = (e) => {
    if (!tracking) return;
    tracking = false;
    seg.classList.remove('seg--dragging');
    releaseCapture();

    const btns = buttonsOf(seg);
    const point = e.changedTouches ? e.changedTouches[0] : e;
    const dx = (point?.clientX ?? startX) - startX;
    const dy = (point?.clientY ?? startY) - startY;

    if ((axis === 'x' || axis === 'free') && didDrag && btns.length >= 2) {
      const idx = axis === 'free'
        ? nearestIndex(btns, originCenterX + dx, originCenterY + dy)
        : nearestIndex(btns, originCenterX + dx);
      const target = btns[idx];
      const curBtn = btns[activeIndex(btns)];
      if (target && target !== curBtn) target.click();
      else syncSegThumb(seg);
      swallowClick = true;
      clearTimeout(swallowTimer);
      swallowTimer = setTimeout(() => { swallowClick = false; }, 50);
    } else {
      /* Toque o gesto corto: deja pasar el click nativo al botón. */
      syncSegThumb(seg);
    }
    axis = null;
    didDrag = false;
  };

  const onClickCapture = (e) => {
    if (!swallowClick) return;
    swallowClick = false;
    clearTimeout(swallowTimer);
    e.preventDefault();
    e.stopPropagation();
  };

  if (window.PointerEvent) {
    seg.addEventListener('pointerdown', onDown);
    seg.addEventListener('pointermove', onMove, { passive: false });
    seg.addEventListener('pointerup', finish);
    seg.addEventListener('pointercancel', finish);
  } else {
    seg.addEventListener('touchstart', onDown, { passive: true });
    seg.addEventListener('touchmove', onMove, { passive: false });
    seg.addEventListener('touchend', finish);
    seg.addEventListener('touchcancel', finish);
  }
  seg.addEventListener('click', onClickCapture, true);

  requestAnimationFrame(() => syncSegThumb(seg));
}

function scan(root) {
  const base = root instanceof Element ? root : document;
  if (base.classList?.contains('seg')) bindSeg(base);
  base.querySelectorAll?.('.seg').forEach(bindSeg);
}

export function watchSegs(root) {
  const el = root || document.getElementById('app') || document.body;
  scan(el);
  new MutationObserver((records) => {
    for (const rec of records) {
      for (const node of rec.addedNodes) {
        if (node.nodeType !== 1) continue;
        scan(node);
      }
      if (rec.type === 'attributes' && rec.target instanceof Element) {
        const seg = rec.target.closest?.('.seg');
        /* No pisar la pastilla mientras el dedo la arrastra. */
        if (seg && !seg.classList.contains('seg--dragging')) syncSegThumb(seg);
      }
    }
  }).observe(el, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-pressed', 'disabled'],
  });
  window.addEventListener('resize', () => {
    el.querySelectorAll?.('.seg').forEach(syncSegThumb);
  }, { passive: true });
}
