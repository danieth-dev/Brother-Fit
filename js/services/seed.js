/* Catálogo base. En cada arranque se añaden los que falten; un nombre ya existente se deja como está. */
import { db } from '../db.js';
import { addExercise } from './workouts.js';

export const BASE = [
  ['Press banca', 'Pecho'], ['Press inclinado con mancuernas', 'Pecho'], ['Aperturas', 'Pecho'],
  ['Press en poleas', 'Pecho'], ['Press Hammer', 'Pecho'], ['Flexiones', 'Pecho'],
  ['Dominadas', 'Espalda'], ['Remo con barra', 'Espalda'], ['Jalón al pecho', 'Espalda'], ['Peso muerto', 'Espalda'],
  ['Remo unilateral', 'Espalda'], ['Remo T', 'Espalda'], ['Jalón a la cara', 'Espalda'],
  ['Sentadilla', 'Piernas'], ['Prensa de piernas', 'Piernas'], ['Prensa de piernas vertical', 'Piernas'],
  ['Peso muerto rumano', 'Piernas'], ['Zancadas', 'Piernas'],
  ['Extensión de pierna', 'Piernas'], ['Sentadilla péndulo', 'Piernas'],
  ['Press militar', 'Hombros'], ['Elevaciones laterales', 'Hombros'], ['Elevaciones frontales', 'Hombros'],
  ['Curl de bíceps', 'Bíceps'], ['Curl martillo', 'Bíceps'],
  ['Fondos', 'Tríceps'], ['Extensión de tríceps', 'Tríceps'], ['Copa', 'Tríceps'],
  ['Plancha', 'Core'], ['Crunch en polea', 'Core']
];

const CATALOG = new Set(BASE.map(([nombre]) => nombre));

/* El catálogo se reconoce por el nombre exacto. Lo demás lo creó el atleta. */
export function isCatalogExercise(nombre) {
  return CATALOG.has(String(nombre || '').trim());
}

export async function ensureSeed() {
  const all = await db.getAll('exercises').catch(() => []);
  const existing = new Set(all.map((e) => e.nombre.toLowerCase().trim()));
  for (const [nombre, grupo] of BASE) {
    if (!existing.has(nombre.toLowerCase().trim())) {
      try {
        await addExercise(nombre, grupo);
        existing.add(nombre.toLowerCase().trim());
      } catch (e) {
        /* Si ya existe o falla por restricción, se ignora */
      }
    }
  }
  await db.put('meta', { key: 'seeded', value: true }).catch(() => {});
}

export async function loadFixtures() {
  try {
    const res = await fetch('./fixtures/latest-backup.json');
    if (!res.ok) return false;
    const payload = await res.json();
    if (payload?.app !== 'brother-ft' || typeof payload.data !== 'object') {
      return false;
    }
    await db.restoreAll(payload.data);
    return true;
  } catch (err) {
    console.warn('Error cargando fixtures:', err);
    return false;
  }
}

