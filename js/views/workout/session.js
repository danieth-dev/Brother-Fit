/* Estado de la pantalla Entreno que sobrevive entre repintados: ejercicio elegido, descanso,
 * borrador de la serie y rutina. Solo lo usan los archivos de js/views/workout*. */
import { state } from '../../store.js';
import { on, EVENTS } from '../../utils/events.js';

export const session = {
  selectedEx: null,
  restEnd: 0,
  lastReps: 0,
  /* Esfuerzo de la última serie: explica un descanso alargado. */
  lastRir: null,
  lastTipo: 'trabajo',
  lastTimed: false,
  /* Inicio del cronómetro de una serie por tiempo; 0 si no corre. */
  stopwatchStart: 0,
  draftTipo: 'trabajo',
  draftRir: null,
  openEffortId: null,
  todayLogOpen: false,
  /* Id del siguiente ejercicio de la rutina, ROUTINE_DONE o null. */
  pendingNextEx: null,
  /* Lo que muestra el aviso de descanso de una rutina. */
  nextExObj: null,
  isExCompleted: false,
  /* Todos los ejercicios de la rutina tienen sus series: el descanso ofrece terminar. */
  routineDone: false,
  curExName: '',
  lastConfiguredSetKey: '',
  /* Una serie se está guardando: frena el doble toque. */
  saving: false,
};

/* Bía puede anotar una serie o elegir ejercicio desde su pantalla: Entreno lo recoge al volver. */
on(EVENTS.SET_LOGGED, (detail) => {
  if (!detail?.restEnd) return;
  session.restEnd = detail.restEnd;
  if (detail.lastReps) session.lastReps = detail.lastReps;
});

/* La hoja del descanso puede alargarlo o acortarlo; el reloj de Entreno sigue ese fin. */
on(EVENTS.REST_CHANGED, (detail) => {
  session.restEnd = detail?.restEnd || 0;
  if (detail?.lastReps) session.lastReps = detail.lastReps;
  if (detail?.lastReps || detail?.rir != null) session.lastRir = detail.rir ?? null;
  if (detail?.tipo) session.lastTipo = detail.tipo;
  if (detail?.lastReps) session.lastTimed = Boolean(detail.timed);
});

on(EVENTS.EXERCISE_SELECTED, (detail) => {
  const id = Number(detail?.id);
  if (!id) return;
  session.selectedEx = id;
  session.pendingNextEx = null;
});

export function setActiveExercise(ex) {
  state.activeExercise = ex ? { id: ex.id, nombre: ex.nombre, grupo: ex.grupo } : null;
}

/** Sin entreno en curso: se olvida el descanso y lo abierto. */
export function resetSession() {
  session.restEnd = 0;
  session.todayLogOpen = false;
}
