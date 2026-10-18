import { creatineSummary, logIntake, deleteIntake } from '../services/creatine.js';
import { state } from '../store.js';
import { delegate, forms, toast, esc, num, fmtNum } from '../utils/dom.js';
import { formatMonth, formatLong, todayISO, nowHM, toISO } from '../utils/dates.js';
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
  inicio:       icons.flask({ size: 22 }),
  cargando:     icons.bolt({ size: 22 }),
  saturando:    icons.flame({ size: 22 }),
  mantenimiento:icons.muscle({ size: 22 }),
};

const FASE_LABELS = {
  inicio:       'Iniciando protocolo',
  cargando:     'Cargando creatina',
  saturando:    'Saturando músculo',
  mantenimiento:'Mantenimiento activo',
};

const FASE_DESC = {
  inicio: 'Primeros días: la creatina comienza a acumularse en el músculo. La toma constante es clave.',
  cargando: 'Los músculos están incorporando la creatina. Los depósitos están al 25–50%.',
  saturando: 'Depósitos sobre el 50%. En las próximas semanas notarás mayor rendimiento en series pesadas.',
  mantenimiento: 'Saturación completa. Los depósitos musculares están llenos. Mantén la dosis diaria.',
};

function saturationBar(pct, fase) {
  const faseClass = fase === 'mantenimiento' ? 'sat-bar--full' : '';
  return `
    <div class="sat-panel">
      <div class="sat-header">
        <span class="sat-icon">${FASE_ICONS[fase]}</span>
        <div class="sat-info">
          <strong class="sat-label">${FASE_LABELS[fase]}</strong>
          <small class="sat-pct-label">${pct}% de saturación muscular</small>
        </div>
        <span class="sat-pct num">${pct}%</span>
      </div>
      <div class="sat-track">
        <div class="sat-fill ${faseClass}" style="width:${pct}%" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"></div>
      </div>
      <p class="sat-desc">${FASE_DESC[fase]}</p>
    </div>
  `;
}

function sciencePanel(sat) {
  const { diasEfectivos, semanasEfecto, consistencia28, fase } = sat;

  const efectoStr = fase === 'mantenimiento'
    ? '<span style="color:var(--green);font-weight:700">Efecto máximo activo</span>'
    : `~${semanasEfecto} sem. a saturación`;

  const consistenciaColor = consistencia28 >= 85
    ? 'var(--green)'
    : consistencia28 >= 60
    ? 'var(--yellow)'
    : 'var(--red)';

  return `
    <div class="sci-grid">
      <div class="sci-card">
        <span class="sci-val num" style="color:var(--primary)">${diasEfectivos}</span>
        <span class="sci-key">días efectivos<small>(últimos 28)</small></span>
      </div>
      <div class="sci-card">
        <span class="sci-val num" style="color:${consistenciaColor}">${consistencia28}%</span>
        <span class="sci-key">consistencia<small>28 días</small></span>
      </div>
      <div class="sci-card">
        <span class="sci-val" style="font-size:var(--fs-sm);color:var(--text)">${efectoStr}</span>
        <span class="sci-key">tiempo estimado</span>
      </div>
    </div>

    <details class="sci-facts">
      <summary>
        <span>¿Cómo funciona la creatina?</span>
        ${icons.chevronDown({ size: 18, cls: 'muted' })}
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
}

export async function render(el) {
  const cr = await creatineSummary();
  const g = state.settings.creatinaGramos;
  const isCurrent = view.y === now.getFullYear() && view.m === now.getMonth();

  el.innerHTML = `
    <header class="page-head"><h1>Creatina</h1></header>

    ${creatinePlate(cr, g, 'log', `
      <p>${cr.tomadaHoy
        ? `${cr.hoy.count} toma${cr.hoy.count > 1 ? 's' : ''} · ${fmtNum(cr.hoy.gramos)} g registrados`
        : 'Aún no registras la toma de hoy'}</p>
    `)}

    <div class="stats">
      <div class="stat"><b>${cr.racha}</b><span>días racha</span></div>
      <div class="stat"><b>${cr.dias7}/7</b><span>últimos 7 días</span></div>
      <div class="stat"><b>${cr.dias30}/30</b><span>últimos 30 días</span></div>
    </div>

    ${saturationBar(cr.saturacion.porcentajeSaturacion, cr.saturacion.fase)}
    ${sciencePanel(cr.saturacion)}

    <div style="margin-top:30px">
      <div class="cal-head">
        <button class="btn-x" data-action="prev" type="button" aria-label="Mes anterior">${icons.chevronLeft({ size: 20 })}</button>
        <h2>${esc(formatMonth(view.y, view.m))}</h2>
        <button class="btn-x" data-action="next" type="button" aria-label="Mes siguiente" ${isCurrent ? 'disabled style="opacity:.3"' : ''}>${icons.chevronRight({ size: 20 })}</button>
      </div>
      <div class="cal">
        ${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => `<span class="dow">${d}</span>`).join('')}
        ${monthCells(view.y, view.m, cr.map)}
      </div>
    </div>

    <details class="form-card" style="margin-top:26px">
      <summary>
        <span>Añadir toma retroactiva</span>
        ${icons.plus({ size: 18, cls: 'muted' })}
      </summary>
      <form class="stack" data-form="manual">
        <div class="grid-3">
          <label class="field"><span>Día</span><input type="date" name="fecha" value="${todayISO()}" max="${todayISO()}" required></label>
          <label class="field"><span>Hora</span><input data-time name="hora" value="${nowHM()}" inputmode="none" readonly required></label>
          <label class="field"><span>Gramos</span><input name="cantidad" inputmode="decimal" value="${fmtNum(g)}" required></label>
        </div>
        <button class="btn btn-primary btn-block" type="submit">Guardar toma</button>
      </form>
    </details>

    <h2 class="section-title">Últimas tomas</h2>
    ${cr.intakes.length ? `
      <div class="list">
        ${cr.intakes.slice(0, 15).map((i) => `
          <div class="row">
            <div>
              <strong class="num" style="text-transform:capitalize">${esc(formatLong(i.fecha))}</strong>
              <small class="num">${esc(i.hora)} · ${fmtNum(i.cantidad)} g</small>
            </div>
            <button class="btn-x" data-action="del" data-id="${i.id}" type="button" aria-label="Borrar toma">
              ${icons.trash({ size: 16 })}
            </button>
          </div>`).join('')}
      </div>`
      : `<div class="empty">
          ${icons.flask({ size: 36, stroke: 'var(--line-strong)' })}
          <p>Aún no hay tomas registradas.</p>
        </div>`}
  `;

  delegate(el, {
    log: async (btn) => {
      btn.disabled = true;
      const id = await logIntake({ cantidad: g });
      await render(el);
      toast('Creatina registrada', {
        actionLabel: 'Deshacer',
        onAction: async () => { await deleteIntake(id); await render(el); }
      });
    },
    del: async (t) => {
      const btn = t.closest('[data-action="del"]');
      if (!btn) return;
      const ok = await askConfirm({
        title: 'Borrar toma',
        body: 'Se quita esta toma del calendario y de la racha.',
      });
      if (!ok) return;
      await deleteIntake(Number(btn.dataset.id));
      await render(el);
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
      if (!(cantidad > 0)) { toast('Escribe una cantidad válida.'); return; }
      await logIntake({ cantidad, fecha: f.elements.fecha.value, hora: f.elements.hora.value });
      await render(el);
      toast('Creatina registrada');
    }
  });
}
