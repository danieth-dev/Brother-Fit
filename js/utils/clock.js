/* Un solo reloj. La app usa la hora real. La página de pruebas puede adelantarla. */
let clock = () => Date.now();

export function now() {
  return clock();
}

export function setNow(fn) {
  clock = typeof fn === 'function' ? fn : () => Date.now();
}
