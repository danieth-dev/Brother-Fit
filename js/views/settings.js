/**
 * settings view — High-Tech Athletic Settings Panel for Brother Fit.
 * Groups: Preferencias, Asistente Fit, Datos y respaldo, Zona de riesgo.
 */

import { state, saveSettings } from '../store.js';
import { exportData, importData, lastBackup } from '../services/backup.js';
import { ensureNotifyPermission, cancelWaterReminders, resumeWaterReminders } from '../services/water-reminders.js';
import { getActiveAgent } from '../services/agent.js';
import { showMemoriesPanel, showConnectionPanel } from './agent.js';
import { db } from '../db.js';
import { toast, esc, num } from '../utils/dom.js';
import { icons } from '../utils/icons.js';
import { askConfirm } from '../utils/confirm-sheet.js';

function formatRelativeBackup(ts) {
  if (!ts) {
    return {
      text: 'Sin respaldos previos',
      sub: 'Crea un respaldo para proteger tus datos en este teléfono',
      isOld: true,
      hasBackup: false,
    };
  }
  const diff = Date.now() - ts;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const fullDate = new Date(ts).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });

  if (days <= 0) {
    return {
      text: 'Último respaldo: hoy',
      sub: `${fullDate} · Tu navegador no borrará los datos solo`,
      isOld: false,
      hasBackup: true,
    };
  }
  if (days === 1) {
    return {
      text: 'Último respaldo: ayer',
      sub: `${fullDate} · Tu navegador no borrará los datos solo`,
      isOld: false,
      hasBackup: true,
    };
  }
  return {
    text: `Último respaldo: hace ${days} días`,
    sub: `${fullDate} · Tu navegador no borrará los datos solo`,
    isOld: days >= 7,
    hasBackup: true,
  };
}

