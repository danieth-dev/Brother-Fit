/* Recordatorios locales de agua tras la creatina del día. Sin servidor. */
import { db } from '../db.js';
import { state } from '../store.js';
import { todayISO } from '../utils/dates.js';
import { now } from '../utils/clock.js';

const META_KEY = 'waterReminders';
const TAG = 'bf-agua';

/* 45 min y 3 h después de la toma. No avisar de noche. */
const DELAYS_MS = [45 * 60 * 1000, 3 * 60 * 60 * 1000];
const QUIET_START = 22; /* desde las 22:00 no se programa */
const QUIET_END = 8;   /* antes de las 8:00 se empuja a las 8 */

const COPY = [
  'Bebe un vaso de agua. Con creatina conviene un poco más de hidratación.',
  'Otro vaso viene bien. La creatina pide unos 500 ml extra de agua al día.',
];

let timers = [];

function enabled() {
  return state.settings?.aguaRecordatorios !== false;
}

function clampToDaytime(ts) {
  const d = new Date(ts);
  const h = d.getHours();
  if (h >= QUIET_START) return null;
  if (h < QUIET_END) {
    d.setHours(QUIET_END, 0, 0, 0);
    return d.getTime();
  }
  return ts;
}

async function loadPlan() {
  const row = await db.get('meta', META_KEY);
  return row?.value || null;
}

async function savePlan(plan) {
  if (!plan) {
    await db.remove('meta', META_KEY);
    return;
  }
  await db.put('meta', { key: META_KEY, value: plan });
}

function clearTimers() {
  for (const id of timers) clearTimeout(id);
  timers = [];
}

async function showLocal(body, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const title = 'Brother Fit';
  const opts = {
    body,
    tag,
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    data: { url: './#/' },
  };
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg?.showNotification) {
      await reg.showNotification(title, opts);
      return;
    }
  } catch { /* sigue con Notification del documento */ }
  try {
    new Notification(title, opts);
  } catch { /* sin soporte */ }
}

async function fireDue(plan) {
  if (!plan?.items?.length) return plan;
  const t = now();
  let changed = false;
  for (const item of plan.items) {
    if (item.done || item.at > t) continue;
    await showLocal(item.body, `${TAG}-${item.id}`);
    item.done = true;
    changed = true;
  }
  if (changed) await savePlan(plan);
  return plan;
}

function armTimers(plan) {
  clearTimers();
  if (!plan?.items?.length || !enabled()) return;
  const t = now();
  for (const item of plan.items) {
    if (item.done) continue;
    const wait = item.at - t;
    if (wait <= 0) continue;
    const id = setTimeout(async () => {
      const fresh = await loadPlan();
      if (!fresh || fresh.fecha !== todayISO() || !enabled()) return;
      const row = fresh.items.find((x) => x.id === item.id);
      if (!row || row.done) return;
      await showLocal(row.body, `${TAG}-${row.id}`);
      row.done = true;
      await savePlan(fresh);
    }, wait);
    timers.push(id);
  }
}

export async function ensureNotifyPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

/** Tras registrar creatina de hoy. */
export async function scheduleAfterCreatine(fecha = todayISO()) {
  if (!enabled() || fecha !== todayISO()) return { ok: false, reason: 'off' };
  if (!('Notification' in window)) return { ok: false, reason: 'unsupported' };

  const perm = await ensureNotifyPermission();
  if (perm !== 'granted') return { ok: false, reason: perm };

  const existing = await loadPlan();
  if (existing?.fecha === fecha && existing.items?.some((i) => !i.done)) {
    armTimers(existing);
    return { ok: true, reason: 'already' };
  }

  const base = now();
  const items = [];
  for (let i = 0; i < DELAYS_MS.length; i++) {
    const at = clampToDaytime(base + DELAYS_MS[i]);
    if (at == null) continue;
    items.push({ id: i + 1, at, body: COPY[i] || COPY[0], done: false });
  }
  if (!items.length) return { ok: false, reason: 'quiet' };

  const plan = { fecha, items };
  await savePlan(plan);
  armTimers(plan);
  return { ok: true, reason: 'scheduled', count: items.length };
}

/** Si ya no hay toma hoy (deshacer / borrar), suelta los avisos. */
export async function cancelWaterReminders() {
  clearTimers();
  await savePlan(null);
  try {
    const reg = await navigator.serviceWorker?.ready;
    const all = await reg?.getNotifications?.() || [];
    for (const n of all) {
      if (String(n.tag || '').startsWith(TAG)) n.close();
    }
  } catch { /* ok */ }
}

/** Al abrir la app: dispara vencidos y rearma pendientes. */
export async function resumeWaterReminders() {
  if (!enabled()) {
    clearTimers();
    return;
  }
  let plan = await loadPlan();
  if (!plan || plan.fecha !== todayISO()) {
    if (plan) await savePlan(null);
    clearTimers();
    return;
  }
  plan = await fireDue(plan);
  armTimers(plan);
}
