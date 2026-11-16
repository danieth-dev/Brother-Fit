/* Respaldo: arma el archivo, lo restaura y decide cuándo recordar respaldar.
 * Compartir o descargar el archivo es de interfaz: js/utils/backup-export.js.
 * Las reglas sin base de datos (leer el archivo, mezclar claves, cuándo avisar) son funciones
 * puras exportadas para probarlas en Node (tests/logic-backup.test.js). */
import { db } from '../db.js';
import { now } from '../utils/clock.js';
import { todayISO } from '../utils/dates.js';

export const BACKUP_APP = 'brother-ft';
const BACKUP_SCHEMA = 1;
const STALE_MS = 7 * 24 * 60 * 60 * 1000;
const WORKOUTS_BEFORE_NUDGE = 5;

/* Claves de IA: son del teléfono, no del atleta. No salen en el respaldo y un respaldo
 * no las pisa al importarlo (aunque sea uno viejo que todavía las traiga). */
export const SECRET_META_KEYS = new Set(['geminiApiKey', 'openaiApiKey']);
const withoutSecrets = (rows = []) => rows.filter((r) => !SECRET_META_KEYS.has(r?.key));

/** Lo que se escribe en el archivo: todo el volcado menos las claves de IA. */
export function buildPayload(dump, exportedAt = new Date(now()).toISOString()) {
  return {
    app: BACKUP_APP,
    schema: BACKUP_SCHEMA,
    exportedAt,
    data: { ...dump, meta: withoutSecrets(dump?.meta) },
  };
}

/** Lee el texto del archivo y devuelve sus datos, o lanza un error para el atleta. */
export function parseBackup(text) {
  let payload;
  try { payload = JSON.parse(text); } catch { throw new Error('El archivo no es un JSON válido.'); }
  if (payload?.app !== BACKUP_APP || !payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) {
    throw new Error('Ese archivo no es un respaldo de Bía.');
  }
  return payload.data;
}

/** Datos a restaurar: los del archivo sin sus claves de IA, más las claves que ya tenía este teléfono. */
export function mergeImport(data, keptSecrets = []) {
  const meta = Array.isArray(data.meta) ? data.meta : [];
  return { ...data, meta: [...withoutSecrets(meta), ...keptSecrets.filter(Boolean)] };
}

/**
 * ¿Conviene pedir un respaldo?
 * Sí si hay al menos un entreno terminado y:
 * - nunca respaldó, o
 * - el último respaldo tiene ≥7 días, o
 * - hay ≥5 entrenos terminados desde el último respaldo.
 * No más de una vez al día.
 */
export function shouldNudgeBackup({ nudgedDay, today, lastBackupAt, finishedAts, nowMs }) {
  if (nudgedDay === today) return false;
  if (!finishedAts.length) return false;
  if (!lastBackupAt) return true;
  if (nowMs - lastBackupAt >= STALE_MS) return true;
  return finishedAts.filter((t) => t > lastBackupAt).length >= WORKOUTS_BEFORE_NUDGE;
}

function backupFilename() {
  return `${BACKUP_APP}-${todayISO()}.json`;
}

/** Todo el contenido de la base como archivo JSON listo para compartir o descargar. */
export async function buildBackupFile() {
  const json = JSON.stringify(buildPayload(await db.dumpAll()));
  return new File([json], backupFilename(), { type: 'application/json' });
}

/** Se llama solo cuando el respaldo salió del teléfono (compartido o descargado). */
export async function markLastBackup() {
  await db.put('meta', { key: 'lastBackup', value: now() });
}

export async function importData(file) {
  const data = parseBackup(await file.text());
  const keptSecrets = await Promise.all([...SECRET_META_KEYS].map((key) => db.get('meta', key)));
  await db.restoreAll(mergeImport(data, keptSecrets)); // atómico: si falla, queda todo como estaba
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

export async function backupNudgeNeeded() {
  const [nudged, last, workouts] = await Promise.all([
    db.get('meta', 'backupNudgeDay'),
    lastBackup(),
    db.getAll('workouts'),
  ]);
  return shouldNudgeBackup({
    nudgedDay: nudged?.value,
    today: todayISO(),
    lastBackupAt: last,
    finishedAts: workouts.filter((w) => w.finishedAt).map((w) => w.finishedAt),
    nowMs: now(),
  });
}
