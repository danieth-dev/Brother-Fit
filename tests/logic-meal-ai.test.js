import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMealTextLocally } from '../js/services/food-catalog.js';
import { parseNutritionReply, pickGeminiModels, providerOrder, formatApiError } from '../js/services/meal-ai.js';
import { macroPercents } from '../js/services/nutrition.js';

test('lector local: unidades, gramos y un solo huevo', () => {
  const r = parseMealTextLocally('2 huevos fritos y 150 g de arroz');
  const names = r.items.map((i) => i.nombre);
  assert.ok(names.includes('Huevo frito / a la plancha'));
  assert.equal(names.filter((n) => n.includes('Huevo')).length, 1);
  assert.equal(r.items.find((i) => i.nombre.startsWith('Huevo')).gramos, 120);
  assert.equal(r.items.find((i) => i.nombre.startsWith('Arroz')).gramos, 150);
});

test('lector local: el huevo sancochado no se confunde con el frito', () => {
  const r = parseMealTextLocally('huevo sancochado');
  assert.deepEqual(r.items.map((i) => [i.nombre, i.gramos]), [['Huevo entero cocido', 60]]);
});

test('lector local: si no reconoce nada, no inventa', () => {
  assert.deepEqual(parseMealTextLocally('una cosa rara'), { plato: 'una cosa rara', items: [] });
});

test('respuesta de la IA: JSON con o sin bloque de código', () => {
  const reply = '```json\n{"esComida":true,"plato":"Arepa","items":[{"nombre":"Arepa","gramos":130,"kcal":254,"proteina":5.9,"carbos":53.3,"grasa":1.6}]}\n```';
  const r = parseNutritionReply(reply);
  assert.equal(r.plato, 'Arepa');
  assert.equal(r.items[0].gramos, 130);
  assert.equal(Math.round(r.items[0].kcal100), 195);
});

test('respuesta de la IA: «no es comida» y respuestas inútiles', () => {
  assert.throws(() => parseNutritionReply('{"esComida":false,"motivo":"Es una mancuerna.","items":[]}'),
    (e) => e.code === 'NOT_FOOD' && e.message === 'Es una mancuerna.');
  assert.throws(() => parseNutritionReply('hola'), /JSON válido/);
  assert.throws(() => parseNutritionReply('{"plato":"x"}'), /ingredientes válidos/);
});

test('modelos de Gemini: solo los que leen fotos, rápidos primero', () => {
  const models = [
    { name: 'models/gemini-2.0-flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-2.5-flash-preview-tts', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
  ];
  assert.deepEqual(pickGeminiModels(models), ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-pro']);
  assert.ok(pickGeminiModels([]).length > 0, 'sin lista usa la de respaldo');
});

test('proveedor elegido primero y el otro de respaldo', () => {
  const both = { geminiKey: 'g', openaiKey: 'o' };
  assert.deepEqual(providerOrder({ ...both, provider: 'openai' }).map((p) => p.key), ['o', 'g']);
  assert.deepEqual(providerOrder({ ...both, provider: 'gemini' }).map((p) => p.key), ['g', 'o']);
  assert.deepEqual(providerOrder({ provider: 'openai', geminiKey: ' g ' }).map((p) => p.key), ['g']);
  assert.equal(providerOrder({ provider: 'gemini' }).length, 0);
});

test('errores de la IA en palabras del atleta', () => {
  assert.match(formatApiError('Gemini', 400, '{"error":{"message":"API key not valid"}}'), /no es válida/);
  assert.match(formatApiError('OpenAI', 429, ''), /límite/);
});

test('porcentaje de metas con tope en 100', () => {
  const pct = macroPercents({ kcal: 3000, proteina: 75, carbos: 0, grasa: 10 }, { kcal: 2000, proteina: 150, carbos: 0, grasa: 40 });
  assert.deepEqual(pct, { kcal: 100, proteina: 50, carbos: 0, grasa: 25 });
});
