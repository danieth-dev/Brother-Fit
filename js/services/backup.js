/* Exportar e importar todos los datos como JSON.
 * Preferimos la hoja nativa de compartir; si no hay, descarga el archivo. */
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

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function markLastBackup() {
  await db.put('meta', { key: 'lastBackup', value: Date.now() });
}

/**
 * Comparte el respaldo con la hoja del sistema (WhatsApp, Drive, Archivos…).
 * Si no se puede, descarga el JSON como antes.
 * @returns {Promise<{ mode: 'share' | 'download' | 'cancelled' }>}
 */
export async function exportData() {
  const filename = backupFilename();
  const blob = new Blob([JSON.stringify(await buildPayload())], { type: 'application/json' });
  const file = new File([blob], filename, { type: 'application/json' });

  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'Brother Fit',
        text: 'Respaldo de Brother Fit — asegura tus PRs',
      });
      await markLastBackup();
      return { mode: 'share' };
    } catch (err) {
      if (err?.name === 'AbortError') return { mode: 'cancelled' };
      /* Si share falla por otro motivo, caemos a descarga. */
    }
  }

  downloadBlob(blob, filename);
  await markLastBackup();
  return { mode: 'download' };
}

export async function importData(file) {
  let payload;
  try { payload = JSON.parse(await file.text()); } catch { throw new Error('El archivo no es un JSON válido.'); }
  if (payload?.app !== 'brother-ft' || typeof payload.data !== 'object') {
    throw new Error('Ese archivo no es un respaldo de Brother Fit.');
  }
  await db.restoreAll(payload.data); // atómico: si falla, queda todo como estaba
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
