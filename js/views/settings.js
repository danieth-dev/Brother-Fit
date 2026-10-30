import { state, saveSettings } from '../store.js';
import { exportData, importData, lastBackup } from '../services/backup.js';
import { ensureNotifyPermission, cancelWaterReminders, resumeWaterReminders } from '../services/water-reminders.js';
import { db } from '../db.js';
import { delegate, changes, toast, num } from '../utils/dom.js';
import { icons } from '../utils/icons.js';
import { askConfirm } from '../utils/confirm-sheet.js';

export async function render(el) {
  const s = state.settings;
  const [backup, persisted] = await Promise.all([lastBackup(), navigator.storage?.persisted?.() ?? false]);
  const backupText = backup ? `Último respaldo: ${new Date(backup).toLocaleDateString('es')}` : 'Todavía no has hecho ningún respaldo.';

  el.innerHTML = `
    <header class="page-head"><h1>Ajustes</h1></header>

    <div class="form-card stack">
      <a class="row row--compact" href="#/appearance" style="padding:10px 0; border-bottom:1px solid var(--line); margin-bottom:8px">
        <div>
          <strong style="display:flex; align-items:center; gap:8px">
            ${icons.sliders({ size: 18, stroke: 'var(--primary)' })} Aspecto
          </strong>
          <small class="muted">Tema, modo oscuro/claro y color de acento</small>
        </div>
        ${icons.chevronRight({ size: 18, cls: 'chev' })}
      </a>

      <label class="field"><span>Descanso entre series</span>
        <select data-change="descansoMode">
          <option value="auto" ${s.descansoMode === 'auto' ? 'selected' : ''}>Automático (según reps)</option>
          <option value="manual" ${s.descansoMode === 'manual' ? 'selected' : ''}>Manual (fijo)</option>
        </select></label>
      <p class="hint" id="rest-mode-hint" ${s.descansoMode !== 'auto' ? 'hidden' : ''}>1–5 reps → 3 min · 6–8 → 2 min · 9–12 → 1:30 · 13+ → 1 min</p>
      <label class="field" id="descanso-manual" ${s.descansoMode !== 'manual' ? 'hidden' : ''}><span>Segundos de descanso fijo</span>
        <input data-change="descanso" inputmode="numeric" value="${s.descanso}"></label>
      <label class="field"><span>Recordatorios de agua</span>
        <select data-change="aguaRecordatorios">
          <option value="1" ${s.aguaRecordatorios !== false ? 'selected' : ''}>Tras la creatina de hoy</option>
          <option value="0" ${s.aguaRecordatorios === false ? 'selected' : ''}>Apagados</option>
        </select></label>
      <p class="hint">Dos avisos suaves el mismo día (vaso de agua). El teléfono debe permitir notificaciones.</p>
    </div>

    <h2 class="section-title">Tus datos y respaldos</h2>
    <p class="muted" style="margin-bottom:12px; font-size:var(--fs-xs)">
      Todo vive solo en este teléfono. Asegura tus PRs compartiendo un respaldo a WhatsApp, Drive o Archivos.
    </p>
    <div class="stack">
      <button class="btn btn-primary btn-block" data-action="export" type="button">
        ${icons.share({ size: 18 })} Asegurar mis PRs
      </button>
      <label class="btn btn-block" style="cursor:pointer">
        ${icons.upload({ size: 18 })} Restaurar respaldo
        <input type="file" accept="application/json,.json" data-change="import" hidden>
      </label>
      <p class="hint">${backupText}<br>Almacenamiento persistente: ${persisted ? 'activo' : 'no confirmado'}.</p>
    </div>

    ${state.installPrompt ? `
      <h2 class="section-title">Aplicación</h2>
      <button class="btn btn-block" data-action="install" type="button">Instalar en la pantalla de inicio</button>` : ''}

    <h2 class="section-title" style="color:var(--red)">Zona de riesgo</h2>
    <button class="btn btn-danger btn-block" data-action="reset" type="button">
      ${icons.trash({ size: 18 })} Borrar todos los datos
    </button>
  `;

  changes(el, {
    descanso: async (t) => {
      const v = Math.round(num(t.value));
      if (!(v >= 5 && v <= 900)) { toast('Usa un valor entre 5 y 900 segundos.'); t.value = state.settings.descanso; return; }
      await saveSettings({ descanso: v });
      toast('Ajuste guardado');
    },
    descansoMode: async (t) => {
      await saveSettings({ descansoMode: t.value });
      const hint = el.querySelector('#rest-mode-hint');
      const manual = el.querySelector('#descanso-manual');
      if (hint) hint.hidden = t.value !== 'auto';
      if (manual) manual.hidden = t.value !== 'manual';
      toast('Ajuste guardado');
    },
    aguaRecordatorios: async (t) => {
      const on = t.value === '1';
      await saveSettings({ aguaRecordatorios: on });
      if (on) {
        const perm = await ensureNotifyPermission();
        if (perm === 'denied') toast('El teléfono bloqueó las notificaciones. Actívalas en ajustes del sistema.');
        else if (perm === 'unsupported') toast('Este navegador no muestra notificaciones.');
        else {
          await resumeWaterReminders();
          toast('Ajuste guardado');
        }
      } else {
        await cancelWaterReminders();
        toast('Ajuste guardado');
      }
    },
    import: async (t) => {
      const file = t.files[0];
      if (!file) return;
      const ok = await askConfirm({
        title: 'Restaurar respaldo',
        body: 'Reemplaza todos los datos actuales. No se puede deshacer.',
        confirmLabel: 'Restaurar',
      });
      if (!ok) { t.value = ''; return; }
      try {
        await importData(file);
        location.reload();
      } catch (e) { toast(e.message); t.value = ''; }
    }
  });

  delegate(el, {
    tema: async (t) => {
      const next = t.dataset.tema === 'azul' || t.dataset.tema === 'rosado' ? t.dataset.tema : 'amarillo';
      if (next === (state.settings.tema || 'amarillo')) return;
      await saveSettings({ tema: next });
      el.querySelectorAll('[data-action="tema"]').forEach((b) => {
        b.setAttribute('aria-pressed', String(b.dataset.tema === next));
      });
    },
    export: async () => {
      try {
        const r = await exportData();
        if (r.mode === 'cancelled') return;
        toast(r.mode === 'share' ? 'Respaldo compartido' : 'Respaldo guardado');
        await render(el);
      } catch (e) { toast('No se pudo respaldar: ' + e.message); }
    },
    install: async () => {
      const p = state.installPrompt;
      if (!p) return;
      p.prompt();
      await p.userChoice;
      state.installPrompt = null;
      await render(el);
    },
    reset: async () => {
      const first = await askConfirm({
        title: 'Borrar todos los datos',
        body: 'Se borran entrenos, creatina, peso y ajustes.',
        confirmLabel: 'Continuar',
      });
      if (!first) return;
      const second = await askConfirm({
        title: 'Última confirmación',
        body: 'No se puede deshacer.',
        confirmLabel: 'Borrar todo',
      });
      if (!second) return;
      try {
        localStorage.setItem('brother_fit_cleared', '1');
        await db.clearAll();
        location.hash = '#/';
        location.reload();
      } catch (err) {
        console.error('Error al borrar datos:', err);
        toast('No se pudieron borrar los datos: ' + (err?.message || err));
      }
    }
  });
}
