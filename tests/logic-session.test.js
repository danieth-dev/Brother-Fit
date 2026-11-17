import { test } from 'node:test';
import assert from 'node:assert/strict';
import { restZone, restSeconds, restLabel, effortBonus, workoutTitle, orderExercises, nextRoutineStep, routineComplete, ROUTINE_DONE } from '../js/services/session-plan.js';
import { formatWeekdayShort, formatCountdown } from '../js/utils/dates.js';

test('descanso automático por repeticiones; el fijo sale de Ajustes', () => {
  assert.equal(restZone(5).secs, 180);
  assert.equal(restZone(8).secs, 120);
  assert.equal(restZone(12).secs, 90);
  assert.equal(restZone(20).secs, 90);
  assert.equal(restSeconds(6, { descansoMode: 'auto', descanso: 75 }), 120);
  assert.equal(restSeconds(6, { descansoMode: 'fijo', descanso: 75 }), 75);
});

test('cerca del fallo se descansa un poco más', () => {
  const auto = { descansoMode: 'auto', descanso: 90 };
  assert.equal(restSeconds(10, auto, { rir: 0 }), 120);
  assert.equal(restSeconds(10, auto, { rir: 1 }), 105);
  assert.equal(restSeconds(10, auto, { rir: 2 }), 90);
  assert.equal(restSeconds(10, auto, { rir: 4 }), 90);
  assert.equal(restSeconds(10, auto, { rir: null }), 90);
  assert.equal(restSeconds(15, auto, { rir: 3 }), 90);
});

test('calentamiento y modo manual no se ajustan por esfuerzo', () => {
  assert.equal(effortBonus(0, 'calentamiento'), 0);
  assert.equal(effortBonus(1.5), 0);
  assert.equal(restSeconds(10, { descansoMode: 'auto', descanso: 90 }, { rir: 0, tipo: 'calentamiento' }), 90);
  assert.equal(restSeconds(10, { descansoMode: 'manual', descanso: 90 }, { rir: 0 }), 90);
});

test('la etiqueta del descanso dice por qué se alargó', () => {
  assert.equal(restLabel(10, { rir: 0 }), 'Hipertrofia · 1:30 + 30 s por llegar al fallo');
  assert.equal(restLabel(10, { rir: 1 }), 'Hipertrofia · 1:30 + 15 s por quedarte a 1');
  assert.equal(restLabel(10, { rir: 3 }), 'Hipertrofia · 1:30');
  assert.equal(restLabel(10), 'Hipertrofia · 1:30');
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

test('la rutina está hecha solo con todos sus ejercicios y sus series', () => {
  const routine = [10, 20, 30];
  const planned = new Map([[10, 3], [20, 3], [30, 2]]);
  const all = new Map([[10, 3], [20, 4], [30, 2]]);
  assert.equal(routineComplete(routine, 30, new Map([[30, 2]]), planned), false);
  assert.equal(routineComplete(routine, 30, new Map([[10, 3], [20, 2], [30, 2]]), planned), false);
  assert.equal(routineComplete(routine, 30, all, planned), true);
  // Todo hecho, pero está añadiendo series a otro ejercicio: no es el final.
  assert.equal(routineComplete(routine, 20, all, planned), false);
  assert.equal(routineComplete(routine, 99, all, planned), false);
  assert.equal(routineComplete(routine, 30, new Map([[10, 1], [20, 1], [30, 1]]), new Map()), true);
  assert.equal(routineComplete(routine, 30, new Map([[10, 1], [30, 1]]), new Map()), false);
  // Entreno nuevo, sin rutina: nunca.
  assert.equal(routineComplete([], 10, new Map([[10, 5]]), planned), false);
  assert.equal(routineComplete(null, 10, new Map(), planned), false);
});

test('la cuenta atrás del descanso redondea hacia arriba', () => {
  assert.equal(formatCountdown(88), '1:28');
  assert.equal(formatCountdown(87.2), '1:28');
  assert.equal(formatCountdown(5), '0:05');
  assert.equal(formatCountdown(0), '0:00');
  assert.equal(formatCountdown(-3), '0:00');
});
