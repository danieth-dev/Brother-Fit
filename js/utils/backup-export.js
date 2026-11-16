/* Saca el respaldo del teléfono: hoja nativa de compartir (WhatsApp, Drive, Archivos…)
 * y, si el teléfono no puede compartir archivos, descarga el JSON. */
import { buildBackupFile, markLastBackup } from '../services/backup.js';

/** @returns {Promise<'share' | 'download' | 'cancelled'>} */
async function shareOrDownload(file, { title, text }) {
  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text });
      return 'share';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
      /* Otro fallo al compartir: se descarga. */
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'download';
}

/**
 * Comparte o descarga el respaldo. Cancelar la hoja de compartir no cuenta como respaldo.
 * @returns {Promise<{ mode: 'share' | 'download' | 'cancelled' }>}
 */
export async function exportBackup() {
  const file = await buildBackupFile();
  const mode = await shareOrDownload(file, {
    title: 'Bía',
    text: 'Respaldo de Bía — asegura tus PRs',
  });
  if (mode !== 'cancelled') await markLastBackup();
  return { mode };
}
