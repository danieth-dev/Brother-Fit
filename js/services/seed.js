/* Catálogo base. En cada arranque se añaden los que falten; un nombre ya existente se deja como está. */
import { db } from '../db.js';
import { addExercise } from './workouts.js';

const BASE = [
  ['Press banca', 'Pecho'], ['Press inclinado con mancuernas', 'Pecho'], ['Aperturas', 'Pecho'],
  ['Press en poleas', 'Pecho'], ['Press Hammer', 'Pecho'], ['Flexiones', 'Pecho'],
  ['Dominadas', 'Espalda'], ['Remo con barra', 'Espalda'], ['Jalón al pecho', 'Espalda'], ['Peso muerto', 'Espalda'],
  ['Sentadilla', 'Piernas'], ['Prensa de piernas', 'Piernas'], ['Peso muerto rumano', 'Piernas'], ['Zancadas', 'Piernas'],
  ['Extensión de pierna', 'Piernas'], ['Sentadilla péndulo', 'Piernas'],
  ['Press militar', 'Hombros'], ['Elevaciones laterales', 'Hombros'],
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
  for (const [nombre, grupo] of BASE) {
    try {
      await addExercise(nombre, grupo);
    } catch (e) {
      if (e?.message !== 'Ese ejercicio ya existe.') throw e;
    }
  }
  await db.put('meta', { key: 'seeded', value: true });
}
