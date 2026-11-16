/* Contexto que Bía recibe al empezar: entrenos recientes, historial consultado y peso corporal. */

import { listBodyWeights } from '../body.js';
import { getWorkoutDetail, listWorkoutSummaries } from '../workouts.js';
import { addDays, toISO } from '../../utils/dates.js';

export async function getRecentWorkoutsForFit() {
  try {
    const summaries = await listWorkoutSummaries(5);
    const nowD = new Date();
    const diasSemana = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const diaSemanaHoy = diasSemana[nowD.getDay()];
    const fechaHoy = toISO(nowD);
    const fechaAyer = addDays(fechaHoy, -1);
    const diaSemanaAyer = diasSemana[(nowD.getDay() + 6) % 7];

    const lines = [
      `\n\nCALENDARIO REAL DE LA APP:`,
      `- HOY es: ${diaSemanaHoy}, ${fechaHoy}.`,
      `- AYER fue: ${diaSemanaAyer}, ${fechaAyer}.`,
    ];

    if (!summaries || !summaries.length) {
      lines.push('HISTORIAL DE ENTRENAMIENTOS: No hay entrenamientos finalizados registrados.');
      return lines.join('\n');
    }

    lines.push('HISTORIAL REAL DE ENTRENAMIENTOS REGISTRADOS:');
    for (const s of summaries) {
      if (!s.totalSets && !s.finishedAt) continue;
      const isToday = s.fecha === fechaHoy;
      const isYesterday = s.fecha === fechaAyer;
      const label = isToday ? `HOY (${diaSemanaHoy} ${s.fecha})` : isYesterday ? `AYER (${diaSemanaAyer} ${s.fecha})` : s.fecha;
      const gruposStr = s.grupos?.length ? s.grupos.join(', ') : 'General';
      const durMin = s.finishedAt && s.startedAt ? Math.max(1, Math.round((s.finishedAt - s.startedAt) / 60000)) : null;
      const durStr = durMin ? ` · ${durMin} min de duración` : '';
      lines.push(`- [${label}]: ${gruposStr} · ${s.totalSets} series · ${Math.round(s.volumen)} kg/lb volumen${durStr}.`);
    }

    return lines.join('\n');
  } catch (err) {
    return '\n\nERROR AL LEER HISTORIAL DE ENTRENAMIENTO.';
  }
}

export async function queryWorkoutHistoryForFit(target) {
  try {
    const summaries = await listWorkoutSummaries(10);
    const nowD = new Date();
    const fechaHoy = toISO(nowD);
    const fechaAyer = addDays(fechaHoy, -1);

    let matchSummary = null;
    const t = String(target || '').toLowerCase().trim();

    if (t.includes('ayer')) {
      matchSummary = summaries.find((s) => s.fecha === fechaAyer);
    } else if (t.includes('hoy')) {
      matchSummary = summaries.find((s) => s.fecha === fechaHoy);
    } else if (t.includes('anteayer')) {
      matchSummary = summaries.find((s) => s.fecha === addDays(fechaHoy, -2));
    }

    if (!matchSummary && t) {
      matchSummary = summaries.find((s) => (s.grupos || []).some((g) => t.includes(g.toLowerCase())));
    }

    if (!matchSummary && summaries.length > 0) {
      matchSummary = summaries[0];
    }

    if (!matchSummary) {
      return { ok: true, mensaje: 'No hay entrenamientos registrados en el cuaderno local.' };
    }

    const detail = await getWorkoutDetail(matchSummary.id);
    if (!detail || !detail.groups?.length) {
      return {
        ok: true,
        fecha: matchSummary.fecha,
        mensaje: `Entrenamiento del ${matchSummary.fecha}: registrado pero sin series guardadas.`
      };
    }

    const ejercicios = detail.groups.map((g) => {
      const setsDesc = g.sets.map((s) => `${s.peso} kg × ${s.reps} reps${s.rir !== null ? ` (RIR ${s.rir})` : ''}`).join(', ');
      return `${g.exercise.nombre} (${g.sets.length} series: ${setsDesc})`;
    });

    const isYesterday = matchSummary.fecha === fechaAyer;
    const isToday = matchSummary.fecha === fechaHoy;
    const temporalLabel = isToday ? 'hoy' : isYesterday ? 'ayer' : `el ${matchSummary.fecha}`;
    const w = detail.workout;
    const duracionMin = w?.finishedAt && w?.startedAt ? Math.max(1, Math.round((w.finishedAt - w.startedAt) / 60000)) : null;
    const durText = duracionMin ? `, duración ${duracionMin} min` : '';

    return {
      ok: true,
      fecha: matchSummary.fecha,
      temporal: temporalLabel,
      grupos: matchSummary.grupos,
      duracionMin,
      volumenTotal: Math.round(detail.volumen),
      totalSeries: detail.totalSets,
      ejercicios,
      resumen: `Entrenamiento de ${temporalLabel} (${matchSummary.grupos.join(', ')}${durText}): ${detail.totalSets} series totales, ${Math.round(detail.volumen)} kg/lb de volumen. Ejercicios: ${ejercicios.join('; ')}.`
    };
  } catch (e) {
    return { error: 'Error al consultar entrenamientos: ' + e.message };
  }
}

export async function getBodyMetricsContextForFit() {
  try {
    const weights = await listBodyWeights();
    if (!weights.length) return '';
    const recent = weights.slice(-5);
    const latest = recent[recent.length - 1];
    const first = recent[0];
    const diff = recent.length > 1 ? Math.round((latest.peso - first.peso) * 10) / 10 : 0;
    const diffStr = recent.length > 1 ? ` (variación reciente: ${diff > 0 ? '+' : ''}${diff} kg)` : '';
    const histStr = recent.map((w) => `${w.fecha}: ${w.peso} kg`).join(', ');
    return `\nHISTORIAL DE PESO CORPORAL (Progreso): Último peso registrado: ${latest.peso} kg (${latest.fecha})${diffStr}. Últimas pesadas: ${histStr}.\n`;
  } catch {
    return '';
  }
}
