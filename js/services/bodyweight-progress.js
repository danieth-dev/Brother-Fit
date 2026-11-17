/* Progreso de un ejercicio de peso corporal: sesiones en repeticiones y, donde se puede, carga
 * estimada con el peso corporal registrado en cada fecha. Las reglas están en bodyweight.js. */
import { db } from '../db.js';
import { listBodyWeights } from './body.js';
import { bodyweightSession, bodyWeightOn, estimatedLoad, bodyFraction } from './bodyweight.js';

const LAST_DAY = '9999-12-31';
const maxOf = (values) => (values.length ? Math.max(...values) : 0);

/**
 * { sessions: [{ fecha, repsMax, repsTotal, extra, series, carga }], records, bodyKg }
 * records: { repsSerie, repsSesion, extraMax, cargaMax }. carga y cargaMax son null si no se estima.
 */
export async function bodyweightProgress(ex) {
  const [sets, ws, body] = await Promise.all([
    db.byIndex('sets', 'exerciseId', ex.id),
    db.getAll('workouts'),
    listBodyWeights(),
  ]);
  const fechaDe = new Map(ws.map((w) => [w.id, w.fecha]));
  const byDay = new Map();
  for (const s of sets) {
    const fecha = fechaDe.get(s.workoutId);
    if (!fecha) continue;
    if (!byDay.has(fecha)) byDay.set(fecha, []);
    byDay.get(fecha).push(s);
  }
  const fraction = bodyFraction(ex);
  const sessions = [...byDay.keys()].sort().map((fecha) => {
    const stats = bodyweightSession(byDay.get(fecha));
    if (!stats) return null;
    return { fecha, ...stats, carga: estimatedLoad(bodyWeightOn(fecha, body), stats.extra, fraction) };
  }).filter(Boolean);
  const cargas = sessions.map((s) => s.carga).filter((c) => c != null);
  return {
    sessions,
    records: {
      repsSerie: maxOf(sessions.map((s) => s.repsMax)),
      repsSesion: maxOf(sessions.map((s) => s.repsTotal)),
      extraMax: maxOf(sessions.map((s) => s.extra)),
      cargaMax: cargas.length ? Math.max(...cargas) : null,
    },
    bodyKg: fraction != null ? bodyWeightOn(LAST_DAY, body) : null,
  };
}
