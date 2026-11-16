import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fold, matchScore, matchRange } from '../js/utils/text-match.js';
import { inferMuscleGroup, FILTRO_HOY } from '../js/services/muscle-groups.js';

test('buscar sin tildes ni mayúsculas', () => {
  assert.equal(fold('Jalón al Pecho'), 'jalon al pecho');
  assert.equal(fold(null), '');
});

test('orden de coincidencia: empieza, palabra, en medio', () => {
  assert.equal(matchScore('press banca', 'press'), 0);
  assert.equal(matchScore('press banca', 'banca'), 1);
  assert.equal(matchScore('press banca', 'anca'), 2);
});

test('el resaltado cae sobre el nombre con tildes', () => {
  const name = 'Jalón al pecho';
  const [start, end] = matchRange(name, 'lon');
  assert.equal([...name].slice(start, end).join(''), 'lón');
  assert.equal(matchRange(name, 'xyz'), null);
  assert.equal(matchRange(name, ''), null);
});

test('grupo por nombre, con los casos compuestos primero', () => {
  assert.equal(inferMuscleGroup('Sentadilla búlgara'), 'Piernas');
  assert.equal(inferMuscleGroup('Elevación de piernas colgado'), 'Core');
  assert.equal(inferMuscleGroup('Peso muerto rumano'), 'Piernas');
  assert.equal(inferMuscleGroup('Peso muerto'), 'Espalda');
  assert.equal(inferMuscleGroup('Fondos de tríceps'), 'Tríceps');
  assert.equal(inferMuscleGroup('Curl martillo'), 'Bíceps');
});

test('el filtro de grupo puesto gana; el de hoy no cuenta', () => {
  assert.equal(inferMuscleGroup('Curl', 'Pecho'), 'Pecho');
  assert.equal(inferMuscleGroup('Curl', FILTRO_HOY), 'Bíceps');
});

test('sin pistas en el nombre, el grupo que predomina entre los parecidos', () => {
  assert.equal(inferMuscleGroup('Máquina X', '', ['Hombros', 'Pecho', 'Hombros']), 'Hombros');
  assert.equal(inferMuscleGroup('Máquina X'), 'Otro');
  assert.equal(inferMuscleGroup(''), 'Otro');
});
