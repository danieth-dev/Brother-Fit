/* Pesos en IndexedDB siempre en kg. La unidad de pantalla solo convierte al mostrar o al escribir. */
import { state } from '../store.js';

export const fmtNum = (n) => {
  const num = typeof n === 'number' ? n : parseFloat(String(n ?? '').replace(',', '.'));
  if (!Number.isFinite(num)) return String(n ?? '');
  // Coma decimal, como se escribe en español: «17,5». Los campos la leen con num().
  return Number.isInteger(num) ? String(num) : num.toFixed(1).replace(/\.0$/, '').replace('.', ',');
};

export const LB_PER_KG = 2.2046226218;

export function weightUnit() {
  return state.settings?.unidad === 'lb' ? 'lb' : 'kg';
}

export function toKg(value, unit = weightUnit()) {
  const n = Number(value);
  if (!Number.isFinite(n)) return NaN;
  return unit === 'lb' ? n / LB_PER_KG : n;
}

export function fromKg(kg, unit = weightUnit()) {
  const n = Number(kg);
  if (!Number.isFinite(n)) return NaN;
  return unit === 'lb' ? n * LB_PER_KG : n;
}

/** Peso guardado (kg) → texto en la unidad de pantalla. */
export function fmtWeight(kg, unit = weightUnit()) {
  const v = fromKg(kg, unit);
  if (!Number.isFinite(v)) return '';
  if (unit === 'lb') return fmtNum(Math.round(v * 10) / 10);
  return fmtNum(Math.round(v * 100) / 100);
}

/** Volumen en kg·reps → texto en la unidad de pantalla. */
export function fmtVolume(volKg, unit = weightUnit()) {
  const v = fromKg(volKg, unit);
  if (!Number.isFinite(v)) return '';
  return fmtNum(Math.round(v));
}
