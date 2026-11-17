/* Franja «Tu habitual» de Progreso: lo que el atleta hace normalmente y, con series de hoy, la
 * comparación. El aviso de bajada solo si bajó más de un 10 % (reglas en services/habitual.js).
 * En peso corporal manda la repetición; el peso es «peso corporal» o «peso corporal + lastre». */
import { esc } from '../../utils/dom.js';
import { fmtWeight } from '../../utils/units.js';
import { formatTime } from '../../services/timed.js';

/* En un ejercicio por tiempo, `reps` trae los segundos (asMeasured en services/timed.js). */
function setLine(set, unidad, corporal, timed = false) {
  if (timed) return formatTime(set.reps);
  return set.peso > 0 && !corporal
    ? `${fmtWeight(set.peso, unidad)} <span class="habitual-unit">${esc(unidad)}</span>`
    : `${set.reps} <span class="habitual-unit">reps</span>`;
}

function setSub(set, unidad, corporal, extra = '') {
  if (corporal) {
    const load = set.peso > 0 ? `peso corporal + ${fmtWeight(set.peso, unidad)} ${esc(unidad)}` : 'peso corporal';
    return `${load}${extra}`;
  }
  return set.peso > 0 ? `× ${set.reps}${extra}` : `sin peso${extra}`;
}

/* Sin series de hoy y con lo habitual igual al récord, la franja repetiría la tarjeta de récord. */
function sameAsRecord(habitual, record, corporal) {
  if (corporal) return habitual.peso === 0 && habitual.reps === record?.maxReps;
  return habitual.peso > 0 ? habitual.peso === record?.maxPeso : habitual.reps === record?.maxReps;
}

/** hab: de habitualForExercise(). record: { maxPeso, maxReps }. */
export function habitualStripHtml(hab, record, unidad, corporal = false, timed = false) {
  const { habitual, today, below, heavier } = hab || {};
  if (!habitual) return '';
  if (!today && sameAsRecord(habitual, record, corporal)) return '';
  if (!today) {
    const extraReps = habitual.peso > 0 && !corporal ? `<span class="habitual-reps">× ${habitual.reps}</span>` : '';
    const load = corporal ? `<span class="habitual-reps">· ${setSub(habitual, unidad, true)}</span>` : '';
    return `
      <section class="habitual-card" aria-label="Tu habitual">
        <span class="habitual-label habitual-label--accent">Tu habitual</span>
        <p class="habitual-val">${setLine(habitual, unidad, corporal, timed)} ${extraReps}${load}</p>
        <p class="habitual-note">${habitual.peso > 0 && !corporal ? 'Lo que levantas' : 'Lo que haces'} normalmente, según tus últimas ${habitual.sesiones} sesiones.</p>
      </section>`;
  }
  let note = '';
  if (below) note = '<p class="habitual-alert">Hoy vas por debajo de tu habitual. <span>Un día flojo no borra tu progreso.</span></p>';
  else if (heavier && corporal) note = `<p class="habitual-alert">Hoy cargas más que de costumbre. <span>${timed ? 'Menos tiempo' : 'Menos repeticiones'} con lastre no es bajar.</span></p>`;
  return `
    <section class="habitual-card" aria-label="Hoy frente a tu habitual">
      <div class="habitual-pair">
        <div class="habitual-col">
          <span class="habitual-label habitual-label--accent">Hoy</span>
          <p class="habitual-val">${setLine(today, unidad, corporal, timed)}</p>
          <span class="habitual-sub">${setSub(today, unidad, corporal)}</span>
        </div>
        <div class="habitual-col habitual-col--ref">
          <span class="habitual-label">Tu habitual</span>
          <p class="habitual-val">${setLine(habitual, unidad, corporal, timed)}</p>
          <span class="habitual-sub">${setSub(habitual, unidad, corporal, ` · últimas ${habitual.sesiones}`)}</span>
        </div>
      </div>
      ${note}
    </section>`;
}
