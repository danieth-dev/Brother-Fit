/* Ejecuta las herramientas que pide el modelo contra los datos reales del teléfono.
 * Cada herramienta devuelve un objeto que el modelo lee; nunca toca el DOM.
 * Para que Entreno se entere de un cambio, se emite un aviso (utils/events.js). */

import { state } from '../../store.js';
import { queryWorkoutHistoryForFit } from './context.js';
import { deleteMemory, loadAllMemories, saveAthleteProfile, saveMemory } from './memory.js';
import { addBodyWeight, latestWeight } from '../body.js';
import { DOSE_G, clearIntakesOn, creatineForFit, intakesForDate, logIntake } from '../creatine.js';
import { anotarRpe, registerSet } from '../effort.js';
import { deleteMeal, getMealsHistoryForFit, listMealsByDate, saveMeal, todayMealsSummary } from '../meals.js';
import { finishWorkout, finishWorkoutSummary, getActiveWorkout, lastSessionSetsFor, lastSetFor, listExercises, matchExercise, prByExercise, progressForExercise, saveActiveRest, shiftActiveRest, startWorkout } from '../workouts.js';
import { restSeconds, effortBonus } from '../session-plan.js';
import { now } from '../../utils/clock.js';
import { todayISO } from '../../utils/dates.js';
import { EVENTS, emit } from '../../utils/events.js';
import { toKg } from '../../utils/units.js';
import { isBodyweight, loadWords } from '../bodyweight.js';
import { amountWords, isTimed, MAX_SEGUNDOS } from '../timed.js';

