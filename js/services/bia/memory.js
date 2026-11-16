/* Lo que Bía recuerda del atleta: notas (agentMemory), perfil y rutina semanal (meta). */

import { db } from '../../db.js';

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

const DEFAULT_PROFILE = {
  nombre: 'Daniel',
  peso: '49 kg',
  estatura: '1,63 m',
  creatina: '5 g al día',
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

const DEFAULT_ROUTINE = [
  { dia: 'LUN', grupo: 'Pecho', dot: '#FF6B7A' },
  { dia: 'MAR', grupo: 'Pierna · cuádriceps', dot: '#FFD166' },
  { dia: 'MIÉ', grupo: 'Espalda', dot: '#2EC4B6' },
  { dia: 'JUE', grupo: 'Glúteo o cardio', dot: '#F78FB3' },
  { dia: 'VIE', grupo: 'Brazo completo', dot: '#4D8DFF' },
];

export async function loadWeeklyRoutine() {
  const row = await db.get('meta', 'weeklyRoutine');
  return row?.value || DEFAULT_ROUTINE;
}

export async function saveWeeklyRoutine(routine) {
  await db.put('meta', { key: 'weeklyRoutine', value: routine });
  return routine;
}
