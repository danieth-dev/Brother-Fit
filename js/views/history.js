import { listWorkoutSummaries, getWorkoutDetail, deleteWorkout, muscleName } from '../services/workouts.js';
import { setEffort, setTipo } from '../services/effort.js';
import { delegate, esc, go, toast } from '../utils/dom.js';
import { formatLong, formatDuration } from '../utils/dates.js';
import { icons } from '../utils/icons.js';
import { effortTag, effortExtra } from '../utils/set-line.js';
import { askConfirm } from '../utils/confirm-sheet.js';
import { weightUnit, fmtWeight, fmtVolume } from '../utils/units.js';

let openEffortId = null;

export async function render(el, [id]) {
  return id ? detail(el, Number(id)) : list(el);
}

async function list(el) {
  const items = await listWorkoutSummaries();
  const unidad = weightUnit();
  el.innerHTML = `
    <header class="page-head"><h1>Historial</h1></header>
    ${items.length ? `
      <div class="list">
        ${items.map((w) => `
          <a class="row" href="#/history/${w.id}">
            <div>
              <strong style="text-transform:capitalize">${esc(formatLong(w.fecha))}</strong>
              <small>${w.totalSets} series · ${fmtVolume(w.volumen, unidad)} ${esc(unidad)}</small>
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
  const unidad = weightUnit();
  const { workout: w } = d;

  el.innerHTML = `
    <header class="page-head">
      <h1 style="text-transform:capitalize">${esc(formatLong(w.fecha))}</h1>
      <p style="text-transform:none">${w.duracion ? `Duración ${formatDuration(w.duracion)}` : 'En curso'}</p>
    </header>

    <div class="stats" style="margin-top:0">
      <div class="stat"><b>${d.totalSets}</b><span>series</span></div>
      <div class="stat"><b>${d.groups.length}</b><span>ejercicios</span></div>
      <div class="stat"><b>${fmtVolume(d.volumen, unidad)}</b><span>${esc(unidad)} volumen</span></div>
    </div>

    ${d.groups.length ? d.groups.map((g) => `
      <div class="group">
        <h3>
          <i class="dot" data-g="${esc(g.exercise.grupo)}"></i>
          ${esc(g.exercise.nombre)}
          ${muscleName(g.exercise.grupo) ? `<span class="muscle">${esc(muscleName(g.exercise.grupo))}</span>` : ''}
          <a href="#/progress/${g.exercise.id}" class="btn-link-sm" title="Ver progreso de ${esc(g.exercise.nombre)}">Ver progreso →</a>
        </h3>
        <ul class="sets">
          ${g.sets.map((s, i) => `
            <li>
              <span class="n">Serie ${i + 1}</span>
              <span class="v">${fmtWeight(s.peso, unidad)} ${esc(unidad)} × ${s.reps}${effortTag(s)}</span>
              ${effortExtra(s, openEffortId)}
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
      const ok = await askConfirm({
        title: 'Borrar entrenamiento',
        body: 'Se borran este entreno y todas sus series. No se puede deshacer.',
      });
      if (!ok) return;
      await deleteWorkout(id);
      go('/history');
    },
    'effort-open': async (t) => {
      const sid = Number(t.dataset.id);
      openEffortId = openEffortId === sid ? null : sid;
      await detail(el, id);
    },
    'effort-rir': async (t) => {
      const res = await setEffort(Number(t.dataset.id), Number(t.dataset.rir));
      if (!res?.ok) { toast('No se pudo anotar el esfuerzo.'); return; }
      openEffortId = null;
      await detail(el, id);
    },
    'set-tipo': async (t) => {
      await setTipo(Number(t.dataset.id), t.dataset.tipo);
      openEffortId = null;
      await detail(el, id);
    },
  });
}
