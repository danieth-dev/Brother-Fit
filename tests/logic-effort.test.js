import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyRir, rpeFromRir, effortAnswerFromText, needsEffortMark, effortPhrase } from '../js/services/effort.js';

test('el RIR válido es un entero desde 0', () => {
  assert.equal(classifyRir(0), 'ok');
  assert.equal(classifyRir('2'), 'ok');
  assert.equal(classifyRir(null), 'absent');
  assert.equal(classifyRir(''), 'absent');
  assert.equal(classifyRir(-1), 'invalid');
  assert.equal(classifyRir(1.5), 'invalid');
  assert.equal(classifyRir(true), 'invalid');
});

test('RPE = 10 - RIR, con 4 o más como piso de RPE 6', () => {
  assert.equal(rpeFromRir(0), 10);
  assert.equal(rpeFromRir(2), 8);
  assert.equal(rpeFromRir(4), 6);
  assert.equal(rpeFromRir(9), 6);
  assert.equal(effortPhrase(6), '4 o más');
});

test('respuestas dichas al «¿cuántas más podrías?»', () => {
  assert.deepEqual(effortAnswerFromText('cero'), { rir: 0 });
  assert.deepEqual(effortAnswerFromText('Ninguna.'), { rir: 0 });
  assert.deepEqual(effortAnswerFromText('dos'), { rir: 2 });
  assert.deepEqual(effortAnswerFromText('cuatro o más'), { rir: 4 });
  assert.deepEqual(effortAnswerFromText('no sé'), { omitir: true });
});

test('una serie dictada no se toma como esfuerzo', () => {
  assert.equal(effortAnswerFromText('10 repeticiones con 40 kilos'), null);
  assert.equal(effortAnswerFromText('hice 8'), null);
  assert.equal(effortAnswerFromText(''), null);
});

test('solo una serie de trabajo sin RPE pide esfuerzo', () => {
  assert.equal(needsEffortMark({ tipo: 'trabajo' }), true);
  assert.equal(needsEffortMark({ tipo: 'trabajo', rpe: 8 }), false);
  assert.equal(needsEffortMark({ tipo: 'calentamiento' }), false);
  assert.equal(needsEffortMark({}), false); // serie vieja sin tipo
});
