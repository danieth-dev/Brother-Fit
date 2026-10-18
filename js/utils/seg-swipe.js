/* Desliz horizontal en .seg: mismo resultado que pulsar. El toque sigue funcionando. */

const BOUND = new WeakSet();
const THRESHOLD = 28;

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
  thumb.hidden = false;
  thumb.style.width = `${active.offsetWidth}px`;
  thumb.style.height = `${active.offsetHeight}px`;
  thumb.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
}

function placeThumbAt(seg, x, y, w, h) {
  const thumb = ensureThumb(seg);
  thumb.hidden = false;
  thumb.style.width = `${w}px`;
  thumb.style.height = `${h}px`;
  thumb.style.transform = `translate(${x}px, ${y}px)`;
}

function nearestIndex(btns, centerX) {
  let best = 0;
  let bestDist = Infinity;
  btns.forEach((b, i) => {
    const mid = b.offsetLeft + b.offsetWidth / 2;
    const d = Math.abs(mid - centerX);
    if (d < bestDist) { bestDist = d; best = i; }
  });
  return best;
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
  let originLeft = 0;
  let originTop = 0;
  let thumbW = 0;
  let thumbH = 0;
  let minX = 0;
  let maxX = 0;
  let axis = null;
  let dragging = false;
  let didSwipe = false;
  let swallowClick = false;
  let swallowTimer = 0;
  let pointerId = null;

  const onDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const btns = buttonsOf(seg);
    if (btns.length < 2) return;
    const active = btns[activeIndex(btns)] || btns[0];
    const point = e.touches ? e.touches[0] : e;
    startX = point.clientX;
    startY = point.clientY;
    originLeft = active.offsetLeft;
    originTop = active.offsetTop;
    thumbW = active.offsetWidth;
    thumbH = active.offsetHeight;
    minX = btns[0].offsetLeft;
    maxX = btns[btns.length - 1].offsetLeft;
    axis = null;
    dragging = true;
    didSwipe = false;
    pointerId = e.pointerId ?? null;
    if (seg.setPointerCapture && pointerId != null) {
      try { seg.setPointerCapture(pointerId); } catch { /* ok */ }
    }
  };

  const onMove = (e) => {
    if (!dragging) return;
    const btns = buttonsOf(seg);
    if (btns.length < 2) return;
    const point = e.touches ? e.touches[0] : e;
    const dx = point.clientX - startX;
    const dy = point.clientY - startY;
    if (!axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      axis = Math.abs(dx) > Math.abs(dy) * 1.15 ? 'x' : 'y';
      if (axis === 'x') seg.classList.add('seg--dragging');
    }
    if (axis !== 'x') return;
    if (e.cancelable) e.preventDefault();
    didSwipe = Math.abs(dx) >= THRESHOLD || didSwipe;
    const x = Math.min(maxX, Math.max(minX, originLeft + dx));
    placeThumbAt(seg, x, originTop, thumbW, thumbH);
  };

  const finish = (e) => {
    if (!dragging) return;
    dragging = false;
    seg.classList.remove('seg--dragging');
    if (pointerId != null && seg.releasePointerCapture) {
      try { seg.releasePointerCapture(pointerId); } catch { /* ok */ }
    }
    pointerId = null;

    const btns = buttonsOf(seg);
    if (axis === 'x' && btns.length >= 2) {
      const point = e.changedTouches ? e.changedTouches[0] : e;
      const dx = (point?.clientX ?? startX) - startX;
      const thumb = seg.querySelector(':scope > .seg-thumb');
      const left = thumb
        ? parseFloat(String(thumb.style.transform).match(/translate\(([-\d.]+)/)?.[1] || originLeft)
        : originLeft + dx;
      let idx = nearestIndex(btns, left + thumbW / 2);
      /* Si el dedo cruzó el umbral, fuerza el vecino en esa dirección. */
      if (Math.abs(dx) >= THRESHOLD) {
        const cur = activeIndex(btns);
        const dir = dx < 0 ? 1 : -1;
        idx = Math.min(btns.length - 1, Math.max(0, cur + dir));
        didSwipe = true;
      }
      const target = btns[idx];
      const curBtn = btns[activeIndex(btns)];
      syncSegThumb(seg);
      if (target && target !== curBtn) target.click();
      else syncSegThumb(seg);
      /* Tras un desliz, traga solo el clic fantasma inmediato (no los toques siguientes). */
      if (didSwipe || Math.abs(dx) >= 10) {
        swallowClick = true;
        clearTimeout(swallowTimer);
        swallowTimer = setTimeout(() => { swallowClick = false; }, 50);
      }
    } else {
      syncSegThumb(seg);
    }
    axis = null;
    didSwipe = false;
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

/** Engancha desliz + pastilla en los .seg del árbol (y los que se pinten después). */
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
        if (seg) syncSegThumb(seg);
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
