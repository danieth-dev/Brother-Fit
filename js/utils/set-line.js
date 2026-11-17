import { esc, fmtNum } from './dom.js';
import { effortPhrase, needsEffortMark } from '../services/effort.js';
import { HOLD_LABELS, holdPhrase, isTimedSet } from '../services/timed.js';

const RIR = [[0, '0'], [1, '1'], [2, '2'], [3, '3'], [4, '4+']];

export function effortTag(set) {
  if (set?.tipo === 'calentamiento') return '<span class="rpe-tag">calentamiento</span>';
  if (set?.rpe == null || set.rpe === '') return '';
  return `<span class="rpe-tag">${esc(isTimedSet(set) ? holdPhrase(set.rpe) : effortPhrase(set.rpe))}</span>`;
}

/* timed: los mismos 5 botones, leídos en segundos (0 · 5 s · 10 s · 15 s · 20 s+). */
export function rirButtons(setId, { action = 'effort-rir', pressed = null, disabled = false, timed = false } = {}) {
  const aria = timed ? 'Cuánto más podrías haber aguantado' : 'Cuántas repeticiones más podrías haber hecho';
  return `<div class="rir-pick" role="group" aria-label="${aria}">${RIR.map(([n, label]) =>
    `<button type="button" data-action="${action}" data-id="${setId || ''}" data-rir="${n}" aria-pressed="${!disabled && pressed === n}" ${disabled ? 'disabled' : ''}>${timed ? HOLD_LABELS[n] : label}</button>`
  ).join('')}</div>`;
}

export function effortExtra(set, openId) {
  if (set?.tipo !== 'trabajo' && set?.tipo !== 'calentamiento') return '';
  const missing = needsEffortMark(set);
  const ask = missing
    ? `<button type="button" class="btn effort-miss" data-action="effort-open" data-id="${set.id}">Falta esfuerzo</button>`
    : (set.tipo === 'trabajo'
      ? `<button type="button" class="btn btn-quiet effort-change" data-action="effort-open" data-id="${set.id}">Cambiar esfuerzo</button>`
      : '');
  const open = openId === set.id && set.tipo === 'trabajo' ? rirButtons(set.id, { timed: isTimedSet(set) }) : '';
  const tipo = `<div class="seg set-tipo" role="group" aria-label="Tipo de la serie">
      <button type="button" data-action="set-tipo" data-id="${set.id}" data-tipo="trabajo" aria-pressed="${set.tipo === 'trabajo'}">Trabajo</button>
      <button type="button" data-action="set-tipo" data-id="${set.id}" data-tipo="calentamiento" aria-pressed="${set.tipo === 'calentamiento'}">Calentamiento</button>
    </div>`;
  return `<div class="set-extra">${ask}${open}${tipo}</div>`;
}
