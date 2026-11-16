import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BACKUP_APP, buildPayload, parseBackup, mergeImport, shouldNudgeBackup,
} from '../js/services/backup.js';

const DAY = 24 * 60 * 60 * 1000;
const secret = (key, value = 'k') => ({ key, value });

test('el archivo no lleva las claves de IA y conserva el resto', () => {
  const dump = {
    workouts: [{ id: 1 }],
    meta: [secret('geminiApiKey'), secret('openaiApiKey'), { key: 'perfil', value: 'x' }],
  };
  const payload = buildPayload(dump, '2026-11-16T00:00:00.000Z');
  assert.equal(payload.app, BACKUP_APP);
  assert.equal(payload.schema, 1);
  assert.equal(payload.exportedAt, '2026-11-16T00:00:00.000Z');
  assert.deepEqual(payload.data.workouts, [{ id: 1 }]);
  assert.deepEqual(payload.data.meta, [{ key: 'perfil', value: 'x' }]);
  assert.equal(dump.meta.length, 3, 'no cambia el volcado original');
});

test('un volcado sin meta se exporta igual', () => {
  assert.deepEqual(buildPayload({ sets: [] }).data.meta, []);
});

test('ida y vuelta: lo exportado se lee igual', () => {
  const dump = { sets: [{ id: 3, peso: 80.5, reps: 6 }], meta: [{ key: 'unidad', value: 'kg' }] };
  const data = parseBackup(JSON.stringify(buildPayload(dump)));
  assert.deepEqual(data, dump);
});

test('rechaza archivos que no son respaldo', () => {
  assert.throws(() => parseBackup('no es json'), /JSON válido/);
  assert.throws(() => parseBackup('null'), /no es un respaldo/);
  assert.throws(() => parseBackup(JSON.stringify({ app: 'otra', data: {} })), /no es un respaldo/);
  assert.throws(() => parseBackup(JSON.stringify({ app: BACKUP_APP })), /no es un respaldo/);
  assert.throws(() => parseBackup(JSON.stringify({ app: BACKUP_APP, data: [] })), /no es un respaldo/);
});

test('al importar, las claves del teléfono ganan a las del archivo', () => {
  const fromFile = { meta: [secret('geminiApiKey', 'vieja'), { key: 'perfil', value: 'p' }], sets: [] };
  const merged = mergeImport(fromFile, [secret('geminiApiKey', 'del-telefono'), undefined]);
  assert.deepEqual(merged.meta, [{ key: 'perfil', value: 'p' }, secret('geminiApiKey', 'del-telefono')]);
  assert.deepEqual(merged.sets, []);
});

test('un archivo viejo con claves no las trae si el teléfono no tenía', () => {
  const merged = mergeImport({ meta: [secret('openaiApiKey')] }, []);
  assert.deepEqual(merged.meta, []);
});

test('meta que no es lista se trata como vacía', () => {
  assert.deepEqual(mergeImport({ meta: 'raro' }, []).meta, []);
});

const base = { nudgedDay: null, today: '2026-11-16', lastBackupAt: null, finishedAts: [1], nowMs: 100 * DAY };

test('aviso de respaldo: sin entrenos terminados no avisa', () => {
  assert.equal(shouldNudgeBackup({ ...base, finishedAts: [] }), false);
});

test('aviso de respaldo: nunca respaldó', () => {
  assert.equal(shouldNudgeBackup(base), true);
});

test('aviso de respaldo: una vez al día', () => {
  assert.equal(shouldNudgeBackup({ ...base, nudgedDay: '2026-11-16' }), false);
});

test('aviso de respaldo: a los 7 días', () => {
  const recent = { ...base, finishedAts: [1], lastBackupAt: base.nowMs - 6 * DAY };
  assert.equal(shouldNudgeBackup(recent), false);
  assert.equal(shouldNudgeBackup({ ...recent, lastBackupAt: base.nowMs - 7 * DAY }), true);
});

test('aviso de respaldo: a los 5 entrenos desde el último', () => {
  const last = base.nowMs - DAY;
  const after = (n) => Array.from({ length: n }, (_, i) => last + i + 1);
  assert.equal(shouldNudgeBackup({ ...base, lastBackupAt: last, finishedAts: [1, 2, ...after(4)] }), false);
  assert.equal(shouldNudgeBackup({ ...base, lastBackupAt: last, finishedAts: after(5) }), true);
});
