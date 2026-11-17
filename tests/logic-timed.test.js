import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTimed, isTimedSet, parseTime, formatTime, holdPhrase, asMeasured, amountWords } from '../js/services/timed.js';
import { restSeconds, restLabel } from '../js/services/session-plan.js';

test('qué ejercicios se miden en tiempo', () => {
  assert.equal(isTimed({ nombre: 'Plancha' }), true);
  assert.equal(isTimed({ nombre: 'L-sit', medida: 'tiempo' }), true);
  assert.equal(isTimed({ nombre: 'Flexiones' }), false);
  assert.equal(isTimedSet({ segundos: 45, reps: 0 }), true);
  assert.equal(isTimedSet({ reps: 10 }), false);
});

test('el tiempo se escribe como «45» o «1:30»', () => {
  assert.equal(parseTime('45'), 45);
  assert.equal(parseTime('1:30'), 90);
  assert.equal(parseTime(' 0:05 '), 5);
  assert.equal(parseTime('1:75'), NaN);
  assert.equal(parseTime('abc'), NaN);
  assert.equal(parseTime(''), NaN);
  assert.equal(formatTime(45), '0:45');
  assert.equal(formatTime(90), '1:30');
});

test('el esfuerzo de una serie por tiempo se dice en segundos', () => {
  assert.equal(holdPhrase(10), 'al límite');
  assert.equal(holdPhrase(8), 'sobraban 10 s');
  assert.equal(holdPhrase(6), '20 s o más');
});

test('las reglas de repeticiones leen los segundos', () => {
  assert.deepEqual(asMeasured({ peso: 0, reps: 0, segundos: 45 }), { peso: 0, reps: 45, segundos: 45 });
  assert.deepEqual(asMeasured({ peso: 20, reps: 8 }), { peso: 20, reps: 8 });
  assert.equal(amountWords({ reps: 0, segundos: 45 }), '45 s');
  assert.equal(amountWords({ reps: 8 }), '8');
});

test('una serie por tiempo descansa 1:30 y el calentamiento 1:00', () => {
  const auto = { descansoMode: 'auto', descanso: 90 };
  assert.equal(restSeconds(45, auto, { timed: true }), 90);
  assert.equal(restSeconds(45, auto, { timed: true, rir: 0 }), 120);
  assert.equal(restSeconds(45, auto, { timed: true, rir: 1 }), 105);
  assert.equal(restSeconds(45, auto, { timed: true, tipo: 'calentamiento' }), 60);
  assert.equal(restLabel(45, { timed: true }), 'Isométrico · 1:30');
  assert.equal(restLabel(45, { timed: true, rir: 0 }), 'Isométrico · 1:30 + 30 s por llegar al fallo');
  assert.equal(restLabel(45, { timed: true, rir: 1 }), 'Isométrico · 1:30 + 15 s por quedarte a 5 s');
  assert.equal(restLabel(45, { timed: true, tipo: 'calentamiento' }), 'Calentamiento · 1:00');
});
