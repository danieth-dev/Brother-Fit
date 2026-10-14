import { openDB } from './db.js';
import { ensureSeed } from './services/seed.js';
import { loadPending } from './services/effort.js';
import { loadSettings, state } from './store.js';
import { startRouter } from './router.js';
import { watchPickers } from './utils/picker.js';
import { watchCalendars } from './utils/calendar.js';

function blockTabMenu() {
  const bar = document.querySelector('.tabbar');
  if (!bar) return;
  bar.addEventListener('contextmenu', (e) => e.preventDefault());
  bar.querySelectorAll('a').forEach((a) => { a.draggable = false; });
}
blockTabMenu();

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
    }).catch((e) => console.warn('SW no registrado:', e));
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }
}

boot();
