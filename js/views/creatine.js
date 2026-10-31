import { creatineSummary, logIntake, deleteIntake, toggleTodayIntake, intakesForDate, DOSE_G } from '../services/creatine.js';
import { scheduleAfterCreatine, cancelWaterReminders } from '../services/water-reminders.js';
import { delegate, forms, toast, esc, num, fmtNum } from '../utils/dom.js';
import { formatMonth, formatLong, todayISO, toISO } from '../utils/dates.js';
import { icons } from '../utils/icons.js';
import { creatinePlate } from '../utils/components.js';
import { askConfirm } from '../utils/confirm-sheet.js';

const now = new Date();
let view = { y: now.getFullYear(), m: now.getMonth() };

function monthCells(y, m, map) {
  const lead = (new Date(y, m, 1).getDay() + 6) % 7; // lunes primero
  const days = new Date(y, m + 1, 0).getDate();
  const today = todayISO();
  const cells = Array.from({ length: lead }, () => '<span class="day out"></span>');
  for (let d = 1; d <= days; d++) {
    const iso = toISO(new Date(y, m, d));
    const cls = ['day', map.has(iso) && 'taken', iso === today && 'today', iso > today && 'future'].filter(Boolean).join(' ');
    cells.push(`<span class="${cls}" title="${map.has(iso) ? `${map.get(iso).count} toma(s)` : ''}">${d}</span>`);
  }
  return cells.join('');
}

const FASE_ICONS = {
  inicio:        icons.flask({ size: 22 }),
  cargando:      icons.bolt({ size: 22 }),
  saturando:     icons.flame({ size: 22 }),
  mantenimiento: icons.muscle({ size: 22 }),
};

const FASE_LABELS = {
  inicio:        'Iniciando protocolo',
  cargando:      'Cargando creatina',
  saturando:     'Saturando músculo',
  mantenimiento: 'Mantenimiento activo',
};

const FASE_DESC = {
  inicio: 'Primeros días: la creatina comienza a acumularse en el músculo. La toma constante es clave.',
  cargando: 'Los músculos están incorporando la creatina. Los depósitos están al 25–50%.',
  saturando: 'Depósitos sobre el 50%. En las próximas semanas notarás mayor rendimiento en series pesadas.',
  mantenimiento: 'Saturación completa. Los depósitos musculares están llenos. Mantén la dosis diaria.',
};

function saturationCard(pct, fase) {
  const desc = FASE_DESC[fase] || 'Mantén la toma diaria para sostener los depósitos llenos.';
  return `
    <div class="creatine-sat-card">
      <div class="creatine-sat-head">
        <span class="creatine-sat-label">Saturación muscular</span>
        <span class="creatine-sat-pct">${pct}%</span>
      </div>
      <div class="creatine-sat-bar">
        <div class="creatine-sat-fill" style="width:${pct}%" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"></div>
      </div>
      <p class="creatine-sat-desc">${desc}</p>
    </div>
  `;
}

function statsRow(cr) {
  const rachaNum = cr.racha || 0;
  return `
    <div class="creatine-stats-grid">
      <div class="creatine-stat-card">
        <p class="creatine-stat-val">${rachaNum}</p>
        <p class="creatine-stat-lbl">${rachaNum === 1 ? 'día de racha' : 'días de racha'}</p>
      </div>
      <div class="creatine-stat-card">
        <p class="creatine-stat-val">${cr.dias7}/7</p>
        <p class="creatine-stat-lbl">últimos 7 días</p>
      </div>
      <div class="creatine-stat-card">
        <p class="creatine-stat-val">${cr.dias30}/30</p>
        <p class="creatine-stat-lbl">últimos 30 días</p>
      </div>
    </div>
  `;
}

const INTAKE_PREVIEW = 5;

function intakeCard(i) {
  return `
    <div class="intake-card">
      <div class="intake-card-info">
        <strong class="intake-card-date">${esc(formatLong(i.fecha))}</strong>
        <span class="intake-card-dose">${fmtNum(i.cantidad)} g</span>
      </div>
      <button class="btn-x intake-card-del" data-action="del" data-id="${i.id}" type="button" aria-label="Borrar toma del ${esc(formatLong(i.fecha))}">
        ${icons.trash({ size: 18 })}
      </button>
    </div>`;
}

