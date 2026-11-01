/* Estado mínimo de la app: ajustes del usuario. El resto se lee de los servicios al renderizar. */
import { db } from './db.js';

export const DEFAULTS = {
  descanso: 90,
  descansoMode: 'auto',
  unidad: 'kg',
  aguaRecordatorios: true,
  tema: 'amarillo',
  modo: 'oscuro',
  creatinaCompacta: false,
  metaKcal: 2100,
  metaProteina: 100,
  metaCarbos: 270,
  metaGrasa: 66,
  metaObjetivo: 'ganar',
};

const TEMAS = new Set(['amarillo', 'azul', 'rosado']);
const MODOS = new Set(['oscuro', 'claro', 'sistema']);

let mediaQueryListener = null;

function resolveSystemModo() {
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'claro' : 'oscuro';
}

export function applyModo(modo) {
  const name = MODOS.has(modo) ? modo : 'oscuro';
  const syncThemeColor = (effectiveModo) => {
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', effectiveModo === 'claro' ? '#edf0f5' : '#07080a');
  };

  if (name === 'sistema') {
    const effective = resolveSystemModo();
    document.documentElement.dataset.modo = effective;
    syncThemeColor(effective);
    if (!mediaQueryListener && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: light)');
      mediaQueryListener = (e) => {
        if (state.settings.modo === 'sistema') {
          const sys = e.matches ? 'claro' : 'oscuro';
          document.documentElement.dataset.modo = sys;
          syncThemeColor(sys);
        }
      };
      mq.addEventListener('change', mediaQueryListener);
    }
  } else {
    document.documentElement.dataset.modo = name;
    syncThemeColor(name);
  }
}

export function applyTema(tema) {
  const name = TEMAS.has(tema) ? tema : 'amarillo';
  if (name === 'amarillo') document.documentElement.removeAttribute('data-tema');
  else document.documentElement.dataset.tema = name;
}

export const state = {
  settings: { ...DEFAULTS },
  installPrompt: null, // evento beforeinstallprompt (Android/Chrome)
  activeExercise: null, // { id, nombre, grupo }
  activeWorkoutId: null,
};

export async function loadSettings() {
  const row = await db.get('meta', 'settings');
  state.settings = { ...DEFAULTS, ...(row?.value || {}) };
  applyTema(state.settings.tema);
  applyModo(state.settings.modo);
}

export async function saveSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  applyTema(state.settings.tema);
  applyModo(state.settings.modo);
  await db.put('meta', { key: 'settings', value: state.settings });
}
