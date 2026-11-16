/* Cálculos de nutrición sin base de datos: metas por objetivo, alimentos por cada 100 g,
 * totales y nombres de platos. Reglas puras, probadas en tests/logic-meals.test.js. */

export const MEAL_TYPES = ['Desayuno', 'Almuerzo', 'Merienda', 'Cena'];

/* Peso que se usa para calcular metas: fuera de este rango la fórmula deja de tener sentido. */
const MIN_PESO_META = 35;
const MAX_PESO_META = 180;

/* Por objetivo: kcal por kg, proteína y grasa en g por kg, y un piso de carbohidratos en g. */
const GOALS = {
  definir: { kcalKg: 30, protKg: 2.2, grasaKg: 1.0, minCarbos: 60 },
  mantener: { kcalKg: 36, protKg: 1.9, grasaKg: 1.2, minCarbos: 80 },
  ganar: { kcalKg: 43, protKg: 2.05, grasaKg: 1.35, minCarbos: 100 },
};

const KCAL_POR_G = { proteina: 4, carbos: 4, grasa: 9 };

/* Metas recomendadas según el peso corporal del atleta y su objetivo.
 * Sin un peso registrado no hay recomendación: devuelve null y la pantalla lo pide. */
export function calculateTargetsForGoal(objetivo, pesoKg) {
  if (!(Number(pesoKg) > 0)) return null;
  const goal = GOALS[objetivo] ? objetivo : 'ganar';
  const { kcalKg, protKg, grasaKg, minCarbos } = GOALS[goal];
  const w = Math.max(MIN_PESO_META, Math.min(MAX_PESO_META, Number(pesoKg)));
  const kcal = Math.round((w * kcalKg) / 10) * 10;
  const proteina = Math.round(w * protKg);
  const grasa = Math.round(w * grasaKg);
  const carbos = Math.max(minCarbos, Math.round((kcal - proteina * KCAL_POR_G.proteina - grasa * KCAL_POR_G.grasa) / KCAL_POR_G.carbos));
  return { kcal, proteina, carbos, grasa, objetivo: goal };
}

export function defaultMealTypeByHour(d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 5 && h < 11.5) return 'Desayuno';
  if (h >= 11.5 && h < 16) return 'Almuerzo';
  if (h >= 16 && h < 19.5) return 'Merienda';
  return 'Cena';
}

export function currentTimeHHMM(d = new Date()) {
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Cuánto suben o bajan los botones de gramos: pasos finos para porciones chicas. */
export function stepForGrams(g) {
  const val = Number(g) || 0;
  if (val <= 25) return 5;
  if (val <= 90) return 10;
  return 20;
}

const round1 = (n) => Math.round(n * 10) / 10;
const per100 = (stored, total, base) => (stored != null ? Number(stored) : (total / base) * 100);
const scale = (densidad, gramos) => (densidad * gramos) / 100;

/* Normaliza un ingrediente para que conserve su densidad nutricional por cada 100 g
 * y permita recalcular sin pérdida de precisión al subir/bajar gramos. */
export function normalizeMealItem(raw) {
  const gramos = Math.max(0, Math.round(Number(raw.gramos) || 100));
  const base = gramos > 0 ? gramos : 100;
  const kcal = Math.max(0, Math.round(Number(raw.kcal) || 0));
  const proteina = Math.max(0, round1(Number(raw.proteina) || 0));
  const carbos = Math.max(0, round1(Number(raw.carbos) || 0));
  const grasa = Math.max(0, round1(Number(raw.grasa) || 0));

  const kcal100 = per100(raw.kcal100, kcal, base);
  const p100 = per100(raw.p100, proteina, base);
  const c100 = per100(raw.c100, carbos, base);
  const g100 = per100(raw.g100, grasa, base);

  return {
    nombre: String(raw.nombre || 'Alimento').trim(),
    gramos,
    kcal: Math.round(scale(kcal100, gramos)),
    proteina: round1(scale(p100, gramos)),
    carbos: round1(scale(c100, gramos)),
    grasa: round1(scale(g100, gramos)),
    kcal100,
    p100,
    c100,
    g100,
  };
}

export function recalcItemGrams(item, newGrams) {
  const n = normalizeMealItem(item);
  const g = Math.max(0, Math.round(Number(newGrams) || 0));
  return {
    ...n,
    gramos: g,
    kcal: Math.round(scale(n.kcal100, g)),
    proteina: round1(scale(n.p100, g)),
    carbos: round1(scale(n.c100, g)),
    grasa: round1(scale(n.g100, g)),
  };
}

export function buildItemFromCatalog(food, customGrams) {
  const g = customGrams != null ? Number(customGrams) : food.porcion;
  const { nombre, kcal100, p100, c100, g100 } = food;
  return recalcItemGrams({ nombre, gramos: g, kcal100, p100, c100, g100 }, g);
}

export function summarizeItems(items = []) {
  const sum = (key) => Math.round(items.reduce((acc, it) => acc + (Number(it[key]) || 0), 0));
  return { kcal: sum('kcal'), proteina: sum('proteina'), carbos: sum('carbos'), grasa: sum('grasa') };
}

/** Porcentaje de cada meta, con tope en 100. */
export function macroPercents(totals, targets) {
  const pct = (key) => (targets[key] > 0 ? Math.min(100, Math.round((totals[key] / targets[key]) * 100)) : 0);
  return { kcal: pct('kcal'), proteina: pct('proteina'), carbos: pct('carbos'), grasa: pct('grasa') };
}

export function buildMealTitle(items = [], fallback = 'Comida registrada') {
  const names = items.filter((i) => i.gramos > 0 && i.nombre).map((i) => i.nombre.trim());
  if (!names.length) return fallback;
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} y ${names[1].toLowerCase()}`;
  return `${names[0]}, ${names[1].toLowerCase()} y ${names[2].toLowerCase()}`;
}
