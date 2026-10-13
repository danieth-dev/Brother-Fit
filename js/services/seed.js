/* Catálogo base. En cada arranque se añaden los que falten; un nombre ya existente se deja como está. */
import { db } from '../db.js';
import { addExercise } from './workouts.js';

const BASE = [
  ['Press banca', 'Pecho'], ['Press inclinado con mancuernas', 'Pecho'], ['Aperturas', 'Pecho'],
  ['Press en poleas', 'Pecho'], ['Press Hammer', 'Pecho'],
  ['Dominadas', 'Espalda'], ['Remo con barra', 'Espalda'], ['Jalón al pecho', 'Espalda'], ['Peso muerto', 'Espalda'],
  ['Sentadilla', 'Piernas'], ['Prensa de piernas', 'Piernas'], ['Peso muerto rumano', 'Piernas'], ['Zancadas', 'Piernas'],
  ['Press militar', 'Hombros'], ['Elevaciones laterales', 'Hombros'],
  ['Curl de bíceps', 'Bíceps'], ['Curl martillo', 'Bíceps'],
  ['Fondos', 'Tríceps'], ['Extensión de tríceps', 'Tríceps'],
  ['Plancha', 'Core'], ['Crunch en polea', 'Core']
];

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
