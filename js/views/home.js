import { creatineSummary, toggleTodayIntake, DOSE_G } from '../services/creatine.js';
import { getActiveWorkout, startWorkout, listWorkoutSummaries, weekStats, muscleName } from '../services/workouts.js';
import { scheduleAfterCreatine, cancelWaterReminders } from '../services/water-reminders.js';
import { delegate, toast, esc, fmtNum, go } from '../utils/dom.js';
import { formatLong, todayISO } from '../utils/dates.js';
import { icons } from '../utils/icons.js';
import { creatinePlate } from '../utils/components.js';
import { weightUnit, fmtVolume } from '../utils/units.js';

function weekGroupLine(week) {
  const groups = (week.porGrupo || [])
    .filter((g) => muscleName(g.grupo))
    .map((g) => `${esc(muscleName(g.grupo))} ${g.n}`)
    .join(' · ');
  return groups ? `<p class="week-effort">${groups}</p>` : '';
}

export async function render(el) {
  const [cr, active, recent, week] = await Promise.all([
    creatineSummary(), getActiveWorkout(), listWorkoutSummaries(3), weekStats()
  ]);
  const g = DOSE_G;
  const unidad = weightUnit();

  const estadoCreatina = cr.tomadaHoy
    ? `${cr.hoy.count} toma${cr.hoy.count > 1 ? 's' : ''} · ${fmtNum(cr.hoy.gramos)} g registrados`
    : 'Toca el disco para registrar la toma de hoy';

  const rachaStr = cr.racha === 0
    ? 'Sin racha activa'
    : cr.racha === 1
    ? '1 día de racha'
    : `${cr.racha} días de racha`;

  const satMsg = cr.saturacion.fase === 'mantenimiento'
    ? 'Saturación completa'
    : cr.saturacion.porcentajeSaturacion === 0
    ? 'Inicia el protocolo'
    : `${cr.saturacion.porcentajeSaturacion}% saturado`;

  el.innerHTML = `
    <header class="page-head">
      <h1>Brother Fit</h1>
      <p>${esc(formatLong(todayISO()))}</p>
    </header>

    <!-- ═══ DISCO OLÍMPICO HERO: CREATINA DIARIA ═══ -->
    ${creatinePlate(cr, g, 'creatine', `
      <p>${esc(estadoCreatina)}</p>
      <p class="home-creatine-meta">
        <span>${icons.flame({ size: 14, stroke: 'var(--primary)' })} ${esc(rachaStr)}</span>
        <span class="home-creatine-sat">${icons.bolt({ size: 14, stroke: 'var(--primary)' })} ${esc(satMsg)}</span>
      </p>
    `)}

    <!-- ═══ DIVISOR TÉCNICO (SEPARA SUPLEMENTO DE SESIÓN) ═══ -->
    <div class="home-divider" role="separator">
      <span>Entrenamiento</span>
    </div>

    <!-- ═══ BOTÓN DE ACCIÓN DE ENTRENAMIENTO ═══ -->
    <div>
      ${active
        ? `<a class="btn btn-primary btn-block" href="#/workout" id="btn-continue-workout">${icons.dumbbell({ size: 20 })} Continuar entrenamiento →</a>`
        : `<button class="btn btn-primary btn-block" data-action="start" type="button" id="btn-start-workout">${icons.plus({ size: 20 })} Iniciar entrenamiento</button>`}
    </div>

    <!-- ═══ TELEMETRÍA SEMANAL ═══ -->
    <div class="stats">
      <div class="stat"><b>${week.entrenos}</b><span>entrenos<br>esta semana</span></div>
      <div class="stat"><b>${fmtVolume(week.volumen, unidad)}</b><span>${esc(unidad)} de<br>volumen</span></div>
      <div class="stat"><b>${cr.dias7}/7</b><span>días con<br>creatina</span></div>
    </div>
    ${week.entrenos ? `
    <div class="stats">
      <div class="stat"><b>${week.efectivas}</b><span>series<br>efectivas</span></div>
      <div class="stat"><b>${week.faciles}</b><span>fáciles</span></div>
      <div class="stat"><b>${week.sinEsfuerzo}</b><span>sin<br>esfuerzo</span></div>
    </div>
    ${weekGroupLine(week)}` : ''}

    <h2 class="section-title">
      <span>Últimos entrenamientos</span>
      <a href="#/history" class="muted" style="font-size:var(--fs-xs)">Ver historial</a>
    </h2>

    ${recent.length ? `
      <div class="list">
        ${recent.map((w) => `
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
          ${icons.dumbbell({ size: 36, stroke: 'var(--line-strong)' })}
          <p>Todavía no registraste ningún entrenamiento.</p>
        </div>`}
  `;

  delegate(el, {
    creatine: async (btn) => {
      el.style.pointerEvents = 'none';
      btn.disabled = true;

      try {
        const res = await toggleTodayIntake(g);
        if (res.taken) {
          const water = await scheduleAfterCreatine(todayISO());
          await render(el);
          toast('Creatina registrada');
          if (water.reason === 'denied') {
            setTimeout(() => toast('Activa las notificaciones si quieres el recordatorio de agua.'), 4200);
          }
        } else {
          await render(el);
          toast('Toma de hoy quitada');
          cancelWaterReminders().catch(() => {});
        }
      } finally {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => { el.style.pointerEvents = ''; });
        });
      }
    },
    start: async (btn) => {
      btn.disabled = true;
      await startWorkout();
      go('/workout');
    }
  });
}
