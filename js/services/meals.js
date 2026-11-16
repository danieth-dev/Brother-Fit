/* Diario de comidas: guardar, leer y resumir el día, y lo que Bía sabe de las comidas.
 * Solo se guardan números y el desglose de alimentos; las fotos nunca se guardan.
 * Cálculos puros en nutrition.js, catálogo en food-catalog.js y análisis con IA en meal-ai.js. */
import { db } from '../db.js';
import { state, DEFAULTS } from '../store.js';
import { todayISO, addDays } from '../utils/dates.js';
import { now } from '../utils/clock.js';
import {
  MEAL_TYPES, normalizeMealItem, summarizeItems, buildMealTitle, macroPercents,
  defaultMealTypeByHour, currentTimeHHMM,
} from './nutrition.js';

const WEEK_DAYS = 7;

export function getNutritionTargets() {
  const s = state.settings || {};
  return {
    kcal: Number(s.metaKcal) || DEFAULTS.metaKcal,
    proteina: Number(s.metaProteina) || DEFAULTS.metaProteina,
    carbos: Number(s.metaCarbos) || DEFAULTS.metaCarbos,
    grasa: Number(s.metaGrasa) || DEFAULTS.metaGrasa,
    objetivo: s.metaObjetivo || DEFAULTS.metaObjetivo,
  };
}

export async function listMealsByDate(fecha = todayISO()) {
  const rows = await db.byIndex('meals', 'fecha', fecha);
  return rows.sort((a, b) => (a.ts || 0) - (b.ts || 0));
}

export async function getMealById(id) {
  return db.get('meals', Number(id));
}

/* Con desglose, los totales salen de los alimentos; sin él, de lo que se escribió. */
function mealTotals(entry, items) {
  if (items.length) return summarizeItems(items);
  const round = (key) => Math.round(Number(entry[key]) || 0);
  return { kcal: round('kcal'), proteina: round('proteina'), carbos: round('carbos'), grasa: round('grasa') };
}

export async function saveMeal(entry) {
  const items = (entry.items || []).map(normalizeMealItem).filter((i) => i.gramos > 0);
  const totals = mealTotals(entry, items);
  const ahora = new Date(now());
  const tipo = MEAL_TYPES.includes(entry.tipo) ? entry.tipo : defaultMealTypeByHour(ahora);
  const record = {
    fecha: entry.fecha || todayISO(),
    ts: entry.ts || ahora.getTime(),
    hora: entry.hora || currentTimeHHMM(ahora),
    tipo,
    nombre: (entry.nombre || '').trim() || buildMealTitle(items, tipo),
    ...totals,
    items,
    origen: entry.origen || 'foto',
  };
  if (entry.id != null) {
    record.id = Number(entry.id);
    await db.put('meals', record);
    return record.id;
  }
  return db.add('meals', record);
}

export async function deleteMeal(id) {
  return db.remove('meals', Number(id));
}

export async function todayMealsSummary(fecha = todayISO()) {
  const meals = await listMealsByDate(fecha);
  const targets = getNutritionTargets();
  const totals = summarizeItems(meals);
  return {
    fecha,
    meals,
    totals,
    targets,
    pct: macroPercents(totals, targets),
    remainingKcal: Math.max(0, targets.kcal - totals.kcal),
    surplusKcal: Math.max(0, totals.kcal - targets.kcal),
  };
}

/* ---------- Lo que Bía consulta ---------- */

function dayEntry(fecha, list, { today, yesterday }) {
  const sum = (key) => list.reduce((acc, m) => acc + (Number(m[key]) || 0), 0);
  return {
    fecha,
    etiqueta: fecha === today ? 'Hoy' : fecha === yesterday ? 'Ayer' : fecha,
    comidasCount: list.length,
    kcal: sum('kcal'),
    proteina: sum('proteina'),
    carbos: sum('carbos'),
    grasa: sum('grasa'),
    platos: list.map((m) => `${m.tipo}: ${m.nombre} (${m.kcal} kcal, ${m.proteina}g P)`),
  };
}

