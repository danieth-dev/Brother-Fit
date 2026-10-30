/* Fechas como texto local 'YYYY-MM-DD' (ordenables y sin problemas de zona horaria). */
const pad = (n) => String(n).padStart(2, '0');

export const toISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISO(new Date());
export const nowHM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

export const parseISO = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); };

/* Lunes de la semana de `iso`. */
export const startOfWeekISO = (iso = todayISO()) => {
  const d = parseISO(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toISO(d);
};

const fLong = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' });
const fMedium = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'short' });
const fShort = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });
const fDay = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' });
const fMonth = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' });

export const formatLong = (iso) => fLong.format(parseISO(iso));
export const formatMedium = (iso) => {
  const str = fMedium.format(parseISO(iso)).replace(/\./g, '');
  return str.replace(/(^\w{1})|(\s+\w{1})/g, (l) => l.toUpperCase());
};
export const formatShort = (iso) => fShort.format(parseISO(iso));
export const formatDay = (iso) => fDay.format(parseISO(iso));
export const formatMonth = (y, m) => fMonth.format(new Date(y, m, 1));

export function formatDuration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