export async function render(el) {
  const s = state.settings;
  const [backupTs, persisted] = await Promise.all([
    lastBackup(),
    navigator.storage?.persisted?.() ?? false,
  ]);

  const backupInfo = formatRelativeBackup(backupTs);

  // Mapeo de aspecto
  const themeColorMap = {
    amarillo: '#FFE600',
    azul: '#3B82F6',
    rosado: '#EC4899',
  };
  const activeColor = themeColorMap[s.tema] || '#FFE600';

  const modeTextMap = {
    oscuro: 'Oscuro',
    claro: 'Claro',
    sistema: 'Sistema',
  };
  const activeModeText = modeTextMap[s.modo] || 'Oscuro';

  // Notificaciones
  const notifState = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
  const waterActive = s.aguaRecordatorios !== false;

  el.innerHTML = `
    <header class="settings-head">
      <a class="settings-back-btn" href="#/" aria-label="Volver a Inicio">
        ${icons.arrowLeft({ size: 26 })}
      </a>
      <h1 class="settings-title">Ajustes</h1>
    </header>

    <div class="settings-view">
      <!-- 1. PREFERENCIAS -->
      <section class="settings-section">
        <h2 class="settings-section-title">Preferencias</h2>
        <div class="settings-card">
          <!-- Aspecto -->
          <a class="settings-row" href="#/appearance" id="row-appearance">
            <div class="settings-row-main">
              <span class="settings-row-label">Aspecto</span>
            </div>
            <div class="settings-row-val">
              <span class="settings-dot" style="background:${activeColor}"></span>
              <span>${activeModeText}</span>
              ${icons.chevronRight({ size: 18, stroke: '#8A8A8A' })}
            </div>
          </a>

          <!-- Descanso entre series -->
          <button class="settings-row" type="button" id="row-rest-toggle">
            <div class="settings-row-main">
              <span class="settings-row-label">Descanso entre series</span>
              <span class="settings-row-sub">${s.descansoMode === 'auto' ? 'Se ajusta solo según tus repeticiones' : 'Tiempo fijo por serie'}</span>
            </div>
            <div class="settings-row-val">
              <span>${s.descansoMode === 'auto' ? 'Automático' : `${s.descanso || 90}s fijo`}</span>
              ${icons.chevronRight({ size: 18, stroke: '#8A8A8A' })}
            </div>
          </button>

          <!-- Grilla de descanso automático -->
          ${
            s.descansoMode === 'auto'
              ? `
            <div class="settings-rest-grid">
              <div class="settings-rest-box">
                <p>1–5 reps</p>
                <p class="val">3:00</p>
              </div>
              <div class="settings-rest-box">
                <p>6–8 reps</p>
                <p class="val">2:00</p>
              </div>
              <div class="settings-rest-box">
                <p>9–12 reps</p>
                <p class="val">1:30</p>
              </div>
              <div class="settings-rest-box">
                <p>13+ reps</p>
                <p class="val">1:00</p>
              </div>
            </div>
          `
              : `
            <div style="padding:0 16px 14px; display:flex; align-items:center; gap:10px;">
              <span style="font-size:13px; color:#A8A8A8;">Segundos de descanso:</span>
              <input 
                id="input-descanso-manual" 
                type="number" 
                value="${s.descanso || 90}" 
                min="10" 
                max="900" 
                step="5"
                class="agent-rec-edit-input" 
                style="width:80px; height:36px; text-align:center; font-weight:700;"
              >
              <button type="button" class="btn btn-primary" id="btn-save-manual-rest" style="height:36px; padding:0 12px; font-size:13px;">
                Guardar
              </button>
            </div>
          `
          }

          <!-- Recordatorio de agua -->
          <div class="settings-row" style="cursor:default">
            <div class="settings-row-main">
              <span class="settings-row-label">Recordatorio de agua</span>
              <span class="settings-row-sub">2 avisos suaves el mismo día de tu creatina</span>
            </div>
            <button 
              type="button" 
              role="switch" 
              class="settings-switch" 
              id="switch-water-reminders" 
              aria-checked="${waterActive ? 'true' : 'false'}"
              aria-label="Activar o desactivar recordatorio de agua"
            >
              <span class="settings-switch-thumb"></span>
            </button>
          </div>

          <!-- Cuándo avisar (si está activo) -->
          ${
            waterActive
              ? `
            <div class="settings-row" style="cursor:default">
              <div class="settings-row-main">
                <span class="settings-row-label">Cuándo avisar</span>
              </div>
              <div class="settings-row-val">
                <span style="color:#A8A8A8">Tras registrar la creatina</span>
              </div>
            </div>
          `
              : ''
          }

          <!-- Estado de notificaciones -->
          <div class="settings-status-line">
            <span class="settings-dot" style="background:${notifState === 'granted' ? '#10B981' : notifState === 'denied' ? '#FF6B7A' : '#FFE600'}"></span>
            <span>
              ${
                notifState === 'granted'
                  ? 'Notificaciones del teléfono permitidas'
                  : notifState === 'denied'
                  ? 'Notificaciones bloqueadas en los ajustes del teléfono'
                  : 'Toca el interruptor para permitir notificaciones'
              }
            </span>
          </div>
        </div>
      </section>

      <!-- 2. ASISTENTE FIT -->
      <section class="settings-section">
        <h2 class="settings-section-title">Asistente Fit</h2>
        <div class="settings-card">
          <button class="settings-row" type="button" id="btn-open-memories">
            <div class="settings-row-main">
              <span class="settings-row-label">Recuerdos</span>
              <span class="settings-row-sub">Lo que Fit recuerda de ti entre charlas</span>
            </div>
            <div class="settings-row-val">
              ${icons.chevronRight({ size: 18, stroke: '#8A8A8A' })}
            </div>
          </button>

          <button class="settings-row" type="button" id="btn-open-connection">
            <div class="settings-row-main">
              <span class="settings-row-label">Conexión</span>
              <span class="settings-row-sub">API key, proveedor y voz del asistente</span>
            </div>
            <div class="settings-row-val">
              ${icons.chevronRight({ size: 18, stroke: '#8A8A8A' })}
            </div>
          </button>
        </div>
      </section>

      <!-- 3. DATOS Y RESPALDO -->
      <section class="settings-section">
        <h2 class="settings-section-title">Datos y respaldo</h2>
        <p class="settings-section-desc">
          Todo se guarda solo en este teléfono. Haz respaldos periódicos para no perder tus entrenamientos, récords y recuerdos.
        </p>

        <div class="settings-card" style="padding:14px 16px; display:flex; flex-direction:column; gap:12px;">
          <div style="display:flex; align-items:flex-start; gap:10px;">
            <span class="settings-dot" style="background:${backupInfo.hasBackup && !backupInfo.isOld ? '#10B981' : '#FFE600'}; margin-top:6px;"></span>
            <div class="settings-row-main">
              <span class="settings-row-label">${esc(backupInfo.text)}</span>
              <span class="settings-row-sub">${esc(backupInfo.sub)}</span>
            </div>
          </div>

          <button 
            type="button" 
            class="settings-btn-primary ${backupInfo.isOld ? 'is-overdue' : ''}" 
            id="btn-create-backup"
          >
            ${icons.share({ size: 18 })} Crear respaldo
          </button>

          <label class="settings-btn-secondary" style="margin:0">
            ${icons.upload({ size: 18 })} Restaurar un respaldo
            <input type="file" accept="application/json,.json" id="file-import-backup" hidden>
          </label>
        </div>
      </section>

      <!-- PWA Install Prompt si está disponible -->
      ${
        state.installPrompt
          ? `
        <section class="settings-section">
          <h2 class="settings-section-title">Aplicación</h2>
          <div class="settings-card" style="padding:14px 16px;">
            <button class="settings-btn-primary" type="button" id="btn-install-app">
              Instalar en la pantalla de inicio
            </button>
          </div>
        </section>
      `
          : ''
      }

      <!-- 4. ZONA DE RIESGO -->
      <section class="settings-section">
        <h2 class="settings-section-title is-danger">Zona de riesgo</h2>
        <div class="settings-card is-danger">
          <p style="margin:0; font-size:14px; line-height:1.45; color:#C4C4C4;">
            Borra entrenamientos, creatina y recuerdos de este teléfono. No se puede deshacer, así que crea un respaldo antes.
          </p>
          <button class="settings-btn-danger" type="button" id="btn-danger-reset">
            ${icons.trash({ size: 18 })} Borrar todos los datos
          </button>
        </div>
      </section>
    </div>
  `;

  // --- Event Handlers ---

  // 1. Descanso: alternar auto / manual
  el.querySelector('#row-rest-toggle')?.addEventListener('click', async () => {
    const nextMode = s.descansoMode === 'auto' ? 'manual' : 'auto';
    await saveSettings({ descansoMode: nextMode });
    toast(nextMode === 'auto' ? 'Descanso automático activado' : 'Descanso manual activado');
    await render(el);
  });

  // Guardar descanso manual
  el.querySelector('#btn-save-manual-rest')?.addEventListener('click', async () => {
    const input = el.querySelector('#input-descanso-manual');
    const val = Math.round(num(input?.value));
    if (!(val >= 10 && val <= 900)) {
      toast('Usa un valor entre 10 y 900 segundos.');
      return;
    }
    await saveSettings({ descanso: val });
    toast(`Descanso fijado en ${val} segundos`);
    await render(el);
  });

  // 2. Switch de agua
  const waterSwitch = el.querySelector('#switch-water-reminders');
  waterSwitch?.addEventListener('click', async () => {
    const next = !waterActive;
    await saveSettings({ aguaRecordatorios: next });
    if (next) {
      const perm = await ensureNotifyPermission();
      if (perm === 'denied') {
        toast('El teléfono bloqueó las notificaciones. Actívalas en ajustes del sistema.');
      } else if (perm === 'unsupported') {
        toast('Este navegador no soporta notificaciones locales.');
      } else {
        await resumeWaterReminders();
        toast('Recordatorios de agua activados');
      }
    } else {
      await cancelWaterReminders();
      toast('Recordatorios de agua apagados');
    }
    await render(el);
  });

  // 3. Abrir Recuerdos
  el.querySelector('#btn-open-memories')?.addEventListener('click', () => {
    showMemoriesPanel(el, getActiveAgent());
  });

  // 4. Abrir Conexión y API key
  el.querySelector('#btn-open-connection')?.addEventListener('click', () => {
    showConnectionPanel(el, getActiveAgent());
  });

  // 5. Crear respaldo
  el.querySelector('#btn-create-backup')?.addEventListener('click', async () => {
    try {
      const r = await exportData();
      if (r.mode === 'cancelled') return;
      toast(r.mode === 'share' ? 'Respaldo compartido' : 'Respaldo guardado con éxito');
      await render(el);
    } catch (e) {
      toast('No se pudo respaldar: ' + e.message);
    }
  });

  // 6. Restaurar respaldo
  el.querySelector('#file-import-backup')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ok = await askConfirm({
      title: 'Restaurar respaldo',
      body: 'Se reemplazarán todos los entrenamientos, marcas y recuerdos con los de este archivo. No se puede deshacer.',
      confirmLabel: 'Restaurar datos',
      danger: true,
    });
    if (!ok) {
      e.target.value = '';
      return;
    }
    try {
      await importData(file);
      location.reload();
    } catch (err) {
      toast('Archivo no válido: ' + err.message);
      e.target.value = '';
    }
  });

  // 7. Instalar app
  el.querySelector('#btn-install-app')?.addEventListener('click', async () => {
    const p = state.installPrompt;
    if (!p) return;
    p.prompt();
    await p.userChoice;
    state.installPrompt = null;
    await render(el);
  });

  // 8. Zona de riesgo: Borrar datos con doble confirmación
  el.querySelector('#btn-danger-reset')?.addEventListener('click', async () => {
    const first = await askConfirm({
      title: 'Borrar todos los datos',
      body: 'Se eliminarán tus entrenamientos, historial, creatina, peso y recuerdos de este teléfono.',
      confirmLabel: 'Continuar',
      danger: true,
    });
    if (!first) return;

    const second = await askConfirm({
      title: '¿Estás 100% seguro?',
      body: 'Esta acción no se puede deshacer. Se recomienda crear un respaldo antes.',
      confirmLabel: 'Eliminar todo definitivamente',
      danger: true,
    });
    if (!second) return;

    try {
      localStorage.setItem('brother_fit_cleared', '1');
      await db.clearAll();
      location.hash = '#/';
      location.reload();
    } catch (err) {
      toast('No se pudieron borrar los datos: ' + (err?.message || err));
    }
  });
}
