/* Esfuerzo de la serie. La pantalla y Fit pasan por aquí.
 * Se guarda rpe = 10 - rir. Un rir de 4 o más queda en 4, o sea rpe 6: es un piso, no un punto medio. */
import { db } from '../db.js';
import { now } from '../utils/clock.js';

export const PENDING_KEY = 'pendingRpe';
export const SEQ_KEY = 'rpeSeq';

const GUARD_MS = 8000;
let lastCall = null;

export const AVISO_DUPLICADA = 'Esa serie ya estaba anotada. Para añadirle el esfuerzo, usa «Falta esfuerzo» en la serie.';
export const AVISO_SIN_ESFUERZO = 'Serie guardada. Falta esfuerzo.';

export function resetRegisterGuard() {
  lastCall = null;
}

export function classifyRir(value) {
  if (value == null || value === '') return 'absent';
  if (typeof value === 'boolean') return 'invalid';
  if (typeof value === 'string' && value.trim() === '') return 'absent';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n) || n < 0) return 'invalid';
  return 'ok';
}

export function rpeFromRir(n) {
  const rir = n >= 4 ? 4 : n;
  return 10 - rir;
}

export function effortPhrase(rpe) {
  const n = Number(rpe);
  if (n === 10) return 'ninguna más';
  if (n === 9) return 'sobraba 1';
  if (n === 8) return 'sobraban 2';
  if (n === 7) return 'sobraban 3';
  if (n === 6) return '4 o más';
  return `RPE ${n}`;
}

export function needsEffortMark(set) {
  return set?.tipo === 'trabajo' && (set.rpe == null || set.rpe === '');
}

export async function loadPending() {
  const row = await db.get('meta', PENDING_KEY);
  if (!row?.value) return null;
  if (row.value.until <= now()) {
    await db.remove('meta', PENDING_KEY);
    return null;
  }
  return row.value;
}

