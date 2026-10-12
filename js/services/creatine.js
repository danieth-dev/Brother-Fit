/* Registro de creatina basado en evidencia científica.
 *
 * CIENCIA:
 *  - Sin fase de carga: saturación muscular completa en ~28 días con 3–5 g/día.
 *  - Con fase de carga: ~5–7 días con 20 g/día (4 dosis de 5 g), luego mantenimiento 3–5 g/día.
 *  - Consistencia es clave: un día sin tomar retrasa la saturación.
 *  - Efectos cognitivos y físicos perceptibles generalmente a las 4 semanas de saturación.
 *  - Monohidrato de creatina es la forma más estudiada y efectiva (>500 estudios).
 *  - Tomar con agua abundante (>500 ml/día extra); cafeína no interfiere según meta-análisis 2023.
 *
 * La tabla `supplements` es genérica (campo `tipo`) para poder sumar otros
 * suplementos sin cambiar el esquema. */
import { db } from '../db.js';
import { todayISO, nowHM, addDays, parseISO } from '../utils/dates.js';

const TIPO = 'creatina';

// Días para considerar saturación completa sin fase de carga
export const SATURATION_DAYS = 28;
// Días con >90% consistencia para declarar "en zona"
export const CONSISTENCY_THRESHOLD = 0.9;

export const logIntake = ({ cantidad, fecha = todayISO(), hora = nowHM() }) =>
  db.add('supplements', { tipo: TIPO, fecha, hora, cantidad, ts: Date.now() });

export const deleteIntake = (id) => db.remove('supplements', id);

export async function listIntakes() {
  const all = await db.byIndex('supplements', 'tipo', TIPO);
  return all.sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora));
}

/* fecha -> { count, gramos } */
export function daysMap(intakes) {
  const m = new Map();
  for (const i of intakes) {
    const a = m.get(i.fecha) || { count: 0, gramos: 0 };
    a.count++; a.gramos += i.cantidad || 0;
    m.set(i.fecha, a);
  }
  return m;
}

/* Días consecutivos. Si hoy aún no hay toma, la racha sigue viva contando desde ayer. */
export function streak(map, today = todayISO()) {
  let day = map.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (map.has(day)) { n++; day = addDays(day, -1); }
  return n;
}

export function countLastDays(map, n, today = todayISO()) {
  let c = 0;
  for (let i = 0; i < n; i++) if (map.has(addDays(today, -i))) c++;
  return c;
}

/**
 * Calcula el progreso científico de saturación muscular.
 *
 * Modelo simplificado:
 *  - Cada día tomado aporta progreso hacia los 28 días de saturación.
 *  - Un día sin tomar NO resetea; descuenta ligeramente (depósito no se vacía en 1 día).
 *  - Los primeros 28 días consistentes = saturación base.
 *  - Después, el mantenimiento diario preserva el nivel.
 *
 * Retorna:
 *  - diasEfectivos: días acumulados con toma en la ventana de saturación
 *  - porcentajeSaturacion: 0–100
 *  - fase: 'inicio' | 'cargando' | 'saturando' | 'mantenimiento'
 *  - semanasEfecto: semanas estimadas hasta efectos perceptibles
 *  - primerDia: ISO del primer día registrado (o null)
 *  - diasTotales: días calendario desde el primer día
 */
export function saturationProgress(map, today = todayISO()) {
  if (map.size === 0) {
    return {
      diasEfectivos: 0,
      porcentajeSaturacion: 0,
      fase: 'inicio',
      semanasEfecto: 4,
      primerDia: null,
      diasTotales: 0,
      consistencia28: 0,
    };
  }

  // Encontrar el primer día registrado
  const sortedDays = [...map.keys()].sort();
  const primerDia = sortedDays[0];

  // Días calendario desde el primer día hasta hoy
  const msPerDay = 86400000;
  const diasTotales = Math.floor((parseISO(today) - parseISO(primerDia)) / msPerDay) + 1;

  // Días efectivos en los últimos 28 días
  const diasUltimos28 = countLastDays(map, 28, today);
  const consistencia28 = Math.round((diasUltimos28 / Math.min(diasTotales, 28)) * 100);

  // Días efectivos totales (para saturación: los primeros 28 cuentan doble)
  const diasEfectivos = Math.min(diasUltimos28, 28);
  const porcentajeSaturacion = Math.min(100, Math.round((diasEfectivos / SATURATION_DAYS) * 100));

  // Determinar fase
  let fase;
  if (diasTotales < 7) {
    fase = 'inicio';
  } else if (porcentajeSaturacion < 50) {
    fase = 'cargando';
  } else if (porcentajeSaturacion < 100) {
    fase = 'saturando';
  } else {
    fase = 'mantenimiento';
  }

  // Semanas estimadas hasta efectos perceptibles
  const diasFaltantes = Math.max(0, SATURATION_DAYS - diasEfectivos);
  const semanasEfecto = Math.ceil(diasFaltantes / 7);

  return {
    diasEfectivos,
    porcentajeSaturacion,
    fase,
    semanasEfecto,
    primerDia,
    diasTotales,
    consistencia28,
  };
}

export async function creatineSummary() {
  const intakes = await listIntakes();
  const map = daysMap(intakes);
  const hoy = map.get(todayISO()) || { count: 0, gramos: 0 };
  const saturacion = saturationProgress(map);
  return {
    intakes, map, hoy,
    tomadaHoy: hoy.count > 0,
    racha: streak(map),
    dias7: countLastDays(map, 7),
    dias30: countLastDays(map, 30),
    saturacion,
  };
}
