import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysMap, streak, countLastDays, saturationProgress } from '../js/services/creatine.js';
import { addDays } from '../js/utils/dates.js';

const HOY = '2026-11-15';
const dias = (n, desde = HOY) => Array.from({ length: n }, (_, i) => ({ fecha: addDays(desde, -i), cantidad: 5 }));

test('daysMap agrupa por día', () => {
  const m = daysMap([{ fecha: HOY, cantidad: 5 }, { fecha: HOY, cantidad: 3 }]);
  assert.deepEqual(m.get(HOY), { count: 2, gramos: 8 });
});

test('la racha no se rompe hoy si todavía no se tomó', () => {
  assert.equal(streak(daysMap(dias(3)), HOY), 3);
  assert.equal(streak(daysMap(dias(3, addDays(HOY, -1))), HOY), 3);
  assert.equal(streak(daysMap(dias(3, addDays(HOY, -2))), HOY), 0);
});

test('cuenta días con toma en una ventana', () => {
  assert.equal(countLastDays(daysMap(dias(10)), 7, HOY), 7);
  assert.equal(countLastDays(daysMap(dias(3)), 30, HOY), 3);
});

test('saturación: 28 días con toma es mantenimiento', () => {
  const vacio = saturationProgress(new Map(), HOY);
  assert.equal(vacio.porcentajeSaturacion, 0);
  assert.equal(vacio.fase, 'inicio');
  const lleno = saturationProgress(daysMap(dias(40)), HOY);
  assert.equal(lleno.porcentajeSaturacion, 100);
  assert.equal(lleno.fase, 'mantenimiento');
  const medio = saturationProgress(daysMap(dias(10)), HOY);
  assert.equal(medio.diasEfectivos, 10);
  assert.equal(medio.fase, 'cargando');
});

test('un día saltado no vacía el depósito', () => {
  const tomas = dias(28).filter((t) => t.fecha !== addDays(HOY, -5));
  const r = saturationProgress(daysMap(tomas), HOY);
  assert.equal(r.diasEfectivos, 27);
  assert.equal(r.fase, 'saturando');
});
