import { listWorkoutSummaries, getWorkoutDetail, deleteWorkout } from '../services/workouts.js';
import { state } from '../store.js';
import { delegate, esc, fmtNum, go } from '../utils/dom.js';
import { formatLong, formatDuration } from '../utils/dates.js';
import { icons } from '../utils/icons.js';

export async function render(el, [id]) {
  return id ? detail(el, Number(id)) : list(el);
}

async function list(el) {
  const items = await listWorkoutSummaries();
  const unidad = state.settings.unidad;
  el.innerHTML = `
    <header class="page-head"><h1>Historial</h1></header>
    ${items.length ? `
      <div class="list">
        ${items.map((w) => `
          <a class="row" href="#/history/${w.id}">
            <div>
              <strong style="text-transform:capitalize">${esc(formatLong(w.fecha))}</strong>
              <small>${w.totalSets} series · ${fmtNum(Math.round(w.volumen))} ${esc(unidad)}</small>
            </div>
            ${w.finishedAt
              ? icons.chevronRight({ size: 18, cls: 'chev' })
              : '<span class="chip chip-warn">En curso</span>'}
          </a>`).join('')}
      </div>`
      : `<div class="empty">
          ${icons.dumbbell({ size: 40, stroke: 'var(--line-strong)' })}
          <p>Aquí aparecerán tus entrenamientos completados.</p>
          <a class="btn btn-primary" href="#/workout">${icons.plus({ size: 18 })} Iniciar entrenamiento</a>
        </div>`}
  `;
}

async function detail(el, id) {
  const d = await getWorkoutDetail(id);
  if (!d) {
    el.innerHTML = `
      <div class="empty">
        <p>No encontramos ese entrenamiento.</p>
        <a class="btn" href="#/history">${icons.chevronLeft({ size: 18 })} Volver al historial</a>
      </div>`;
    return;
  }
  const unidad = state.settings.unidad;
  const { workout: w } = d;

  el.innerHTML = `
    <header class="page-head">
      <h1 style="text-transform:capitalize">${esc(formatLong(w.fecha))}</h1>
      <p style="text-transform:none">${w.duracion ? `Duración ${formatDuration(w.duracion)}` : 'En curso'}</p>
    </header>

    <div class="stats" style="margin-top:0">
      <div class="stat"><b>${d.totalSets}</b><span>series</span></div>
      <div class="stat"><b>${d.groups.length}</b><span>ejercicios</span></div>
      <div class="stat"><b>${fmtNum(Math.round(d.volumen))}</b><span>${esc(unidad)} volumen</span></div>
    </div>

    ${d.groups.length ? d.groups.map((g) => `
      <div class="group">
        <h3>
          <i class="dot" data-g="${esc(g.exercise.grupo)}"></i>
          ${esc(g.exercise.nombre)}
          <a href="#/progress/${g.exercise.id}" class="btn-link-sm" title="Ver progreso de ${esc(g.exercise.nombre)}">Ver progreso →</a>
        </h3>
        <ul class="sets">
          ${g.sets.map((s, i) => `
            <li>
              <span class="n">Serie ${i + 1}</span>
              <span class="v">${fmtNum(s.peso)} ${esc(unidad)} × ${s.reps}${s.rpe ? `<span class="rpe-tag">RPE ${fmtNum(s.rpe)}</span>` : ''}</span>
            </li>`).join('')}
        </ul>
      </div>`).join('') : '<div class="empty"><p>Este entrenamiento no tiene series.</p></div>'}

    <div class="grid-2" style="margin-top:30px">
      <a class="btn btn-quiet" href="#/history">${icons.chevronLeft({ size: 18 })} Volver</a>
      <button class="btn btn-danger" data-action="delete" type="button">${icons.trash({ size: 16 })} Borrar</button>
    </div>
  `;

  delegate(el, {
    delete: async () => {
      if (!confirm('¿Borrar este entrenamiento y todas sus series?')) return;
      await deleteWorkout(id);
      go('/history');
    }
  });
}
