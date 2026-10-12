import { db } from '../db.js';

export const addBodyWeight = ({ fecha, peso }) => db.add('bodyMetrics', { fecha, peso, ts: Date.now() });
export const deleteBodyMetric = (id) => db.remove('bodyMetrics', id);

export async function listBodyWeights() {
  return (await db.getAll('bodyMetrics')).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.ts - b.ts);
}