export async function render(el) {
  const cr = await creatineSummary();
  const g = DOSE_G;
  const isCurrent = view.y === now.getFullYear() && view.m === now.getMonth();

  el.innerHTML = `
    <header class="page-head">
      <div class="page-head-row">
        <div style="display:flex;align-items:center">
          <a class="head-back" href="#/" aria-label="Volver a Inicio">${icons.chevronLeft({ size: 22 })}</a>
          <h1>Creatina</h1>
        </div>
      </div>
    </header>

    ${creatinePlate(cr, g, 'log', `
      <div class="home-creatine-status">
        <span class="home-creatine-dot ${cr.tomadaHoy ? 'is-taken' : ''}" aria-hidden="true"></span>
        <span class="home-creatine-state">${cr.tomadaHoy ? 'Tomada hoy' : 'Pendiente hoy'}</span>
        <span class="home-creatine-hint">· ${cr.tomadaHoy ? `${cr.hoy.count} toma${cr.hoy.count > 1 ? 's' : ''} (${fmtNum(cr.hoy.gramos)} g)` : 'aún no registras la toma'}</span>
      </div>
    `, { brand: null, showGrams: false, showSat: false })}

    <!-- ═══ SATURACIÓN MUSCULAR VISIBLE ═══ -->
    ${saturationCard(cr.saturacion.porcentajeSaturacion, cr.saturacion.fase)}

    <!-- ═══ MÉTRICAS DIRECTAS (RACHA, 7 DÍAS, 30 DÍAS) ═══ -->
    ${statsRow(cr)}

    <!-- ═══ CALENDARIO MENSUAL ═══ -->
    <div class="cal-block" style="margin-top:16px">
      <div class="cal-head">
        <button class="btn-x" data-action="prev" type="button" aria-label="Mes anterior">${icons.chevronLeft({ size: 20 })}</button>
        <h2>${esc(formatMonth(view.y, view.m))}</h2>
        <button class="btn-x" data-action="next" type="button" aria-label="Mes siguiente" ${isCurrent ? 'disabled' : ''}>${icons.chevronRight({ size: 20 })}</button>
      </div>
      <div class="cal">
        ${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d) => `<span class="dow">${d}</span>`).join('')}
        ${monthCells(view.y, view.m, cr.map)}
      </div>
    </div>

    <!-- ═══ AÑADIR TOMA PASADA (ESTILO AMIGABLE) ═══ -->
    <details class="creatine-retro-card">
      <summary class="creatine-retro-btn">
        <span>¿Olvidaste una toma? Añadir toma pasada</span>
        <span class="creatine-retro-plus" aria-hidden="true">${icons.plus({ size: 20 })}</span>
      </summary>
      <form class="stack creatine-retro-form" data-form="manual">
        <div class="grid-2">
          <label class="field"><span>Día</span><input type="date" name="fecha" value="${todayISO()}" max="${todayISO()}" required></label>
          <label class="field"><span>Gramos</span><input name="cantidad" inputmode="decimal" value="${fmtNum(g)}" required></label>
        </div>
        <button class="btn btn-primary btn-block" type="submit">Guardar toma pasada</button>
      </form>
    </details>

    <!-- ═══ ÚLTIMAS TOMAS (TARJETAS INDIVIDUALES) ═══ -->
    <div class="intake-section-head">
      <h2 class="intake-section-title">Últimas tomas</h2>
      ${cr.intakes.length ? `<span class="intake-section-total">${cr.intakes.length} en total</span>` : ''}
    </div>
    ${cr.intakes.length ? `
      <div class="intake-cards-list">
        ${cr.intakes.slice(0, INTAKE_PREVIEW).map(intakeCard).join('')}
      </div>
      ${cr.intakes.length > INTAKE_PREVIEW ? `
        <details class="intake-more-wrap">
          <summary class="intake-more-btn">Ver todas (${cr.intakes.length})</summary>
          <div class="intake-cards-list" style="margin-top: 8px;">
            ${cr.intakes.slice(INTAKE_PREVIEW).map(intakeCard).join('')}
          </div>
        </details>` : ''}`
      : `<div class="empty">
          ${icons.flask({ size: 36, stroke: 'var(--line-strong)' })}
          <p>Aún no hay tomas registradas.</p>
        </div>`}

    <!-- ═══ GUÍA CIENTÍFICA ═══ -->
    <details class="sci-facts-card">
      <summary class="sci-facts-trigger">
        <span>¿Cómo funciona la creatina?</span>
        <span class="sci-facts-chev" aria-hidden="true">${icons.chevronDown({ size: 20 })}</span>
      </summary>
      <div class="sci-facts-body">
        <div class="sci-fact-item">
          <span class="sci-fact-icon">${icons.clock({ size: 16 })}</span>
          <div><strong>28 días para saturar</strong><br>Sin fase de carga, los músculos tardan ~4 semanas con 3–5 g/día en alcanzar saturación completa.</div>
        </div>
        <div class="sci-fact-item">
          <span class="sci-fact-icon">${icons.bolt({ size: 16 })}</span>
          <div><strong>Fase de carga (opcional)</strong><br>20 g/día durante 5–7 días (4 tomas de 5 g) acelera la saturación si deseas acelerar el protocolo.</div>
        </div>
        <div class="sci-fact-item">
          <span class="sci-fact-icon">${icons.droplet({ size: 16 })}</span>
          <div><strong>Hidratación es crítica</strong><br>La creatina retiene agua intracelular. Añade al menos 500 ml extra de agua al día.</div>
        </div>
        <div class="sci-fact-item">
          <span class="sci-fact-icon">${icons.dumbbell({ size: 16 })}</span>
          <div><strong>Efectos demostrados</strong><br>+5–15% en fuerza máxima, +10–20% en capacidad de trabajo anaeróbico y mejor recuperación entre series.</div>
        </div>
        <div class="sci-fact-item">
          <span class="sci-fact-icon">${icons.coffee({ size: 16 })}</span>
          <div><strong>La cafeína no interfiere</strong><br>Los meta-análisis confirman que el café habitual no cancela la absorción ni los efectos.</div>
        </div>
        <div class="sci-fact-item">
          <span class="sci-fact-icon">${icons.calendar({ size: 16 })}</span>
          <div><strong>Días de descanso incluidos</strong><br>Tómala en el desayuno todos los días, entrenes o descanses. La clave es la saturación continua.</div>
        </div>
      </div>
    </details>
  `;

  delegate(el, {
    log: async (btn) => {
      if (cr.tomadaHoy) {
        const ok = await askConfirm({
          title: '¿Quitar la toma de hoy?',
          body: 'Vas a romper la racha y cancelar el aviso de agua. Para una toma vieja, bórrala en la lista de abajo.',
          confirmLabel: 'Sí, quitar hoy',
        });
        if (!ok) return;
      }
      btn.disabled = true;
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
    },
    del: async (t) => {
      const btn = t.closest('[data-action="del"]');
      if (!btn) return;
      const ok = await askConfirm({
        title: 'Borrar toma',
        body: 'Se quita del calendario. La racha se recalcula.',
        confirmLabel: 'Borrar',
      });
      if (!ok) return;
      await deleteIntake(Number(btn.dataset.id));
      const next = await creatineSummary();
      await render(el);
      if (!next.tomadaHoy) cancelWaterReminders().catch(() => {});
    },
    prev: async () => { view = view.m === 0 ? { y: view.y - 1, m: 11 } : { y: view.y, m: view.m - 1 }; await render(el); },
    next: async () => {
      if (isCurrent) return;
      view = view.m === 11 ? { y: view.y + 1, m: 0 } : { y: view.y, m: view.m + 1 };
      await render(el);
    }
  });

  forms(el, {
    manual: async (f) => {
      const cantidad = num(f.elements.cantidad.value);
      if (!(cantidad > 0)) { toast('Escribe una cantidad válida.', { tone: 'warn' }); return; }
      const fecha = f.elements.fecha.value;
      const existing = await intakesForDate(fecha);
      if (existing.length) {
        toast('Ese día ya tiene una toma. Bórrala de la lista si quieres cambiarla.', { tone: 'warn' });
        return;
      }
      await logIntake({ cantidad, fecha });
      if (fecha === todayISO()) await scheduleAfterCreatine(fecha);
      await render(el);
      toast('Creatina registrada');
    }
  });
}
