import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, startOfWeekISO, parseISO, toISO } from '../js/utils/dates.js';
import { toKg, fromKg, LB_PER_KG } from '../js/utils/units.js';

test('addDays cruza meses y años en fecha local', () => {
  assert.equal(addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29'); // bisiesto
});

test('startOfWeekISO devuelve el lunes', () => {
  assert.equal(startOfWeekISO('2026-11-15'), '2026-11-09'); // domingo → lunes anterior
  assert.equal(startOfWeekISO('2026-11-09'), '2026-11-09'); // lunes → mismo día
});

test('toISO y parseISO son inversos', () => {
  assert.equal(toISO(parseISO('2026-03-07')), '2026-03-07');
});

test('kg y lb: lo guardado siempre es kg', () => {
  assert.equal(toKg(100, 'kg'), 100);
  assert.ok(Math.abs(toKg(220.46226218, 'lb') - 100) < 1e-9);
  assert.ok(Math.abs(fromKg(1, 'lb') - LB_PER_KG) < 1e-12);
  assert.ok(Number.isNaN(toKg('abc', 'kg')));
});
