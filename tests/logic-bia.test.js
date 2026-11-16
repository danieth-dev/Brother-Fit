import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visibleFitText, isAthleteTurn } from '../js/services/bia/text.js';
import { reportMailtoUrl, REPORT_REASONS } from '../js/services/bia/reports.js';
import { APP_INFO } from '../js/app-info.js';

test('lo que Bía dice: sin comentarios internos', () => {
  assert.equal(visibleFitText('Listo.<!-- nota interna --> Siguiente serie.'), 'Listo. Siguiente serie.');
  assert.equal(visibleFitText('Hola <!-- a medias'), '');
  assert.equal(visibleFitText('  varios   espacios '), 'varios espacios');
});

test('qué cuenta como turno del atleta', () => {
  assert.equal(isAthleteTurn('10'), true);
  assert.equal(isAthleteTurn('sí'), true);
  assert.equal(isAthleteTurn('press banca'), true);
  assert.equal(isAthleteTurn('eh'), false);
  assert.equal(isAthleteTurn(''), false);
});

test('reporte: sin correo de soporte no se arma correo', () => {
  const prev = APP_INFO.supportEmail;
  APP_INFO.supportEmail = '';
  try {
    assert.equal(reportMailtoUrl({ ts: 0, reason: 'ofensiva', note: '', text: 'x' }), null);
  } finally {
    APP_INFO.supportEmail = prev;
  }
});

test('reporte: con correo, asunto y cuerpo llevan motivo y respuesta', () => {
  const prev = APP_INFO.supportEmail;
  APP_INFO.supportEmail = 'soporte@example.com';
  try {
    const url = reportMailtoUrl({ ts: 0, reason: 'peligrosa', note: '', text: 'Haz 50 series' });
    assert.ok(url.startsWith('mailto:soporte@example.com?subject='));
    const body = decodeURIComponent(url.split('&body=')[1]);
    assert.match(body, /^Motivo: Peligrosa para la salud\nFecha: /);
    assert.match(body, /Respuesta de Bía:\nHaz 50 series$/);
    assert.doesNotMatch(body, /Comentario/);
  } finally {
    APP_INFO.supportEmail = prev;
  }
  assert.equal(REPORT_REASONS.length, 4);
});
