import { test } from 'node:test';
import assert from 'node:assert/strict';
import { restZone, restSeconds, workoutTitle, orderExercises, nextRoutineStep, ROUTINE_DONE } from '../js/services/session-plan.js';
import { formatWeekdayShort } from '../js/utils/dates.js';

test('descanso automático por repeticiones; el fijo sale de Ajustes', () => {
  assert.equal(restZone(5).secs, 180);
  assert.equal(restZone(8).secs, 120);
  assert.equal(restZone(12).secs, 90);
  assert.equal(restZone(20).secs, 60);
  assert.equal(restSeconds(6, { descansoMode: 'auto', descanso: 75 }), 120);
  assert.equal(restSeconds(6, { descansoMode: 'fijo', descanso: 75 }), 75);
});

test('título de una sesión por sus grupos', () => {
  assert.equal(workoutTitle([]), 'Entrenamiento');
  assert.equal(workoutTitle(['Pecho', 'Espalda']), 'Pecho y Espalda');
  assert.equal(workoutTitle(['A', 'B', 'C']), 'A, B y C');
  assert.equal(workoutTitle(['A', 'B', 'C', 'D']), 'A, B (+2)');
});

test('lista de ejercicios: hoy, luego rutina, luego catálogo', () => {
  const exs = [1, 2, 3, 4, 5].map((id) => ({ id }));
  assert.deepEqual(orderExercises(exs, [4], [5, 2]).map((e) => e.id), [4, 5, 2, 1, 3]);
  assert.deepEqual(orderExercises(exs).map((e) => e.id), [1, 2, 3, 4, 5]);
});

test('rutina: siguiente ejercicio al igualar las series de la vez anterior', () => {
  const routine = [10, 20, 30];
  assert.equal(nextRoutineStep(routine, 10, 3, 2), null);
  assert.equal(nextRoutineStep(routine, 10, 3, 3), 20);
  assert.equal(nextRoutineStep(routine, 30, 3, 4), ROUTINE_DONE);
  assert.equal(nextRoutineStep(routine, 99, 3, 3), null);
  assert.equal(nextRoutineStep(routine, 10, 0, 5), null);
  assert.equal(nextRoutineStep([], 10, 3, 3), null);
});

test('fecha corta fija en español', () => {
  assert.equal(formatWeekdayShort('2026-10-29'), 'Jue 29 Oct');
  assert.equal(formatWeekdayShort(''), '');
});
