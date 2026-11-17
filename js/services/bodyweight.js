/* Ejercicios con el peso del cuerpo (dominadas, fondos, flexiones, plancha). Reglas puras.
 *
 * En la base una serie guarda el peso AÑADIDO: 0 kg es «solo el cuerpo» y 10 kg es el lastre.
 * Por eso aquí el progreso se mide en repeticiones, que son exactas, y la carga total solo se
 * estima donde se levanta el cuerpo entero y hay peso corporal registrado. */

/* Del catálogo, los que se hacen con el cuerpo. Los del atleta lo marcan con `corporal`. */
const CATALOG_BODYWEIGHT = new Set(['Flexiones', 'Dominadas', 'Fondos', 'Plancha']);

/* Parte del peso corporal que se levanta. Solo donde sube el cuerpo entero: ahí la estimación es
 * fiable. En flexiones depende mucho de la postura y no se estima. */
const BODY_FRACTION = { Dominadas: 1, Fondos: 1 };

const nombreDe = (ex) => String(ex?.nombre || '').trim();

export function isBodyweight(ex) {
  return Boolean(ex?.corporal) || CATALOG_BODYWEIGHT.has(nombreDe(ex));
}

/** Fracción del cuerpo que se levanta, o null si no se estima la carga. */
export function bodyFraction(ex) {
  return BODY_FRACTION[nombreDe(ex)] ?? null;
}

/** Peso corporal de esa fecha o el último anterior; sin anterior, el primero registrado. */
export function bodyWeightOn(fecha, body) {
  const sorted = (body || []).filter((b) => b.peso > 0).sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (!sorted.length) return null;
  let found = null;
  for (const b of sorted) {
    if (b.fecha <= fecha) found = b;
    else break;
  }
  return (found || sorted[0]).peso;
}

/** Carga estimada en kg (cuerpo × fracción + lastre), o null si no se puede estimar. */
export function estimatedLoad(bodyKg, extraKg, fraction) {
  if (!(bodyKg > 0) || fraction == null) return null;
  return Math.round((bodyKg * fraction + (extraKg || 0)) * 10) / 10;
}

/** La carga en palabras para Bía y los resúmenes, siempre en kg: «peso corporal + 10 kg». */
export function loadWords(peso, corporal) {
  if (!corporal) return `${peso} kg`;
  return peso > 0 ? `peso corporal + ${peso} kg` : 'peso corporal';
}

/** Una sesión desde sus series: { repsMax, repsTotal, extra, series } o null sin series de trabajo. */
export function bodyweightSession(sets) {
  const working = (sets || []).filter((s) => s.tipo !== 'calentamiento' && s.reps > 0);
  if (!working.length) return null;
  return {
    repsMax: Math.max(...working.map((s) => s.reps)),
    repsTotal: working.reduce((sum, s) => sum + s.reps, 0),
    extra: Math.max(...working.map((s) => s.peso || 0)),
    series: working.length,
  };
}
