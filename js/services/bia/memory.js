/* Lo que Bía recuerda del atleta: notas (agentMemory), perfil y rutina semanal (meta). */

import { db } from '../../db.js';
import { DOSE_G } from '../creatine.js';

export async function loadAllMemories() {
  return db.getAll('agentMemory');
}

export async function saveMemory(contenido) {
  return db.add('agentMemory', { contenido, ts: Date.now() });
}

export async function deleteMemory(id) {
  return db.remove('agentMemory', Number(id));
}

export async function clearAllMemories() {
  const all = await loadAllMemories();
  for (const m of all) {
    await deleteMemory(m.id);
  }
}

/* Un atleta nuevo empieza sin datos: nada se inventa. La creatina parte de la dosis de la app. */
const DEFAULT_PROFILE = {
  nombre: '',
  peso: '',
  estatura: '',
  creatina: `${DOSE_G} g al día`,
};

export async function loadAthleteProfile() {
  const row = await db.get('meta', 'athleteProfile');
  return { ...DEFAULT_PROFILE, ...(row?.value || {}) };
}

export async function saveAthleteProfile(patch) {
  const current = await loadAthleteProfile();
  const updated = { ...current, ...patch };
  await db.put('meta', { key: 'athleteProfile', value: updated });
  return updated;
}

/* Semana vacía: el atleta escribe qué entrena cada día. Un día sin grupo es descanso. */
const WEEK_DAYS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

export async function loadWeeklyRoutine() {
  const row = await db.get('meta', 'weeklyRoutine');
  return row?.value || WEEK_DAYS.map((dia) => ({ dia, grupo: '' }));
}

export async function saveWeeklyRoutine(routine) {
  await db.put('meta', { key: 'weeklyRoutine', value: routine });
  return routine;
}
