/* Aviso persuasivo para respaldar PRs. Una vez al día como máximo. */
import { askConfirm } from './confirm-sheet.js';
import { backupNudgeNeeded, markBackupNudgeShown, exportData } from '../services/backup.js';
import { toast } from './dom.js';

export async function maybePromptBackup() {
  if (!(await backupNudgeNeeded())) return;
  await markBackupNudgeShown();
  const ok = await askConfirm({
    title: 'Asegura tus PRs',
    body: 'Tus entrenos viven solo en este teléfono. Compártelos a WhatsApp, Drive o Archivos para no perderlos.',
    confirmLabel: 'Asegurar ahora',
    cancelLabel: 'Ahora no',
    danger: false,
  });
  if (!ok) return;
  try {
    const r = await exportData();
    if (r.mode === 'cancelled') return;
    toast(r.mode === 'share' ? 'Respaldo compartido' : 'Respaldo guardado');
  } catch (e) {
    toast('No se pudo respaldar: ' + e.message);
  }
}