function foldAnswer(value) {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[¿?¡!.,]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/* La app lee el 0. Fit no elige la serie ni tiene que llamar la herramienta. */
export function effortAnswerFromText(text) {
  const t = foldAnswer(text);
  if (!t) return null;
  if (/\b(repetici|reps?|kilos?|kg|lastre)\b/.test(t)) return null;
  if (/\b(hice|hcie|hecho)\s+[1-9]\d*\b/.test(t)) return null;
  if (/\b(no se|ni idea)\b/.test(t)) return { omitir: true };
  const bare = {
    '0': 0, cero: 0, ninguna: 0, nada: 0,
    '1': 1, una: 1, uno: 1,
    '2': 2, dos: 2,
    '3': 3, tres: 3,
    '4': 4, cuatro: 4,
  };
  if (Object.prototype.hasOwnProperty.call(bare, t)) return { rir: bare[t] };
  if (/^(4|cuatro)( o)? mas$/.test(t) || t === 'o mas') return { rir: 4 };
  const words = t.split(' ');
  if (words.length > 4) return null;
  if (words.includes('cero') || words.includes('ninguna') || words.includes('0')) return { rir: 0 };
  for (const word of words) {
    if (Object.prototype.hasOwnProperty.call(bare, word) && words.some((w) => w === 'hice' || w === 'hcie' || w === 'fueron' || w === 'sobraba' || w === 'sobraban')) {
      return { rir: bare[word] };
    }
  }
  return null;
}

export async function captureSpokenEffort(text) {
  const answer = effortAnswerFromText(text);
  if (!answer) return null;
  const pending = await loadPending();
  if (!pending) return null;
  const res = await anotarRpe({ mark: pending.mark, rir: answer.rir, omitir: answer.omitir === true });
  if (!res?.ok || res.preguntar) return null;
  return res;
}

export function releasePending() {
  return db.remove('meta', PENDING_KEY);
}

/* Fit puede repetir la misma llamada en 8 s. La pantalla no usa este candado: dos series iguales siguen siendo dos. */
function sameCall(workoutId, exerciseId, peso, reps, t) {
  return lastCall
    && lastCall.workoutId === workoutId
    && lastCall.exerciseId === exerciseId
    && lastCall.peso === peso
    && lastCall.reps === reps
    && (t - lastCall.time) < GUARD_MS;
}

async function duplicateResponse(setId) {
  const row = await db.get('meta', PENDING_KEY);
  const pending = row?.value;
  if (pending && pending.setId === setId && pending.until > now()) {
    return {
      ok: true,
      duplicada: true,
      setId,
      preguntar: true,
      marca: pending.mark,
      mensaje: `La serie ya estaba anotada. Sigue la marca ${pending.mark}. No abras otra pregunta.`,
    };
  }
  return {
    ok: true,
    duplicada: true,
    setId,
    preguntar: false,
    mensaje: 'La serie ya estaba anotada. No preguntes.',
  };
}

/* restEnd es el fin del reloj, si hay. El plazo queda escrito en la pregunta y no se mueve al recargar.
 * Sin reloj: cinco minutos. Con reloj: el fin más un minuto, sea el descanso corto o largo.
 * abrirPregunta es de Fit. La pantalla guarda sin abrir pregunta: nadie preguntó en voz alta. */
export async function registerSet(input, { guard = false, abrirPregunta = true } = {}) {
  const t = now();
  const workoutId = input.workoutId;
  const exerciseId = input.exerciseId;
  const peso = Number(input.peso);
  const reps = Number(input.reps);
  const tipo = input.tipo === 'calentamiento' ? 'calentamiento' : 'trabajo';
  const kind = tipo === 'calentamiento' ? 'absent' : classifyRir(input.rir);
  const rpe = kind === 'ok' ? rpeFromRir(Number(input.rir)) : null;

  if (guard && sameCall(workoutId, exerciseId, peso, reps, t)) {
    const dup = await duplicateResponse(lastCall.setId);
    dup.aviso = AVISO_DUPLICADA;
    return dup;
  }

  const out = await db.mutate(['sets', 'meta'], (tx) => {
    const box = {};
    const meta = tx.objectStore('meta');
    const sets = tx.objectStore('sets');
    meta.delete(PENDING_KEY);
    const row = { workoutId, exerciseId, peso, reps, tipo, ts: t };
    if (rpe != null) row.rpe = rpe;
    const addReq = sets.add(row);
    addReq.onsuccess = () => {
      const setId = addReq.result;
      box.ok = true;
      box.setId = setId;
      box.duplicada = false;
      if (tipo === 'calentamiento') {
        box.preguntar = false;
        box.mensaje = 'Calentamiento guardado. Sin esfuerzo. No preguntes.';
        return;
      }
      if (rpe != null) {
        box.preguntar = false;
        box.mensaje = 'Serie guardada con esfuerzo. No preguntes.';
        return;
      }
      if (!abrirPregunta) {
        box.preguntar = false;
        box.aviso = AVISO_SIN_ESFUERZO;
        box.mensaje = 'Serie guardada sin esfuerzo. No preguntes.';
        return;
      }
      const seqReq = meta.get(SEQ_KEY);
      seqReq.onsuccess = () => {
        const seq = (Number(seqReq.result?.value) || 0) + 1;
        meta.put({ key: SEQ_KEY, value: seq });
        const until = input.restEnd ? input.restEnd + 60_000 : t + 5 * 60_000;
        meta.put({
          key: PENDING_KEY,
          value: { setId, mark: seq, attempts: 0, until },
        });
        box.preguntar = true;
        box.marca = seq;
        box.mensaje = `Pregunta exactamente: ¿Cuántas repeticiones más podrías haber hecho? Marca ${seq}. 0 es no salía otra. 4 es cuatro o más. Cuando responda, llama anotar_rpe con esa marca, también si es 0 o si está descansando. No escribas comentarios.`;
      };
    };
    return box;
  });

  if (out?.setId) {
    lastCall = { workoutId, exerciseId, peso, reps, time: t, setId: out.setId };
  }
  return out;
}

/* Orden fijo: no hay pregunta, plazo, marca, la serie existe, es de trabajo y sigue sin esfuerzo, y recién ahí el rir.
 * Una marca vieja no gasta intento. El plazo vencido gana aunque la marca también esté mal. */
export function anotarRpe({ rir, mark, omitir = false } = {}) {
  return db.mutate(['sets', 'meta'], (tx) => {
    const box = { ok: true };
    const meta = tx.objectStore('meta');
    const sets = tx.objectStore('sets');
    const pReq = meta.get(PENDING_KEY);
    pReq.onsuccess = () => {
      const pending = pReq.result?.value;
      if (!pending) {
        box.preguntar = false;
        box.mensaje = 'No hay pregunta abierta para esa marca. No preguntes.';
        return;
      }
      if (pending.until <= now()) {
        meta.delete(PENDING_KEY);
        box.preguntar = false;
        box.mensaje = 'El plazo venció y no se anotó. No preguntes otra vez.';
        return;
      }
      if (Number(mark) !== pending.mark) {
        box.preguntar = true;
        box.marca = pending.mark;
        box.mensaje = `No anotado. La pregunta vigente es ${pending.mark}. Pregunta de nuevo al atleta y no reutilices la respuesta anterior.`;
        return;
      }
      const sReq = sets.get(pending.setId);
      sReq.onsuccess = () => {
        const set = sReq.result;
        if (!set) {
          meta.delete(PENDING_KEY);
          box.preguntar = false;
          box.mensaje = 'Esa serie no está. No preguntes otra vez.';
          return;
        }
        if (set.tipo === 'calentamiento') {
          meta.delete(PENDING_KEY);
          box.preguntar = false;
          box.mensaje = 'Es un calentamiento. Sin esfuerzo. No preguntes otra vez.';
          return;
        }
        if (set.rpe != null && set.rpe !== '') {
          meta.delete(PENDING_KEY);
          box.preguntar = false;
          box.mensaje = 'No se modificó. No preguntes otra vez.';
          return;
        }
        if (omitir) {
          meta.delete(PENDING_KEY);
          box.preguntar = false;
          box.mensaje = 'El atleta no lo sabe. La serie queda sin esfuerzo. No preguntes otra vez.';
          return;
        }
        const kind = classifyRir(rir);
        if (kind !== 'ok') {
          const attempts = (pending.attempts || 0) + 1;
          if (attempts >= 2) {
            meta.delete(PENDING_KEY);
            box.preguntar = false;
            box.mensaje = 'La serie queda sin esfuerzo. No preguntes otra vez.';
            return;
          }
          meta.put({ key: PENDING_KEY, value: { ...pending, attempts } });
          box.preguntar = true;
          box.marca = pending.mark;
          box.mensaje = `No anotado. Queda un intento. Marca ${pending.mark}. Pregunta de nuevo al atleta y no reutilices la respuesta anterior.`;
          return;
        }
        set.rpe = rpeFromRir(Number(rir));
        sets.put(set);
        meta.delete(PENDING_KEY);
        box.preguntar = false;
        box.mensaje = 'Esfuerzo guardado. No preguntes otra vez.';
      };
    };
    return box;
  });
}

/* Los botones de la pantalla sí pueden corregir un esfuerzo ya guardado. Fit no. */
export function setEffort(setId, rir) {
  const kind = classifyRir(rir);
  const rpe = kind === 'ok' ? rpeFromRir(Number(rir)) : null;
  return db.mutate(['sets', 'meta'], (tx) => {
    const box = {};
    const sets = tx.objectStore('sets');
    const meta = tx.objectStore('meta');
    const req = sets.get(Number(setId));
    req.onsuccess = () => {
      const set = req.result;
      if (!set || set.tipo === 'calentamiento' || rpe == null) {
        box.ok = false;
        return;
      }
      set.rpe = rpe;
      sets.put(set);
      const pReq = meta.get(PENDING_KEY);
      pReq.onsuccess = () => {
        const pending = pReq.result?.value;
        if (pending && pending.setId === set.id) meta.delete(PENDING_KEY);
        box.ok = true;
        box.rpe = rpe;
      };
    };
    return box;
  });
}

export function setTipo(setId, tipo) {
  const next = tipo === 'calentamiento' ? 'calentamiento' : 'trabajo';
  return db.mutate(['sets', 'meta'], (tx) => {
    const sets = tx.objectStore('sets');
    const meta = tx.objectStore('meta');
    const req = sets.get(Number(setId));
    req.onsuccess = () => {
      const set = req.result;
      if (!set) return;
      set.tipo = next;
      sets.put(set);
      if (next !== 'calentamiento') return;
      const pReq = meta.get(PENDING_KEY);
      pReq.onsuccess = () => {
        const pending = pReq.result?.value;
        if (pending && pending.setId === set.id) meta.delete(PENDING_KEY);
      };
    };
  });
}

export function removeLoggedSet(id) {
  const setId = Number(id);
  return db.mutate(['sets', 'meta'], (tx) => {
    tx.objectStore('sets').delete(setId);
    const pReq = tx.objectStore('meta').get(PENDING_KEY);
    pReq.onsuccess = () => {
      const pending = pReq.result?.value;
      if (pending && pending.setId === setId) tx.objectStore('meta').delete(PENDING_KEY);
    };
  });
}

/* Saltar el descanso es el único caso que reescribe el plazo: ahora más un minuto, en la misma operación que apaga el reloj. */
export function skipRestClock() {
  return db.mutate(['meta'], (tx) => {
    const meta = tx.objectStore('meta');
    meta.delete('activeRest');
    const pReq = meta.get(PENDING_KEY);
    pReq.onsuccess = () => {
      const pending = pReq.result?.value;
      if (!pending) return;
      meta.put({ key: PENDING_KEY, value: { ...pending, until: now() + 60_000 } });
    };
  });
}
