import { creatineSummary, toggleTodayIntake, DOSE_G } from '../services/creatine.js';
import { getActiveWorkout, startWorkout, listWorkoutSummaries, weekStats, muscleName, getWorkoutDetail } from '../services/workouts.js';
import { scheduleAfterCreatine, cancelWaterReminders } from '../services/water-reminders.js';
import { delegate, toast, esc, fmtNum, go } from '../utils/dom.js';
import { formatLong, formatMedium, todayISO, startOfWeekISO, addDays, formatDuration } from '../utils/dates.js';
import { icons } from '../utils/icons.js';
import { creatinePlate } from '../utils/components.js';
import { weightUnit, fmtVolume } from '../utils/units.js';
import { maybePromptBackup } from '../utils/backup-nudge.js';
import { askConfirm } from '../utils/confirm-sheet.js';
import { now } from '../utils/clock.js';

const WEEK_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const WEEK_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

function weekStrip(dias) {
  const start = startOfWeekISO();
  const today = todayISO();
  const trained = new Set(dias || []);
  const cells = [];
  for (let i = 0; i < 7; i++) {
    const iso = addDays(start, i);
    const n = Number(iso.slice(8));
    const did = trained.has(iso);
    const isToday = iso === today;
    const future = iso > today;
    const estado = did ? 'entrenaste' : future ? 'aún no llega' : 'sin entreno';
    const cls = ['week-day', did ? 'is-trained' : '', isToday ? 'is-today' : '', future && !did ? 'is-future' : ''].filter(Boolean).join(' ');
    cells.push(`<div class="${cls}" role="listitem" aria-label="${esc(WEEK_NAMES[i])} ${n}, ${estado}">
      <span class="week-day-name" aria-hidden="true">${WEEK_LETTERS[i]}</span>
      <span class="week-day-n" aria-hidden="true">${n}</span>
    </div>`);
  }
  return `<div class="week-strip" role="list" aria-label="Esta semana">${cells.join('')}</div>`;
}

function weekGroupLine(week) {
  const groups = (week.porGrupo || [])
    .filter((g) => muscleName(g.grupo))
    .map((g) => `${esc(muscleName(g.grupo))} ${g.n}`)
    .join(' · ');
  return groups ? `<p class="week-effort">${groups}</p>` : '';
}

function workoutTitle(w) {
  if (!w.grupos || !w.grupos.length) return 'Entrenamiento';
  const gs = w.grupos;
  if (gs.length === 1) return gs[0];
  if (gs.length === 2) return `${gs[0]} y ${gs[1]}`;
  if (gs.length === 3) return `${gs[0]}, ${gs[1]} y ${gs[2]}`;
  return `${gs[0]}, ${gs[1]} (+${gs.length - 2})`;
}

function startHomeTicker(el, active) {
  if (el._homeTickerId) clearInterval(el._homeTickerId);
  if (!active) return;
  const tick = () => {
    const elapsed = el.querySelector('#home-elapsed');
    if (!elapsed) {
      clearInterval(el._homeTickerId);
      el._homeTickerId = null;
      return;
    }
    elapsed.textContent = formatDuration(now() - active.startedAt);
  };
  tick();
  el._homeTickerId = setInterval(tick, 1000);
}

