import { db } from '../db.js';

export const addBodyWeight = ({ fecha, peso }) => db.add('bodyMetrics', { fecha, peso, ts: Date.now() });
export const deleteBodyMetric = (id) => db.remove('bodyMetrics', id);

export async function listBodyWeights() {
  return (await db.getAll('bodyMetrics')).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.ts - b.ts);
}

export async function latestWeight() {
  const list = await listBodyWeights();
  return list.length > 0 ? list[list.length - 1] : null;
}
