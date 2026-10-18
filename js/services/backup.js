/* Exportar e importar todos los datos como JSON. */
import { db } from '../db.js';
import { todayISO } from '../utils/dates.js';

export async function exportData() {
  const payload = { app: 'brother-ft', schema: 1, exportedAt: new Date().toISOString(), data: await db.dumpAll() };
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `brother-ft-${todayISO()}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  await db.put('meta', { key: 'lastBackup', value: Date.now() });
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
