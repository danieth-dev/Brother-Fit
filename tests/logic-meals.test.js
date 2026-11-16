import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeMealItem, recalcItemGrams, summarizeItems, buildMealTitle,
  calculateTargetsForGoal, defaultMealTypeByHour, stepForGrams,
} from '../js/services/nutrition.js';

test('un alimento guarda su densidad por 100 g y recalcula sin perder precisión', () => {
  const it = normalizeMealItem({ nombre: 'Arroz', gramos: 200, kcal: 260, proteina: 5.4, carbos: 56.4, grasa: 0.6 });
  assert.equal(it.kcal100, 130);
  const mitad = recalcItemGrams(it, 100);
  assert.equal(mitad.kcal, 130);
  assert.equal(mitad.proteina, 2.7);
  assert.equal(recalcItemGrams(mitad, 200).kcal, 260);
});

test('totales de la comida', () => {
  const t = summarizeItems([{ kcal: 100, proteina: 10, carbos: 5, grasa: 2 }, { kcal: 50.4, proteina: 1.2, carbos: 0, grasa: 0 }]);
  assert.deepEqual(t, { kcal: 150, proteina: 11, carbos: 5, grasa: 2 });
});

test('título del plato con uno, dos o tres alimentos', () => {
  const item = (nombre) => ({ nombre, gramos: 100 });
  assert.equal(buildMealTitle([], 'Cena'), 'Cena');
  assert.equal(buildMealTitle([item('Arroz')]), 'Arroz');
  assert.equal(buildMealTitle([item('Arroz'), item('Pollo')]), 'Arroz y pollo');
  assert.equal(buildMealTitle([item('Arroz'), item('Pollo'), item('Ensalada')]), 'Arroz, pollo y ensalada');
});

test('sin peso registrado no se inventa una meta', () => {
  assert.equal(calculateTargetsForGoal('ganar', null), null);
  assert.equal(calculateTargetsForGoal('ganar', 0), null);
});

test('metas por objetivo según el peso', () => {
  const m = calculateTargetsForGoal('mantener', 70);
  assert.equal(m.kcal, 2520);
  assert.equal(m.proteina, 133);
  assert.equal(m.grasa, 84);
  assert.equal(m.carbos, Math.round((2520 - 133 * 4 - 84 * 9) / 4));
  assert.equal(calculateTargetsForGoal('definir', 70).kcal, 2100);
  assert.equal(calculateTargetsForGoal('ganar', 500).kcal, Math.round((180 * 43) / 10) * 10); // tope de 180 kg
});

test('tipo de comida por la hora', () => {
  const at = (h, m = 0) => new Date(2026, 0, 1, h, m);
  assert.equal(defaultMealTypeByHour(at(8)), 'Desayuno');
  assert.equal(defaultMealTypeByHour(at(11, 30)), 'Almuerzo');
  assert.equal(defaultMealTypeByHour(at(17)), 'Merienda');
  assert.equal(defaultMealTypeByHour(at(21)), 'Cena');
  assert.equal(defaultMealTypeByHour(at(3)), 'Cena');
});

test('pasos del − / + según el tamaño de la porción', () => {
  assert.equal(stepForGrams(20), 5);
  assert.equal(stepForGrams(80), 10);
  assert.equal(stepForGrams(200), 20);
});
