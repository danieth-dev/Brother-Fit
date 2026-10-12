/* Ejercicios iniciales (solo la primera vez). Los duplicados se ignoran. */
import { db } from '../db.js';
import { addExercise } from './workouts.js';

const BASE = [
  ['Press banca', 'Pecho'], ['Press inclinado con mancuernas', 'Pecho'], ['Aperturas', 'Pecho'],
  ['Dominadas', 'Espalda'], ['Remo con barra', 'Espalda'], ['Jalón al pecho', 'Espalda'], ['Peso muerto', 'Espalda'],
  ['Sentadilla', 'Piernas'], ['Prensa de piernas', 'Piernas'], ['Peso muerto rumano', 'Piernas'], ['Zancadas', 'Piernas'],
  ['Press militar', 'Hombros'], ['Elevaciones laterales', 'Hombros'],
  ['Curl de bíceps', 'Bíceps'], ['Curl martillo', 'Bíceps'],
  ['Fondos', 'Tríceps'], ['Extensión de tríceps', 'Tríceps'],
  ['Plancha', 'Core'], ['Crunch en polea', 'Core']
];

export async function ensureSeed() {
  if (await db.get('meta', 'seeded')) return;
  for (const [nombre, grupo] of BASE) {
    try { await addExercise(nombre, grupo); } catch { /* ya existía */ }
  }
  await db.put('meta', { key: 'seeded', value: true });
}