export async function render(el) {
  const [cr, active, recent, week] = await Promise.all([
    creatineSummary(), getActiveWorkout(), listWorkoutSummaries(3), weekStats()
  ]);
  const activeDetail = active ? await getWorkoutDetail(active.id) : null;
  const activeSetsCount = activeDetail?.totalSets || 0;
  const activeVol = activeDetail?.volumen || 0;
  const g = DOSE_G;
  const unidad = weightUnit();

  const estadoCreatina = cr.tomadaHoy
    ? `${cr.hoy.count} toma${cr.hoy.count > 1 ? 's' : ''} (${fmtNum(cr.hoy.gramos)} g)`
    : 'toca el disco para registrar';

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
      <div class="page-head-row">
        <h1>Brother Fit</h1>
        <a class="head-link" href="#/settings" aria-label="Ajustes">${icons.sliders({ size: 22 })}</a>
      </div>
    </header>

    <!-- ═══ CINTA SEMANAL: la fecha de hoy vive aquí (día resaltado) ═══ -->
    ${weekStrip(week.dias)}

    <!-- ═══ DISCO OLÍMPICO HERO: CREATINA DIARIA ═══ -->
    ${creatinePlate(cr, g, 'creatine', `
      <div class="home-creatine-status">
        <span class="home-creatine-dot ${cr.tomadaHoy ? 'is-taken' : ''}" aria-hidden="true"></span>
        <span class="home-creatine-state">${cr.tomadaHoy ? 'Tomada hoy' : 'Pendiente hoy'}</span>
        <span class="home-creatine-hint">· ${esc(estadoCreatina)}</span>
      </div>
      <div class="home-creatine-chips">
        <span class="home-chip">${esc(rachaStr)}</span>
        <span class="home-chip">${esc(satMsg)}</span>
        <span class="home-chip">${cr.dias7}/7 últimos 7 días</span>
      </div>
    `)}
    <p class="home-creatine-more">
      <a href="#/creatine">Ver creatina ${icons.chevronRight({ size: 16 })}</a>
    </p>

    <!-- ═══ TARJETA DE ENTRENAMIENTO DE HOY ═══ -->
    <div class="home-workout-card">
      <div class="home-workout-card-head">
        <span class="home-workout-card-date">Hoy · ${esc(formatMedium(todayISO()))}</span>
        ${active ? '<span class="home-workout-badge">En curso</span>' : ''}
      </div>
      <div class="home-workout-card-body">
        <h3 class="home-workout-card-title">${active ? esc(workoutTitle(activeDetail?.workout || active)) : 'Entrenamiento'}</h3>
        <p class="home-workout-card-sub">
          ${active
            ? `${activeSetsCount} ${activeSetsCount === 1 ? 'serie' : 'series'} · ${fmtVolume(activeVol, unidad)} ${esc(unidad)} · <span class="home-timer" id="home-elapsed">${formatDuration(now() - active.startedAt)}</span>`
            : 'Listo para levantar · Registra tus series y pesos'}
        </p>
      </div>
      ${active
        ? `<a class="btn btn-primary btn-block btn-lg" href="#/workout" id="btn-continue-workout">${icons.dumbbell({ size: 20 })} Continuar entrenamiento</a>`
        : `<button class="btn btn-primary btn-block btn-lg" data-action="start" type="button" id="btn-start-workout">${icons.plus({ size: 20 })} Iniciar entrenamiento</button>`}
    </div>

    <!-- ═══ TELEMETRÍA SEMANAL (DOS BLOQUES BALANCEADOS) ═══ -->
    <div class="stats stats--2">
      <div class="stat"><b>${fmtVolume(week.volumen, unidad)}</b><span>${esc(unidad)} de volumen</span></div>
      <div class="stat"><b>${cr.dias7}/7</b><span>días con creatina</span></div>
    </div>

    ${week.entrenos ? `
    <div class="stats stats--3">
      <div class="stat"><b>${week.efectivas}</b><span>series efectivas</span></div>
      <div class="stat"><b>${week.faciles}</b><span>fáciles</span></div>
      <div class="stat"><b>${week.sinEsfuerzo}</b><span>sin esfuerzo</span></div>
    </div>
    ${weekGroupLine(week)}` : ''}

    <!-- ═══ ÚLTIMOS ENTRENAMIENTOS ═══ -->
    <div class="home-recent-head">
      <h2 class="home-recent-title">Últimos entrenamientos</h2>
      <a href="#/history" class="home-recent-link">Ver historial</a>
    </div>

    ${recent.length ? `
      <div class="home-recent-list">
        ${recent.map((w) => `
          <a class="recent-workout-card" href="#/history/${w.id}">
            <div class="recent-workout-info">
              <strong class="recent-workout-title">${esc(workoutTitle(w))}</strong>
              <span class="recent-workout-sub">${esc(formatMedium(w.fecha))} · ${w.totalSets} ${w.totalSets === 1 ? 'serie' : 'series'} · ${fmtVolume(w.volumen, unidad)} ${esc(unidad)}</span>
            </div>
            <div class="recent-workout-right">
              ${w.finishedAt ? '' : '<span class="chip chip-warn">En curso</span>'}
              <span class="recent-workout-arrow" aria-hidden="true">${icons.chevronRight({ size: 20 })}</span>
            </div>
          </a>`).join('')}
      </div>`
      : `<div class="empty">
          ${icons.dumbbell({ size: 36, stroke: 'var(--line-strong)' })}
          <p>Todavía no registraste ningún entrenamiento.</p>
        </div>`}
  `;

  startHomeTicker(el, active);
  queueMicrotask(() => { maybePromptBackup().catch(() => {}); });

  delegate(el, {
    creatine: async (btn) => {
      if (cr.tomadaHoy) {
        const ok = await askConfirm({
          title: '¿Quitar la toma de hoy?',
          body: 'Vas a romper la racha y cancelar el aviso de agua.',
          confirmLabel: 'Sí, quitar hoy',
        });
        if (!ok) return;
      }
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
