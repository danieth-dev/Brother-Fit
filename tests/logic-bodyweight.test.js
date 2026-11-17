import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBodyweight, bodyFraction, bodyWeightOn, estimatedLoad, bodyweightSession, loadWords } from '../js/services/bodyweight.js';

test('los ejercicios de peso corporal: catálogo y propios marcados', () => {
  assert.equal(isBodyweight({ nombre: 'Dominadas' }), true);
  assert.equal(isBodyweight({ nombre: ' Flexiones ' }), true);
  assert.equal(isBodyweight({ nombre: 'Press banca' }), false);
  assert.equal(isBodyweight({ nombre: 'Muscle-up', corporal: true }), true);
  assert.equal(isBodyweight(null), false);
});

test('la carga solo se estima donde sube el cuerpo entero', () => {
  assert.equal(bodyFraction({ nombre: 'Dominadas' }), 1);
  assert.equal(bodyFraction({ nombre: 'Fondos' }), 1);
  assert.equal(bodyFraction({ nombre: 'Flexiones' }), null);
  assert.equal(estimatedLoad(70, 10, 1), 80);
  assert.equal(estimatedLoad(70, 0, 1), 70);
  assert.equal(estimatedLoad(null, 10, 1), null);
  assert.equal(estimatedLoad(70, 10, null), null);
});

test('el peso corporal de una fecha es el de ese día o el último anterior', () => {
  const body = [{ fecha: '2026-11-01', peso: 71 }, { fecha: '2026-11-10', peso: 70 }];
  assert.equal(bodyWeightOn('2026-11-05', body), 71);
  assert.equal(bodyWeightOn('2026-11-10', body), 70);
  assert.equal(bodyWeightOn('2026-12-01', body), 70);
  assert.equal(bodyWeightOn('2026-10-01', body), 71);
  assert.equal(bodyWeightOn('2026-11-05', []), null);
});

test('una sesión de peso corporal cuenta reps de trabajo y el lastre máximo', () => {
  const s = bodyweightSession([
    { peso: 0, reps: 5, tipo: 'calentamiento' },
    { peso: 0, reps: 10, tipo: 'trabajo' },
    { peso: 10, reps: 6, tipo: 'trabajo' },
    { peso: 0, reps: 8 },
  ]);
  assert.deepEqual(s, { repsMax: 10, repsTotal: 24, extra: 10, series: 3 });
  assert.equal(bodyweightSession([{ peso: 0, reps: 5, tipo: 'calentamiento' }]), null);
});

test('la carga en palabras dice peso corporal, no 0 kg', () => {
  assert.equal(loadWords(0, true), 'peso corporal');
  assert.equal(loadWords(10, true), 'peso corporal + 10 kg');
  assert.equal(loadWords(40, false), '40 kg');
});
