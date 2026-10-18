import { state, saveSettings } from '../store.js';
import { exportData, importData, lastBackup } from '../services/backup.js';
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
      <label class="field"><span>Gramos por toma de creatina</span>
        <input data-change="creatinaGramos" inputmode="decimal" value="${s.creatinaGramos}"></label>
      <label class="field"><span>Descanso entre series</span>
        <select data-change="descansoMode">
          <option value="auto" ${s.descansoMode === 'auto' ? 'selected' : ''}>Automático (según reps)</option>
          <option value="manual" ${s.descansoMode === 'manual' ? 'selected' : ''}>Manual (fijo)</option>
        </select></label>
      <p class="hint" id="rest-mode-hint" ${s.descansoMode !== 'auto' ? 'hidden' : ''}>1–5 reps → 3 min · 6–8 → 2 min · 9–12 → 1:30 · 13+ → 1 min</p>
      <label class="field" id="descanso-manual" ${s.descansoMode !== 'manual' ? 'hidden' : ''}><span>Segundos de descanso fijo</span>
        <input data-change="descanso" inputmode="numeric" value="${s.descanso}"></label>
      <label class="field"><span>Unidad de peso</span>
        <select data-change="unidad">
          <option value="kg" ${s.unidad === 'kg' ? 'selected' : ''}>Kilogramos (kg)</option>
          <option value="lb" ${s.unidad === 'lb' ? 'selected' : ''}>Libras (lb)</option>
        </select></label>
      <p class="hint">Cambiar la unidad solo cambia la etiqueta; no convierte los pesos ya guardados.</p>
    </div>

    <h2 class="section-title">Tus datos y respaldos</h2>
    <p class="muted" style="margin-bottom:12px; font-size:var(--fs-xs)">
      Todo se guarda únicamente en tu dispositivo. Haz respaldos periódicos para resguardar tu historial.
    </p>
    <div class="stack">
      <button class="btn btn-primary btn-block" data-action="export" type="button">
        ${icons.download({ size: 18 })} Exportar respaldo
      </button>
      <label class="btn btn-block" style="cursor:pointer">
        ${icons.upload({ size: 18 })} Importar respaldo
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
    creatinaGramos: async (t) => {
      const v = num(t.value);
      if (!(v > 0)) { toast('Escribe una cantidad válida.'); t.value = state.settings.creatinaGramos; return; }
      await saveSettings({ creatinaGramos: v });
      toast('Ajuste guardado');
    },
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
    unidad: async (t) => { await saveSettings({ unidad: t.value }); toast('Ajuste guardado'); },
    import: async (t) => {
      const file = t.files[0];
      if (!file) return;
      const ok = await askConfirm({
        title: 'Importar respaldo',
        body: 'Reemplaza todos los datos actuales. No se puede deshacer.',
        confirmLabel: 'Importar',
      });
      if (!ok) { t.value = ''; return; }
      try {
        await importData(file);
        location.reload();
      } catch (e) { toast(e.message); t.value = ''; }
    }
  });

  delegate(el, {
    export: async () => {
      try { await exportData(); toast('Respaldo exportado'); await render(el); }
      catch (e) { toast('No se pudo exportar: ' + e.message); }
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
      await db.clearAll();
      location.hash = '#/';
      location.reload();
    }
  });
}
