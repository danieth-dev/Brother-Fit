export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

/* Acepta coma o punto decimal. Devuelve NaN si no es un número. */
export const num = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};
export const fmtNum = (n) => {
  const num = typeof n === 'number' ? n : parseFloat(String(n ?? '').replace(',', '.'));
  if (!Number.isFinite(num)) return String(n ?? '');
  return Number.isInteger(num) ? String(num) : num.toFixed(1).replace(/\.0$/, '');
};
export const go = (path) => { location.hash = '#' + path; };

/* Un solo listener por tipo de evento y elemento: re-renderizar no los acumula. */
function on(el, type, handler) {
  el._h ??= {};
  if (el._h[type]) el.removeEventListener(type, el._h[type]);
  el._h[type] = handler;
  el.addEventListener(type, handler);
}

/* Clicks:  <button data-action="nombre"> */
export function delegate(root, handlers) {
  on(root, 'click', (e) => {
    const t = e.target.closest('[data-action]');
    if (t && root.contains(t)) handlers[t.dataset.action]?.(t, e);
  });
}
/* Formularios:  <form data-form="nombre"> */
export function forms(root, handlers) {
  on(root, 'submit', (e) => {
    const f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    handlers[f.dataset.form]?.(f, e);
  });
}
/* Cambios en inputs/selects:  <select data-change="nombre"> */
export function changes(root, handlers) {
  on(root, 'change', (e) => {
    const t = e.target.closest('[data-change]');
    if (t) handlers[t.dataset.change]?.(t, e);
  });
}

let toastTimer;
/** @param {'ok'|'warn'|'danger'} [opts.tone] warn se ve como el toast clásico; danger usa borde rojo. */
export function toast(msg, { actionLabel, onAction, ms = 4000, tone = 'ok' } = {}) {
  const el = document.getElementById('toast');
  const hide = () => { el.hidden = true; };
  el.className = tone === 'danger' ? 'toast toast--danger' : 'toast';
  el.replaceChildren();
  const span = document.createElement('span');
  span.textContent = msg;
  el.append(span);
  if (actionLabel) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = actionLabel;
    b.addEventListener('click', () => { hide(); onAction?.(); });
    el.append(b);
  }
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hide, ms);
}
