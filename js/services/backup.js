/* Respaldo: arma el archivo, lo restaura y decide cuándo recordar respaldar.
 * Compartir o descargar el archivo es de interfaz: js/utils/backup-export.js. */
import { db } from '../db.js';
import { todayISO } from '../utils/dates.js';

const STALE_MS = 7 * 24 * 60 * 60 * 1000;
const WORKOUTS_BEFORE_NUDGE = 5;

async function buildPayload() {
  return {
    app: 'brother-ft',
    schema: 1,
    exportedAt: new Date().toISOString(),
    data: await db.dumpAll(),
  };
}

function backupFilename() {
  return `brother-ft-${todayISO()}.json`;
}

/** Todo el contenido de la base como archivo JSON listo para compartir o descargar. */
export async function buildBackupFile() {
  const json = JSON.stringify(await buildPayload());
  return new File([json], backupFilename(), { type: 'application/json' });
}

/** Se llama solo cuando el respaldo salió del teléfono (compartido o descargado). */
export async function markLastBackup() {
  await db.put('meta', { key: 'lastBackup', value: Date.now() });
}

export async function importData(file) {
  let payload;
  try { payload = JSON.parse(await file.text()); } catch { throw new Error('El archivo no es un JSON válido.'); }
  if (payload?.app !== 'brother-ft' || typeof payload.data !== 'object') {
    throw new Error('Ese archivo no es un respaldo de Bía.');
  }
  await db.restoreAll(payload.data); // atómico: si falla, queda todo como estaba
}

/** «Borrar todo»: restaurar un volcado vacío, en una sola transacción. */
export async function clearAllData() {
  await db.clearAll();
}

export async function lastBackup() {
  return (await db.get('meta', 'lastBackup'))?.value ?? null;
}

/** Evita repetir el aviso el mismo día. */
export async function markBackupNudgeShown() {
  await db.put('meta', { key: 'backupNudgeDay', value: todayISO() });
}

/**
 * ¿Conviene pedir un respaldo?
 * Sí si hay al menos un entreno terminado y:
 * - nunca respaldó, o
 * - el último respaldo tiene ≥7 días, o
 * - hay ≥5 entrenos terminados desde el último respaldo.
 * No más de una vez al día.
 */
export async function backupNudgeNeeded() {
  const nudged = (await db.get('meta', 'backupNudgeDay'))?.value;
  if (nudged === todayISO()) return false;

  const [last, workouts] = await Promise.all([lastBackup(), db.getAll('workouts')]);
  const finished = workouts.filter((w) => w.finishedAt);
  if (!finished.length) return false;

  if (!last) return true;
  if (Date.now() - last >= STALE_MS) return true;
  const since = finished.filter((w) => w.finishedAt > last).length;
  return since >= WORKOUTS_BEFORE_NUDGE;
}
