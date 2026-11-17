import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bestWorkingSet, habitualFrom, isBelowHabitual, carriesMore, HABITUAL_SESSIONS, MIN_SESSIONS } from '../js/services/habitual.js';

test('la mejor serie de trabajo ignora calentamientos y desempata por reps', () => {
  assert.deepEqual(bestWorkingSet([
    { peso: 40, reps: 5, tipo: 'calentamiento' },
    { peso: 35, reps: 7, tipo: 'trabajo' },
    { peso: 35, reps: 8 },
    { peso: 30, reps: 12, tipo: 'trabajo' },
  ]), { peso: 35, reps: 8 });
  assert.equal(bestWorkingSet([{ peso: 20, reps: 10, tipo: 'calentamiento' }]), null);
  assert.equal(bestWorkingSet([]), null);
});

test('lo habitual es la mediana de las últimas sesiones y un día malo no lo mueve', () => {
  const tops = [
    { peso: 32.5, reps: 8 },
    { peso: 35, reps: 8 },
    { peso: 37.5, reps: 6 },
    { peso: 35, reps: 8 },
    { peso: 25, reps: 10 },
  ];
  const h = habitualFrom(tops);
  assert.equal(h.sesiones, HABITUAL_SESSIONS);
  assert.equal(h.peso, 35);
  assert.equal(h.reps, 8);
  assert.equal(habitualFrom([]), null);
});

test('con menos de 3 sesiones todavía no hay habitual', () => {
  assert.equal(MIN_SESSIONS, 3);
  assert.equal(habitualFrom([{ peso: 15, reps: 8 }, { peso: 15, reps: 8 }]), null);
  assert.deepEqual(habitualFrom([{ peso: 15, reps: 8 }, { peso: 15, reps: 8 }, { peso: 17.5, reps: 6 }]), { peso: 15, reps: 8, sesiones: 3 });
});

test('el aviso solo sale al bajar más de un 10 %', () => {
  const h = { peso: 35, reps: 8 };
  assert.equal(isBelowHabitual({ peso: 30, reps: 8 }, h), true);
  assert.equal(isBelowHabitual({ peso: 32.5, reps: 8 }, h), false);
  assert.equal(isBelowHabitual({ peso: 35, reps: 8 }, h), false);
  assert.equal(isBelowHabitual(null, h), false);
  assert.equal(isBelowHabitual({ peso: 30, reps: 8 }, null), false);
});

test('sin peso se comparan las repeticiones', () => {
  const h = { peso: 0, reps: 10 };
  assert.equal(isBelowHabitual({ peso: 0, reps: 8 }, h), true);
  assert.equal(isBelowHabitual({ peso: 0, reps: 9 }, h), false);
});

test('con más lastre, menos repeticiones no es bajar', () => {
  const h = { peso: 0, reps: 10 };
  assert.equal(carriesMore({ peso: 10, reps: 8 }, h), true);
  assert.equal(isBelowHabitual({ peso: 10, reps: 6 }, h), false);
  assert.equal(isBelowHabitual({ peso: 0, reps: 6 }, h), true);
  assert.equal(carriesMore({ peso: 0, reps: 12 }, h), false);
});