/* El esfuerzo dicho en voz: un entero desde 0, o null si no lo dijo o no se entiende. */
function spokenRir(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

async function resolveSpokenExercise(spoken) {
  const found = matchExercise(spoken, await listExercises());
  if (found.status === 'none') {
    return { ok: false, preguntar: false, mensaje: 'Ese ejercicio no está en la lista. Dilo y no lo anotes en otro.' };
  }
  if (found.status === 'many') {
    const nombres = found.exercises.map((e) => e.nombre).join(', ');
    return { ok: false, preguntar: false, mensaje: `No anotado. Hay varios: ${nombres}. Pregunta cuál, una sola vez.` };
  }
  const ex = found.exercise;
  state.activeExercise = { id: ex.id, nombre: ex.nombre, grupo: ex.grupo };
  emit(EVENTS.EXERCISE_SELECTED, { id: ex.id });
  return { ok: true, exercise: ex };
}

export async function executeToolCall(name, args) {
  if (name === 'registrar_serie') {
    let active = await getActiveWorkout();
    let autoStarted = false;
    if (!active) {
      active = await startWorkout();
      autoStarted = true;
    }

    const spoken = String(args.ejercicio || '').trim();
    let ex = null;
    if (spoken) {
      const resolved = await resolveSpokenExercise(spoken);
      if (!resolved.ok) return resolved;
      ex = resolved.exercise;
    } else if (state.activeExercise?.id) {
      ex = state.activeExercise;
    } else {
      return { error: 'Dime qué ejercicio estás haciendo para anotar la serie.' };
    }

    /* En un ejercicio por tiempo se anotan segundos («plancha 45 segundos») y reps queda en 0. */
    const timed = isTimed((await listExercises()).find((e) => e.id === ex.id) || ex);
    let reps = Math.round(Number(args.reps));
    let segundos = null;
    if (timed) {
      segundos = Math.round(Number(args.segundos ?? args.reps));
      if (!Number.isFinite(segundos) || segundos < 1 || segundos > MAX_SEGUNDOS) {
        return { error: 'Tiempo no válido o no indicado por el atleta. Pregunta cuántos segundos aguantó.' };
      }
      reps = 0;
    } else if (!Number.isFinite(reps) || reps < 1 || reps > 100) {
      return { error: 'Número de repeticiones no válido o no indicado por el atleta.' };
    }

    let peso = null;
    const said = Number(args.peso);
    const saidKg = Number.isFinite(said) ? toKg(said) : NaN;
    const hasAdded = Number.isFinite(saidKg) && saidKg > 0 && saidKg <= 600;
    if (args.corporal === true) {
      peso = hasAdded ? saidKg : 0;
    } else if (args.peso != null && Number.isFinite(saidKg) && saidKg >= 0 && saidKg <= 600) {
      peso = saidKg;
    } else {
      const last = await lastSetFor(ex.id);
      peso = last?.peso ?? 0;
    }

    state.activeExercise = { id: ex.id, nombre: ex.nombre, grupo: ex.grupo };
    emit(EVENTS.EXERCISE_SELECTED, { id: ex.id });

    const tipo = args.tipo === 'calentamiento' ? 'calentamiento' : 'trabajo';
    const rir = spokenRir(args.rir);
    const restEnd = now() + restSeconds(reps, state.settings, { rir, tipo, timed }) * 1000;
    const res = await registerSet({
      workoutId: active.id,
      exerciseId: ex.id,
      peso,
      reps,
      segundos,
      tipo: args.tipo,
      rir: args.rir,
      restEnd,
    }, { guard: true });
    if (res) {
      res.ejercicio = ex.nombre;
      res.sesionIniciadaAutomaticamente = autoStarted;
    }
    if (!res?.duplicada) {
      await saveActiveRest(restEnd, segundos ?? reps, { rir: tipo === 'trabajo' ? rir : null, tipo, timed });
      emit(EVENTS.SET_LOGGED, { restEnd, lastReps: segundos ?? reps });
    }
    return res;
  }
  if (name === 'usar_ejercicio') {
    const spoken = String(args.ejercicio || '').trim();
    if (!spoken) return { ok: false, preguntar: false, mensaje: 'Falta el nombre. Pregunta cuál, una sola vez.' };
    const resolved = await resolveSpokenExercise(spoken);
    if (!resolved.ok) return resolved;
    return {
      ok: true,
      preguntar: false,
      ejercicio: resolved.exercise.nombre,
      exercise: resolved.exercise,
      mensaje: `Entreno quedó en ${resolved.exercise.nombre}. No lo confirmes otra vez. Espera la serie.`,
    };
  }
  if (name === 'anotar_rpe') {
    const res = await anotarRpe({ rir: args.rir, mark: args.marca, omitir: args.omitir === true });
    // El esfuerzo llegó con el descanso ya corriendo: si fue al fallo o casi, se alarga.
    const bonus = effortBonus(res?.rir);
    if (bonus && state.settings.descansoMode === 'auto') await shiftActiveRest(bonus * 1000, { rir: res.rir });
    return res;
  }
  if (name === 'consultar_creatina') {
    return creatineForFit();
  }
  if (name === 'registrar_creatina') {
    const isUndo = /deshac|borr|quit|cancel/i.test(String(args.accion || ''));
    const fecha = todayISO();
    if (isUndo) {
      await clearIntakesOn(fecha);
      const status = await creatineForFit();
      return {
        ok: true,
        accion: 'deshacer',
        gramos: 0,
        ...status,
        mensaje: 'Toma de creatina de hoy desmarcada.',
      };
    }
    const gramos = Number(args.gramos) > 0 ? Number(args.gramos) : DOSE_G;
    const existing = await intakesForDate(fecha);
    if (!existing.length) {
      await logIntake({ cantidad: gramos, fecha });
    }
    const status = await creatineForFit();
    return {
      ok: true,
      accion: 'registrar',
      yaEstaba: existing.length > 0,
      gramos,
      ...status,
      mensaje: existing.length
        ? `La toma de creatina de hoy (${gramos} g) ya estaba registrada. Racha: ${status.rachaDias} días.`
        : `Creatina de hoy registrada (${gramos} g). Racha: ${status.rachaDias} días (${status.porcentajeSaturacion}% saturación).`,
    };
  }
  if (name === 'registrar_peso_corporal') {
    const rawPeso = Number(args.peso);
    const pesoKg = Math.round(toKg(rawPeso) * 10) / 10;
    if (!Number.isFinite(pesoKg) || pesoKg < 20 || pesoKg > 300) {
      return { ok: false, error: 'Peso corporal fuera de rango válido.' };
    }
    const prev = await latestWeight();
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(String(args.fecha || '').trim())
      ? String(args.fecha).trim()
      : todayISO();
    const id = await addBodyWeight({ fecha, peso: pesoKg });
    await saveAthleteProfile({ peso: `${pesoKg} kg` });
    const delta = prev ? Math.round((pesoKg - Number(prev.peso)) * 10) / 10 : null;
    const deltaStr = delta != null && delta !== 0
      ? ` (${delta > 0 ? '+' : ''}${delta} kg respecto a los ${prev.peso} kg del ${prev.fecha})`
      : '';
    return {
      ok: true,
      id,
      fecha,
      pesoKg,
      pesoAnteriorKg: prev?.peso ?? null,
      diferenciaKg: delta,
      mensaje: `Peso corporal de ${pesoKg} kg registrado en Progreso para el ${fecha}${deltaStr}.`,
    };
  }
  if (name === 'gestionar_entrenamiento') {
    const isFinish = /finaliz|termin|cerr|acab/i.test(String(args.accion || ''));
    if (isFinish) {
      const active = await getActiveWorkout();
      if (!active) {
        return { ok: false, mensaje: 'No hay ningún entrenamiento activo en este momento para finalizar.' };
      }
      const summary = await finishWorkoutSummary(active.id);
      const duracionMin = Math.max(1, Math.round((now() - active.startedAt) / 60000));
      await finishWorkout(active.id);
      const mealsToday = await todayMealsSummary();
      const protFalta = Math.max(0, mealsToday.targets.proteina - mealsToday.totals.proteina);
      return {
        ok: true,
        accion: 'finalizar',
        duracionMin,
        totalSeries: summary.totalSets,
        volumenTotal: summary.volumenTotal,
        detalles: summary.detalles,
        proteinaRestanteHoy: protFalta,
        kcalRestantesHoy: mealsToday.remainingKcal,
        mensaje: `Entrenamiento finalizado: ${duracionMin} min, ${summary.totalSets} series y ${summary.volumenTotal} kg de volumen (${summary.detalles || 'sin series'}). Te faltan ${protFalta} g de proteína hoy.`,
      };
    }
    const existing = await getActiveWorkout();
    if (existing) {
      return {
        ok: true,
        accion: 'iniciar',
        yaActivo: true,
        workoutId: existing.id,
        fecha: existing.fecha,
        mensaje: 'Ya tienes una sesión de entrenamiento activa en curso.',
      };
    }
    const w = await startWorkout();
    return {
      ok: true,
      accion: 'iniciar',
      yaActivo: false,
      workoutId: w.id,
      fecha: w.fecha,
      mensaje: 'Sesión de entrenamiento iniciada. Dime qué ejercicio vamos a hacer.',
    };
  }
  if (name === 'consultar_progreso_ejercicio') {
    const q = String(args.ejercicio || '').trim();
    if (!q) return { ok: false, mensaje: 'Indica el nombre del ejercicio a consultar.' };
    const found = matchExercise(q, await listExercises());
    if (found.status === 'none') {
      return { ok: false, mensaje: `No encontré el ejercicio "${q}" en el catálogo.` };
    }
    if (found.status === 'many') {
      const nombres = found.exercises.map((e) => e.nombre).join(', ');
      return { ok: false, mensaje: `Hay varios ejercicios que coinciden: ${nombres}. ¿Cuál de ellos quieres consultar?` };
    }
    const ex = found.exercise;
    const [pr, lastSess, prog] = await Promise.all([
      prByExercise(ex.id),
      lastSessionSetsFor(ex.id),
      progressForExercise(ex.id),
    ]);
    if (!prog.sessions.length) {
      return {
        ok: true,
        ejercicio: ex.nombre,
        grupo: ex.grupo,
        sinRegistros: true,
        mensaje: `Aún no tienes series históricas registradas en ${ex.nombre}.`,
      };
    }
    const ultimaSesion = lastSess
      ? {
          fecha: lastSess.workout.fecha,
          series: lastSess.sets.map((s) => `${loadWords(s.peso, isBodyweight(ex))} × ${amountWords(s)}${s.segundos != null ? '' : ' reps'}${s.rpe != null && s.rpe !== '' ? ` (RIR ${Math.max(0, 10 - Number(s.rpe))})` : ''}`),
        }
      : null;
    const ultimasFechas = prog.sessions.slice(-5).map((d) => ({
      fecha: d.fecha,
      pesoMaximoKg: d.maxPeso,
      e1rmKg: Math.round(d.e1rm * 10) / 10,
      volumenKg: Math.round(d.volumen),
      series: d.series,
    }));
    return {
      ok: true,
      ejercicio: ex.nombre,
      grupo: ex.grupo,
      recordHistorico: {
        pesoMaximoKg: pr.maxPeso,
        repsMaximas: pr.maxReps,
        e1rmEstimadoKg: Math.round(pr.e1rmMax * 10) / 10,
      },
      ultimaSesion,
      totalSesionesRegistradas: prog.sessions.length,
      ultimas5Sesiones: ultimasFechas,
      mensaje: `En ${ex.nombre}: PR histórico de ${pr.maxPeso} kg (1RM est. ${Math.round(pr.e1rmMax)} kg). ${
        ultimaSesion ? `Última vez (${ultimaSesion.fecha}): ${ultimaSesion.series.join(', ')}.` : ''
      }`,
    };
  }
  if (name === 'consultar_entrenamientos') {
    return queryWorkoutHistoryForFit(args.dia);
  }
  if (name === 'consultar_comidas') {
    return {
      ok: true,
      ...(await getMealsHistoryForFit(args.periodo || 'hoy')),
    };
  }
  if (name === 'registrar_comida') {
    const id = await saveMeal({
      nombre: args.plato || 'Comida registrada por Bía',
      tipo: args.tipo,
      kcal: Number(args.kcal) || 0,
      proteina: Number(args.proteina) || 0,
      carbos: Number(args.carbos) || 0,
      grasa: Number(args.grasa) || 0,
      origen: 'voz',
    });
    const s = await todayMealsSummary();
    const protFalta = Math.max(0, s.targets.proteina - s.totals.proteina);
    return {
      ok: true,
      id,
      mensaje: `Listo: ${args.kcal} kcal registradas (${args.plato}). Hoy llevas ${s.totals.kcal} de ${s.targets.kcal} kcal; te quedan ${s.remainingKcal} kcal y ${protFalta} g de proteína.`,
    };
  }
  if (name === 'corregir_comida') {
    const meals = await listMealsByDate();
    if (!meals.length) {
      return { ok: false, mensaje: 'No hay comidas registradas hoy para modificar.' };
    }
    const target = args.id ? meals.find((m) => m.id === Number(args.id)) : meals[meals.length - 1];
    if (!target) {
      return { ok: false, mensaje: 'No encontré esa comida en el registro de hoy.' };
    }
    if (args.borrar) {
      await deleteMeal(target.id);
      const s = await todayMealsSummary();
      return {
        ok: true,
        mensaje: `Comida "${target.nombre}" eliminada. Hoy quedas en ${s.totals.kcal} kcal y ${s.totals.proteina} g de proteína.`,
      };
    }
    await saveMeal({
      ...target,
      id: target.id,
      items: [],
      nombre: args.plato || target.nombre,
      kcal: args.kcal != null ? Number(args.kcal) : target.kcal,
      proteina: args.proteina != null ? Number(args.proteina) : target.proteina,
      carbos: args.carbos != null ? Number(args.carbos) : target.carbos,
      grasa: args.grasa != null ? Number(args.grasa) : target.grasa,
    });
    const s = await todayMealsSummary();
    return {
      ok: true,
      id: target.id,
      mensaje: `Comida actualizada a "${args.plato || target.nombre}" (${args.kcal ?? target.kcal} kcal). Hoy llevas ${s.totals.kcal} kcal y ${s.totals.proteina} g de proteína.`,
    };
  }
  if (name === 'guardar_recuerdo') {
    const raw = (args.contenido || '').trim();
    if (!raw) return { error: 'Contenido vacío.' };

    // Conservar siempre molestias físicas, lesiones, técnica/cues, agarre o metas
    const isSubjectiveOrGoal = /\b(duele|dolor|molestia|lesi[oó]n|molestias|hombro|rodilla|espalda|codo|cuello|agarre|codos|postura|t[eé]cnica|cue|forma|meta|objetivo|aspiraci[oó]n|apunto|llegar a)\b/i.test(raw);

    // Solo descartar si tiene forma explícita de serie de entrenamiento (kilos + repeticiones juntos como registro de carga)
    const isSetLogPattern = /\b\d+\s*(?:kg|kilos?|lb|libras?)\s*(?:[x×y]|por|,)?\s*\d+\s*(?:reps?|repeticiones)?\b/i.test(raw) ||
                            /\b(?:serie\s*\d+|hice|anot[aá]me?)\b.*?\b\d+\s*reps?\b/i.test(raw);

    if (isSetLogPattern && !isSubjectiveOrGoal) {
      return { ok: true, mensaje: 'Las marcas de series y peso se gestionan automáticamente en el cuaderno local.' };
    }
    const id = await saveMemory(raw);
    return { ok: true, id, mensaje: `Preferencia o nota técnica guardada con ID ${id}.` };
  }
  if (name === 'listar_recuerdos') {
    const mems = await loadAllMemories();
    return { recuerdos: mems };
  }
  if (name === 'borrar_recuerdo') {
    await deleteMemory(args.id);
    return { ok: true, mensaje: `Recuerdo ${args.id} eliminado.` };
  }
  return { error: 'Herramienta desconocida.' };
}
