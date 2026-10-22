/* Estado mínimo de la app: ajustes del usuario. El resto se lee de los servicios al renderizar. */
import { db } from './db.js';

export const DEFAULTS = {
  descanso: 90,
  descansoMode: 'auto',
  unidad: 'kg',
  aguaRecordatorios: true,
  tema: 'amarillo',
};

const TEMAS = new Set(['amarillo', 'azul', 'rosado']);

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
}

export async function saveSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  applyTema(state.settings.tema);
  await db.put('meta', { key: 'settings', value: state.settings });
}
