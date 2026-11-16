import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  estimate1RM, adjusted1RM, rpeEnRango, volume, normalizeGrupo, muscleName, matchExercise,
} from '../js/services/workouts.js';

test('1RM de Epley: una repetición es el peso', () => {
  assert.equal(estimate1RM(100, 1), 100);
  assert.equal(estimate1RM(100, 10), 100 * (1 + 10 / 30));
});

test('1RM ajustado solo con RPE entero de 6 a 10', () => {
  assert.equal(rpeEnRango(8), true);
  assert.equal(rpeEnRango(8.5), false);
  assert.equal(rpeEnRango(5), false);
  assert.equal(rpeEnRango(11), false);
  assert.equal(adjusted1RM(100, 5, 12), null);
  const r = adjusted1RM(100, 5, 8); // 5 reps + 2 en reserva = 7 efectivas
  assert.equal(r.value, 100 * (1 + 7 / 30));
  assert.equal(r.reliable, true);
  assert.equal(r.floor, false);
  assert.equal(adjusted1RM(100, 10, 6).reliable, false); // 14 efectivas
  assert.equal(adjusted1RM(100, 3, 6).floor, true);
});

test('volumen es peso por repeticiones', () => {
  assert.equal(volume([{ peso: 50, reps: 10 }, { peso: 60, reps: 5 }]), 800);
});

test('grupos musculares se normalizan y «Otro» no se muestra', () => {
  assert.equal(normalizeGrupo('triceps'), 'Tríceps');
  assert.equal(normalizeGrupo('Pectoral'), 'Pecho');
  assert.equal(normalizeGrupo(''), 'Otro');
  assert.equal(muscleName('Otro'), '');
  assert.equal(muscleName('espalda'), 'Espalda');
});

const LISTA = [
  { id: 1, nombre: 'Press banca', grupo: 'Pecho' },
  { id: 2, nombre: 'Aperturas', grupo: 'Pecho' },
  { id: 3, nombre: 'Copa', grupo: 'Tríceps' },
  { id: 4, nombre: 'Curl de bíceps', grupo: 'Bíceps' },
  { id: 5, nombre: 'Curl martillo', grupo: 'Bíceps' },
  { id: 6, nombre: 'Dominadas', grupo: 'Espalda' },
];

test('el ejercicio dicho se resuelve sin acentos ni mayúsculas', () => {
  assert.equal(matchExercise('PRESS BANCA', LISTA).exercise?.id, 1);
  assert.equal(matchExercise('curl de biceps', LISTA).exercise?.id, 4);
  assert.equal(matchExercise('dominada', LISTA).exercise?.id, 6); // singular
});

test('el músculo añadido al final no impide reconocerlo', () => {
  assert.equal(matchExercise('aperturas de pecho', LISTA).exercise?.id, 2);
  assert.equal(matchExercise('copa de tríceps', LISTA).exercise?.id, 3);
});

test('varios candidatos o ninguno no eligen por su cuenta', () => {
  assert.equal(matchExercise('curl', LISTA).status, 'many');
  assert.equal(matchExercise('sentadilla búlgara', LISTA).status, 'none');
  assert.equal(matchExercise('', LISTA).status, 'absent');
});
