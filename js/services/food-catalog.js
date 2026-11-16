/* Catálogo local de alimentos frecuentes y lector de descripciones sin IA.
 * Regla pura: sin base ni red. Se usa cuando no hay clave o la IA no responde. */
import { buildItemFromCatalog, buildMealTitle } from './nutrition.js';

/* Valores por cada 100 g + porción típica en g. */
export const COMMON_FOODS = [
  { nombre: 'Papas en air fryer / horno', porcion: 180, kcal100: 115, p100: 2.5, c100: 24.0, g100: 1.2 },
  { nombre: 'Huevo frito / a la plancha', porcion: 60, kcal100: 196, p100: 13.6, c100: 0.8, g100: 14.8 },
  { nombre: 'Carne molida de res', porcion: 140, kcal100: 215, p100: 24.0, c100: 0.0, g100: 13.0 },
  { nombre: 'Arroz blanco cocido', porcion: 180, kcal100: 130, p100: 2.7, c100: 28.2, g100: 0.3 },
  { nombre: 'Pechuga de pollo', porcion: 140, kcal100: 165, p100: 31.0, c100: 0.0, g100: 3.6 },
  { nombre: 'Ensalada mixta', porcion: 90, kcal100: 28, p100: 1.4, c100: 4.5, g100: 0.4 },
  { nombre: 'Aceite de cocción / oliva', porcion: 5, kcal100: 884, p100: 0.0, c100: 0.0, g100: 100.0 },
  { nombre: 'Huevo entero cocido', porcion: 120, kcal100: 155, p100: 13.0, c100: 1.1, g100: 11.0 },
  { nombre: 'Arepa de maíz asada', porcion: 130, kcal100: 195, p100: 4.5, c100: 41.0, g100: 1.2 },
  { nombre: 'Avena en hojuelas', porcion: 60, kcal100: 389, p100: 16.9, c100: 66.3, g100: 6.9 },
  { nombre: 'Plátano / Banano', porcion: 120, kcal100: 89, p100: 1.1, c100: 22.8, g100: 0.3 },
  { nombre: 'Plátano macho maduro', porcion: 150, kcal100: 122, p100: 1.3, c100: 31.9, g100: 0.4 },
  { nombre: 'Leche entera', porcion: 240, kcal100: 61, p100: 3.2, c100: 4.8, g100: 3.3 },
  { nombre: 'Leche descremada', porcion: 240, kcal100: 35, p100: 3.4, c100: 5.0, g100: 0.1 },
  { nombre: 'Carne de res magra', porcion: 150, kcal100: 215, p100: 26.0, c100: 0.0, g100: 12.0 },
  { nombre: 'Atún al natural', porcion: 120, kcal100: 116, p100: 25.5, c100: 0.0, g100: 1.0 },
  { nombre: 'Salmón a la plancha', porcion: 150, kcal100: 208, p100: 20.4, c100: 0.0, g100: 13.4 },
  { nombre: 'Pasta cocida', porcion: 180, kcal100: 158, p100: 5.8, c100: 30.9, g100: 0.9 },
  { nombre: 'Papa / Patata cocida', porcion: 200, kcal100: 87, p100: 1.9, c100: 20.1, g100: 0.1 },
  { nombre: 'Batata / Camote asado', porcion: 180, kcal100: 90, p100: 2.0, c100: 20.7, g100: 0.2 },
  { nombre: 'Pan integral', porcion: 60, kcal100: 247, p100: 13.0, c100: 41.0, g100: 3.4 },
  { nombre: 'Aguacate / Palta', porcion: 80, kcal100: 160, p100: 2.0, c100: 8.5, g100: 14.7 },
  { nombre: 'Lentejas cocidas', porcion: 180, kcal100: 116, p100: 9.0, c100: 20.1, g100: 0.4 },
  { nombre: 'Frijoles / Caraotas cocidas', porcion: 160, kcal100: 127, p100: 8.7, c100: 22.8, g100: 0.5 },
  { nombre: 'Yogur griego natural', porcion: 170, kcal100: 97, p100: 9.0, c100: 3.9, g100: 5.0 },
  { nombre: 'Frutos secos / Almendras', porcion: 30, kcal100: 579, p100: 21.2, c100: 21.6, g100: 49.9 },
  { nombre: 'Mantequilla de maní', porcion: 25, kcal100: 588, p100: 25.0, c100: 20.0, g100: 50.0 },
  { nombre: 'Proteína Whey (1 scoop)', porcion: 30, kcal100: 390, p100: 78.0, c100: 8.0, g100: 5.0 },
  { nombre: 'Queso blanco / Mozzarella', porcion: 50, kcal100: 280, p100: 22.0, c100: 2.2, g100: 21.0 },
];

const EGG_G = 60;
/* «3 arepas» son unidades; «150 arroz» ya son gramos. */
const MAX_UNITS = 12;
/* Palabras del nombre que no sirven para reconocer el alimento. */
const STOP_WORDS = new Set(['cocido', 'cocida', 'natural', 'entera', 'entero', 'horno', 'plancha', 'frito']);

const isEgg = (name) => name.includes('huevo');

function keywordsOf(foodLower) {
  return foodLower.split(/[\s/]+/).filter((w) => w.length > 3 && !STOP_WORDS.has(w));
}

/* Un solo huevo por descripción, y el que coincide con cómo se preparó. */
function skipEgg(foodLower, { boiled, fried, hasEgg }) {
  if (!isEgg(foodLower)) return false;
  if (hasEgg) return true;
  if (boiled && foodLower.includes('frito')) return true;
  if (fried && foodLower.includes('cocido')) return true;
  return false;
}

function gramsFor(food, foodLower, keyword, text) {
  const grams = text.match(new RegExp(`(\\d+)\\s*(?:g|gr|gramos)\\s*(?:de\\s+)?${keyword}`, 'i'));
  if (grams) return Number(grams[1]);
  const units = text.match(new RegExp(`(\\d+)\\s+${keyword}`, 'i'));
  if (units) {
    const n = Number(units[1]);
    return n <= MAX_UNITS ? n * (isEgg(foodLower) ? EGG_G : food.porcion) : n;
  }
  // «Huevo cocido» sin cantidad: uno.
  return foodLower.includes('huevo entero') ? EGG_G : food.porcion;
}

/**
 * Reconoce alimentos del catálogo en «me comí dos huevos y una arepa».
 * Si nada se reconoce, devuelve items vacíos: nunca se inventa un plato.
 */
export function parseMealTextLocally(text) {
  const clean = String(text || '').trim();
  const lower = clean.toLowerCase();
  const prep = {
    boiled: /huevo.*(sancochad|hervid|duro|cocid)/i.test(lower),
    fried: /huevo.*(frit|plancha|revuelt)/i.test(lower),
    hasEgg: false,
  };
  const items = [];
  for (const food of COMMON_FOODS) {
    const foodLower = food.nombre.toLowerCase();
    if (skipEgg(foodLower, prep)) continue;
    const keywords = keywordsOf(foodLower);
    if (!keywords.some((kw) => lower.includes(kw))) continue;
    items.push(buildItemFromCatalog(food, gramsFor(food, foodLower, keywords[0], clean)));
    if (isEgg(foodLower)) prep.hasEgg = true;
  }
  return items.length ? { plato: buildMealTitle(items, clean), items } : { plato: clean, items: [] };
}
