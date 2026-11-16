/* Tarjetas que Bía deja en el chat cuando usa una herramienta: recuerdo guardado (con
 * «Deshacer»), comida, peso, creatina, entreno y ejercicio elegido. Devuelven nodos; no escuchan. */
import { muscleName } from '../../services/workouts.js';
import { icons } from '../../utils/icons.js';
import { esc } from '../../utils/dom.js';

/* Qué tarjeta deja cada herramienta. Las que no están aquí no dejan ninguna. */
const TOOL_CARDS = {
  guardar_recuerdo: (args, result) => ({
    tag: 'Guardado en recuerdos',
    text: args?.contenido || 'Preferencia guardada',
    undoId: result?.id,
    always: true,
  }),
  registrar_comida: (args, result) => ({ tag: 'Guardado en diario de comidas', text: mealDetail(result) }),
  corregir_comida: (args, result) => ({ tag: 'Diario de comidas actualizado', text: mealDetail(result) }),
  registrar_peso_corporal: (args, result) => ({
    tag: 'Guardado en Peso corporal',
    text: result.mensaje || `${result.pesoKg} kg (${result.fecha})`,
  }),
  registrar_creatina: (args, result) => ({ tag: 'Registro de creatina', text: result.mensaje || 'Creatina actualizada' }),
  gestionar_entrenamiento: (args, result) => ({
    tag: result.accion === 'finalizar' ? 'Entrenamiento finalizado' : 'Entrenamiento iniciado',
    text: result.mensaje || '',
  }),
};

function mealDetail(result) {
  const c = result.comida;
  return c ? `${c.tipo.toUpperCase()} · ${c.nombre} (${c.kcal} kcal · ${c.proteina}g P)` : (result.mensaje || 'Registro actualizado');
}

/** Tarjeta de una herramienta, o null si esa herramienta no deja tarjeta o falló. */
export function toolCard(toolName, args, result) {
  const build = TOOL_CARDS[toolName];
  if (!build) return null;
  const card = build(args, result || {});
  if (!card.always && !result?.ok) return null;
  const node = document.createElement('div');
  node.className = 'agent-card-memory';
  node.innerHTML = `
    <div class="agent-card-memory-icon">${icons.check({ size: 18, cls: 'icon-ok' })}</div>
    <div class="agent-card-memory-body">
      <span class="agent-card-memory-tag">${esc(card.tag)}</span>
      <span class="agent-card-memory-text">${esc(card.text)}</span>
    </div>
    ${card.undoId ? `<button class="agent-card-memory-undo" data-id="${card.undoId}" type="button">Deshacer</button>` : ''}`;
  return node;
}

/** Ejercicio que Bía eligió, con el botón para ir a anotar la primera serie. */
export function exerciseCard(ex) {
  const grupo = muscleName(ex.grupo) || ex.grupo || 'General';
  const node = document.createElement('div');
  node.className = 'agent-card-exercise';
  node.innerHTML = `
    <div>
      <p class="agent-card-exercise-head">
        <span class="agent-card-exercise-dot muscle-dot" data-g="${esc(grupo)}"></span>
        ${esc(ex.nombre)}
      </p>
      <p class="agent-card-exercise-sub">${esc(grupo)} · listo para la serie 1</p>
    </div>
    <button class="agent-card-exercise-btn" data-action="go-exercise" data-exercise-id="${ex.id}" data-nombre="${esc(ex.nombre)}" data-grupo="${esc(ex.grupo || '')}" type="button">
      Registrar serie 1
    </button>`;
  return node;
}