async function weekHistory(today, yesterday) {
  const start = addDays(today, -(WEEK_DAYS - 1));
  const byDate = new Map();
  for (let i = 0; i < WEEK_DAYS; i++) byDate.set(addDays(today, -i), []);
  for (const m of await db.getAll('meals')) {
    if (m.fecha >= start && m.fecha <= today) byDate.get(m.fecha)?.push(m);
  }
  const dias = [...byDate].map(([fecha, list]) => dayEntry(fecha, list, { today, yesterday }));
  const logged = dias.filter((d) => d.comidasCount > 0);
  const avg = (key) => (logged.length ? Math.round(logged.reduce((a, d) => a + d[key], 0) / logged.length) : 0);
  return {
    periodo: 'ultimos_7_dias',
    metasDiarias: getNutritionTargets(),
    diasConRegistro: logged.length,
    promedioKcal: avg('kcal'),
    promedioProteina: avg('proteina'),
    dias,
  };
}

function dateForPeriod(q, today, yesterday) {
  if (q.includes('anteayer')) return addDays(today, -2);
  if (q.includes('ayer')) return yesterday;
  if (/^\d{4}-\d{2}-\d{2}$/.test(q)) return q;
  return today;
}

/* Consulta histórica para la herramienta consultar_comidas de Bía ('hoy', 'ayer', 'semana' o 'YYYY-MM-DD'). */
export async function getMealsHistoryForFit(periodo = 'hoy') {
  const q = String(periodo || 'hoy').trim().toLowerCase();
  const today = todayISO();
  const yesterday = addDays(today, -1);
  if (q.includes('sem') || q.includes('7') || q.includes('hist')) return weekHistory(today, yesterday);

  const s = await todayMealsSummary(dateForPeriod(q, today, yesterday));
  return {
    fecha: s.fecha,
    esHoy: s.fecha === today,
    metas: s.targets,
    consumido: s.totals,
    restante: { kcal: s.remainingKcal, proteina: Math.max(0, s.targets.proteina - s.totals.proteina) },
    comidas: s.meals.map((m) => ({
      id: m.id,
      hora: m.hora,
      tipo: m.tipo,
      nombre: m.nombre,
      kcal: m.kcal,
      proteina: m.proteina,
      carbos: m.carbos,
      grasa: m.grasa,
      items: (m.items || []).map((i) => ({ nombre: i.nombre, gramos: i.gramos, kcal: i.kcal, proteina: i.proteina })),
    })),
  };
}

function mealLine(m) {
  const itemsDesc = (m.items || []).map((i) => `${i.nombre} ${i.gramos}g`).join(', ');
  return `  * [ID ${m.id}] ${m.hora} · ${m.tipo}: ${m.nombre} — ${m.kcal} kcal, Proteína ${m.proteina} g${itemsDesc ? ` (${itemsDesc})` : ''}.`;
}

/* Bloque de texto con el diario de hoy y el cierre de ayer para las instrucciones de Bía. */
export async function getMealsContextForFit() {
  try {
    const today = todayISO();
    const yesterday = addDays(today, -1);
    const [s, sY] = await Promise.all([todayMealsSummary(today), todayMealsSummary(yesterday)]);
    const protFalta = Math.max(0, s.targets.proteina - s.totals.proteina);
    const lines = [
      `\n\nNUTRICIÓN Y COMIDAS DE HOY (${s.fecha}):`,
      `- Meta diaria (${s.targets.objetivo}): ${s.targets.kcal} kcal · Proteína ${s.targets.proteina} g · Carbohidratos ${s.targets.carbos} g · Grasa ${s.targets.grasa} g.`,
      `- Consumido hoy: ${s.totals.kcal} kcal · Proteína ${s.totals.proteina} g · Carbohidratos ${s.totals.carbos} g · Grasa ${s.totals.grasa} g.`,
      `- Restante hoy: ${s.remainingKcal} kcal y ${protFalta} g de proteína para llegar a la meta.`,
    ];
    if (s.meals.length) lines.push('- Comidas registradas hoy:', ...s.meals.map(mealLine));
    else lines.push('- Comidas registradas hoy: Ninguna todavía.');
    if (sY.meals.length) {
      lines.push(`- Cierre de ayer (${yesterday}): ${sY.totals.kcal} / ${sY.targets.kcal} kcal · Proteína ${sY.totals.proteina} / ${sY.targets.proteina} g (${sY.meals.length} comidas).`);
    }
    return lines.join('\n');
  } catch {
    return '';
  }
}
