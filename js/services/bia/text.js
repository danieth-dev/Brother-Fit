/* Reglas de texto de los turnos: qué se muestra de lo que dice Bía y qué cuenta como turno del atleta. */

/* Lo que Bía dice. Un comentario interno no se muestra. */
export function visibleFitText(raw) {
  const text = String(raw || '');
  if (text.includes('<!--') && !text.includes('-->')) return '';
  return text.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').trim();
}

export function isAthleteTurn(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (/[0-9]/.test(t)) return true;
  if (/[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]{3,}/.test(t)) return true;
  return /^(si|sí|no|ok)$/i.test(t);
}
