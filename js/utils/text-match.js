/* Búsqueda sin tildes ni mayúsculas. Utilidad pura: sin DOM y sin servicios. */

export function fold(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Qué tan buena es la coincidencia: 0 = empieza así · 1 = una palabra empieza así · 2 = aparece en medio. */
export function matchScore(foldedName, q) {
  if (foldedName.startsWith(q)) return 0;
  if (foldedName.includes(` ${q}`)) return 1;
  return 2;
}

/**
 * Dónde está la búsqueda (ya doblada) dentro del nombre original, con tildes.
 * Devuelve [inicio, fin) en caracteres de `[...name]`, o null si no aparece.
 */
export function matchRange(name, q) {
  if (!q) return null;
  const chars = [...String(name || '')];
  const folded = chars.map((c) => fold(c));
  const at = folded.join('').indexOf(q);
  if (at < 0) return null;
  let pos = 0;
  let start = -1;
  let end = chars.length;
  for (let i = 0; i < chars.length; i++) {
    if (start < 0 && pos >= at) start = i;
    pos += folded[i].length;
    if (pos >= at + q.length) { end = i + 1; break; }
  }
  return [Math.max(start, 0), end];
}
