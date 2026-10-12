import { openDB } from './db.js';
import { ensureSeed } from './services/seed.js';
import { loadSettings, state } from './store.js';
import { startRouter } from './router.js';

// Guardamos el evento de instalación para ofrecer el botón en Ajustes.
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); state.installPrompt = e; });
window.addEventListener('appinstalled', () => { state.installPrompt = null; });

async function boot() {
  try {
    await openDB();
    await ensureSeed();
    await loadSettings();
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
