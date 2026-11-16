/* Avisos entre capas. Un servicio anuncia lo que pasó («se eligió un ejercicio», «se anotó
 * una serie») y la vista que esté escuchando reacciona. Así el servicio no toca el DOM
 * ni sabe qué pantalla está abierta. Es una utilidad pura: no usa document ni window. */

const bus = new EventTarget();

export const EVENTS = {
  /** detail: { id } — Entreno debe pasar a ese ejercicio. */
  EXERCISE_SELECTED: 'exercise-selected',
  /** detail: { restEnd, lastReps } — empezó un descanso por una serie anotada fuera de la pantalla. */
  SET_LOGGED: 'set-logged',
};

export function emit(type, detail) {
  bus.dispatchEvent(new CustomEvent(type, { detail }));
}

/** Escucha un aviso. Devuelve la función para dejar de escuchar. */
export function on(type, handler) {
  const listener = (e) => handler(e.detail);
  bus.addEventListener(type, listener);
  return () => bus.removeEventListener(type, listener);
}
