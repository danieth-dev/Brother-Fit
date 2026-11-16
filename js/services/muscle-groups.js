/* Adivina el grupo muscular de un ejercicio nuevo por su nombre. Regla pura: sin base ni DOM. */
import { fold } from '../utils/text-match.js';
import { GRUPOS } from './workouts.js';

/* Filtro especial de la lista: los ejercicios de hoy. No es un grupo. */
export const FILTRO_HOY = '__hoy__';

/* Casos compuestos primero: evitan que «elevación de piernas» caiga en Piernas. */
const SPECIFIC = [
  [/elevacion(es)?\s*(de\s*)?pierna/i, 'Core'],
  [/jalon|pulldown|dominad|pull\s*up|chin\s*up/i, 'Espalda'],
  [/peso\s*muerto\s*(rumano|rigido)|rdl/i, 'Piernas'],
  [/press\s*cerrado|fondos?\s*(de\s*)?triceps/i, 'Tríceps'],
  [/fondos?\s*(de\s*)?pecho/i, 'Pecho'],
];

const GENERAL = [
  [/\b(pierna|piernas|pata|patas|legs?)\b|sentadill|squat|hack|prensa|femoral|isquio|cuadric|quad|glute|bulgar|zancad|lunge|gemel|pantorril|abduct|aduct|hip\s*thrust|puente\s*gluteo|sissy|nordic|step\s*up|soleo|tibial/i, 'Piernas'],
  [/\b(espalda|back|dorsal|dorsales|trapecio|trapecios)\b|remo|row|lat\s*pull|pullover|deadlift|peso\s*muerto|t-?bar|seal\s*row/i, 'Espalda'],
  [/\b(pecho|pechos|pectoral|pectorales|chest)\b|press\s*banc|banca|bench|apertur|flys?|flyes?|cruce\s*polea|contractor|pec\s*deck|flexion(es)?|push\s*ups?/i, 'Pecho'],
  [/\b(hombro|hombros|deltoid|deltoides|shoulder|shoulders)\b|militar|overhead|ohp|lateral(es)?|frontal(es)?|pajaro|pajaros|face\s*pull|arnold|encogimi|ypraise|y-?raise|w-?raise/i, 'Hombros'],
  [/\b(biceps?|brazo|brazos|arms?)\b|curl|martillo|predicador|scott|braquial/i, 'Bíceps'],
  [/\b(triceps?)\b|copa|frances|francés|pushdown|patada\s*tricep|rompecraneos/i, 'Tríceps'],
  [/\b(core|abs?|abdomen|abdominal|abdominales)\b|plancha|plank|crunch|rueda\s*abdom|oblicuo|hollow|dragon\s*flag|twist\s*rus|hipopresiv/i, 'Core'],
  [/\b(cardio|aerobico)\b|cinta|treadmill|bici|biciclet|bike|correr|running?|eliptic|ergometro|stair|escalador|salto\s*cuerda|comba|burpee|hiit/i, 'Cardio'],
];

/* El grupo que más se repite entre los ejercicios que coinciden con la búsqueda. */
function predominantGroup(candidateGroups) {
  const counts = {};
  for (const g of candidateGroups) {
    if (GRUPOS.includes(g)) counts[g] = (counts[g] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

/**
 * Grupo para un ejercicio nuevo. Gana el filtro de grupo que el atleta tiene puesto;
 * luego el nombre; luego lo que predomina entre los ejercicios parecidos; si no, «Otro».
 */
export function inferMuscleGroup(name, activeFilter = '', candidateGroups = []) {
  if (activeFilter && activeFilter !== FILTRO_HOY && GRUPOS.includes(activeFilter)) return activeFilter;
  const q = fold(name).trim();
  if (!q) return 'Otro';
  for (const [re, grupo] of [...SPECIFIC, ...GENERAL]) {
    if (re.test(q)) return grupo;
  }
  return (Array.isArray(candidateGroups) && predominantGroup(candidateGroups)) || 'Otro';
}
