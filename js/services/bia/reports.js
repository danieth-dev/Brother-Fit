/* Reportes de respuestas de Bía. La política de Play para IA generativa pide que el atleta
 * pueda marcar una respuesta ofensiva o dañina sin salir de la app. Cada reporte se guarda
 * en meta.aiReports y, si hay correo de soporte, se prepara un correo para enviarlo. */
import { db } from '../../db.js';
import { APP_INFO } from '../../app-info.js';
import { now } from '../../utils/clock.js';

const REPORTS_KEY = 'aiReports';
const MAX_REPORTS = 50;
const MAX_TEXT = 2000;

export const REPORT_REASONS = [
  { id: 'ofensiva', label: 'Ofensiva o inapropiada' },
  { id: 'peligrosa', label: 'Peligrosa para la salud' },
  { id: 'incorrecta', label: 'Incorrecta o inventada' },
  { id: 'otra', label: 'Otra cosa' },
];

const reasonLabel = (id) => REPORT_REASONS.find((r) => r.id === id)?.label || 'Otra cosa';

export async function listAiReports() {
  return (await db.get('meta', REPORTS_KEY))?.value || [];
}

/** Guarda el reporte. Devuelve el reporte guardado. */
export async function saveAiReport({ text, reason, note = '' }) {
  if (!REPORT_REASONS.some((r) => r.id === reason)) throw new Error('Elige un motivo.');
  const report = {
    ts: now(),
    reason,
    note: String(note).trim().slice(0, 500),
    text: String(text || '').trim().slice(0, MAX_TEXT),
  };
  const all = [...(await listAiReports()), report].slice(-MAX_REPORTS);
  await db.put('meta', { key: REPORTS_KEY, value: all });
  return report;
}

/** Correo listo para enviar el reporte, o null si la app no tiene correo de soporte. */
export function reportMailtoUrl(report) {
  if (!APP_INFO.supportEmail) return null;
  const subject = `Reporte de respuesta de Bía: ${reasonLabel(report.reason)}`;
  const lines = [`Motivo: ${reasonLabel(report.reason)}`];
  if (report.note) lines.push(`Comentario: ${report.note}`);
  lines.push(`Fecha: ${new Date(report.ts).toISOString()}`, '', 'Respuesta de Bía:', report.text);
  const body = lines.join('\n');
  return `mailto:${APP_INFO.supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
