import { openDB } from './db.js';
import { ensureSeed } from './services/seed.js';
import { loadPending } from './services/effort.js';
import { loadSettings, state } from './store.js';
import { startRouter } from './router.js';
import { watchPickers } from './utils/picker.js';
import { watchCalendars } from './utils/calendar.js';
import { watchTimes } from './utils/time-sheet.js';
import { resumeWaterReminders } from './services/water-reminders.js';

/* Pulsación larga: el navegador muestra menú de vínculo/compartir. En Brother Fit no debe salir nunca. */
function blockBrowserChrome() {
  const editable = 'input, textarea, [contenteditable="true"]';
  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest?.(editable)) return;
    e.preventDefault();
  }, { capture: true });
  document.addEventListener('dragstart', (e) => {
    if (e.target.closest?.(editable)) return;
    e.preventDefault();
  }, { capture: true });
  const disarm = (root = document) => {
    root.querySelectorAll?.('a[href]').forEach((a) => { a.draggable = false; });
  };
  disarm();
  new MutationObserver((records) => {
    for (const rec of records) {
      for (const node of rec.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.matches?.('a[href]')) node.draggable = false;
        else disarm(node);
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
}
blockBrowserChrome();

// El tirón hacia abajo en Chrome recarga la página. No debe comerse el scroll de una lista.
function blockPullToRefresh() {
  let startY = 0;
  document.addEventListener('touchstart', (e) => {
    startY = e.touches[0]?.clientY ?? 0;
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    const y = e.touches[0]?.clientY ?? 0;
    if (y <= startY || window.scrollY > 0 || !e.cancelable) return;
    if (canScroll(e.target, 'up')) return;
    e.preventDefault();
  }, { passive: false });
}

function canScroll(node, dir) {
  let el = node instanceof Element ? node : node?.parentElement;
  while (el && el !== document.documentElement) {
    const oy = getComputedStyle(el).overflowY;
    if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && el.scrollHeight > el.clientHeight + 1) {
      if (dir === 'up' && el.scrollTop > 0) return true;
      if (dir === 'down' && el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true;
    }
    el = el.parentElement;
  }
  return false;
}
blockPullToRefresh();

// Guardamos el evento de instalación para ofrecer el botón en Ajustes.
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); state.installPrompt = e; });
window.addEventListener('appinstalled', () => { state.installPrompt = null; });

async function boot() {
  try {
    await openDB();
    await loadPending();
    await ensureSeed();
    await loadSettings();
    watchPickers(document.getElementById('app'));
    watchCalendars(document.getElementById('app'));
    watchTimes(document.getElementById('app'));
  } catch (err) {
    console.error(err);
    document.getElementById('app').innerHTML =
      '<p class="error">No se pudo abrir la base de datos del navegador. Revisa que no estés en modo privado y recarga.</p>';
    return;
  }

  await startRouter();

  // Pide almacenamiento persistente para que el navegador no borre los datos por falta de espacio.
  navigator.storage?.persist?.();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      reg.update();
      resumeWaterReminders();
    }).catch((e) => console.warn('SW no registrado:', e));
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  } else {
    resumeWaterReminders();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') resumeWaterReminders();
  });
}

boot();
