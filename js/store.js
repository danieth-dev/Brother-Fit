/* Estado mínimo de la app: ajustes del usuario. El resto se lee de los servicios al renderizar. */
import { db } from './db.js';

export const DEFAULTS = { creatinaGramos: 5, descanso: 90, descansoMode: 'auto', unidad: 'kg' };

export const state = {
  settings: { ...DEFAULTS },
  installPrompt: null, // evento beforeinstallprompt (Android/Chrome)
  activeExercise: null, // { id, nombre, grupo }
  activeWorkoutId: null,
};

export async function loadSettings() {
  const row = await db.get('meta', 'settings');
  state.settings = { ...DEFAULTS, ...(row?.value || {}) };
}

export async function saveSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  await db.put('meta', { key: 'settings', value: state.settings });
}
