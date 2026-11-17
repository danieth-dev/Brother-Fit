/* Reglas de AGENTS.md convertidas en pruebas: leen el código y fallan si una se rompe.
 * Cuando un agente (o una persona) comete un error que se puede detectar leyendo archivos,
 * la corrección llega con su regla aquí, en vez de otra línea de instrucciones. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const rel = (abs) => relative(ROOT, abs).split(sep).join('/');

function walk(dir, ext) {
  const out = [];
  for (const name of readdirSync(join(ROOT, dir))) {
    const p = `${dir}/${name}`;
    if (statSync(join(ROOT, p)).isDirectory()) out.push(...walk(p, ext));
    else if (p.endsWith(ext)) out.push(p);
  }
  return out;
}

const JS = walk('js', '.js');
const CSS = walk('css', '.css');

/* Importaciones estáticas de un archivo, resueltas a rutas del repositorio («js/db.js»). */
function importsOf(file) {
  const src = read(file);
  const specs = [...src.matchAll(/(?:import|export)\s[^'"]*?from\s+'([^']+)'/g)].map((m) => m[1]);
  return specs.filter((s) => s.startsWith('.')).map((s) => rel(resolve(join(ROOT, dirname(file)), s)));
}

/* Quita comentarios para no confundir una explicación con código. */
const code = (file) => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/* Lista de problemas en un solo assert: el mensaje dice qué archivo y por qué. */
function expectNone(problems, rule) {
  assert.deepEqual(problems, [], `${rule}\n  ${problems.join('\n  ')}`);
}

const PURE_UTILS = ['dates', 'clock', 'units', 'events', 'text-match'].map((n) => `js/utils/${n}.js`);
const isView = (f) => f.startsWith('js/views/');
const isService = (f) => f.startsWith('js/services/');

test('capas: solo los servicios y store.js abren la base', () => {
  const allowed = (f) => isService(f) || f === 'js/store.js' || f === 'js/main.js';
  const bad = JS.filter((f) => !allowed(f) && importsOf(f).includes('js/db.js'));
  expectNone(bad, 'Una vista o pieza de interfaz importa db.js: pide los datos a un servicio.');
});

test('capas: un servicio no importa vistas, piezas de interfaz ni voz', () => {
  const bad = [];
  for (const f of JS.filter(isService)) {
    for (const dep of importsOf(f)) {
      const ui = dep.startsWith('js/views/') || dep.startsWith('js/voice/')
        || (dep.startsWith('js/utils/') && !PURE_UTILS.includes(dep));
      if (ui) bad.push(`${f} → ${dep}`);
    }
  }
  expectNone(bad, 'Dependencias en un solo sentido: vistas → interfaz y voz → servicios → db.');
});

test('capas: un servicio no toca el DOM', () => {
  const dom = /\b(document|window)\.|\.innerHTML\b|getContext\(|createObjectURL\(/;
  const bad = JS.filter(isService).filter((f) => dom.test(code(f)));
  expectNone(bad, 'Un servicio recibe y devuelve datos; para avisar a una pantalla usa emit().');
});

/* Excepción conocida: units.js lee la unidad elegida de store.js (SISTEMA.md → Deuda técnica). */
const PURE_EXCEPTIONS = new Set(['js/utils/units.js → js/store.js']);

test('capas: las utilidades puras no dependen de interfaz ni servicios', () => {
  const bad = [];
  for (const f of PURE_UTILS) {
    for (const dep of importsOf(f)) {
      if (!PURE_UTILS.includes(dep) && !PURE_EXCEPTIONS.has(`${f} → ${dep}`)) bad.push(`${f} → ${dep}`);
    }
    if (/\b(document|window)\./.test(code(f))) bad.push(`${f} usa el DOM`);
  }
  expectNone(bad, 'dates, clock, units, events y text-match deben poder usarse desde cualquier capa.');
});

test('capas: una vista no importa otra vista', () => {
  const bad = [];
  for (const f of JS.filter(isView)) {
    const screen = f.split('/')[2].replace(/\.js$/, '');
    for (const dep of importsOf(f).filter(isView)) {
      const depScreen = dep.split('/')[2].replace(/\.js$/, '');
      const ownPart = dep.startsWith(`js/views/${screen}/`) || depScreen === screen;
      if (!ownPart) bad.push(`${f} → ${dep}`);
    }
  }
  expectNone(bad, 'Lo que comparten dos pantallas va a js/utils/; las partes de una pantalla, a js/views/<pantalla>/.');
});

test('código: sin console.log ni console.debug', () => {
  const bad = [...JS, 'sw.js'].filter((f) => /console\.(log|debug)\(/.test(code(f)));
  expectNone(bad, 'Quita los console.log de depuración.');
});

test('estilo: sin colores hex fuera de tokens.css', () => {
  const bad = CSS.filter((f) => f !== 'css/tokens.css')
    .flatMap((f) => (read(f).match(/#[0-9a-fA-F]{3,8}\b/g) || []).map((hex) => `${f}: ${hex}`));
  expectNone(bad, 'Todo color sale de un token de css/tokens.css.');
});

test('estilo: sin !important nuevos (solo los 4 de base.css)', () => {
  const count = (f) => (read(f).match(/!important/g) || []).length;
  const bad = CSS.filter((f) => f !== 'css/base.css' && count(f) > 0).map((f) => `${f}: ${count(f)}`);
  if (count('css/base.css') > 4) bad.push(`css/base.css: ${count('css/base.css')}`);
  expectNone(bad, 'Sube la especificidad o corrige la regla, sin !important.');
});

test('estilo: sin style="…" en el HTML generado, salvo variables CSS', () => {
  const bad = JS.flatMap((f) => (code(f).match(/style="[^"$]*"/g) || [])
    .filter((s) => !/^style="--[\w-]+:/.test(s))
    .map((s) => `${f}: ${s}`));
  expectNone(bad, 'El aspecto va en una clase con token; solo un dato puede ir como style="--x: …".');
});

test('estilo: mostrar u ocultar con hidden, no con style.display', () => {
  const bad = JS.filter((f) => /\.style\.display\b/.test(code(f)));
  expectNone(bad, 'Usa el atributo hidden.');
});

test('publicar: cada archivo de js/ y css/ está en ASSETS de sw.js', () => {
  const sw = read('sw.js');
  const bad = [...JS, ...CSS].filter((f) => !sw.includes(`'./${f}'`));
  expectNone(bad, 'Sin esto el teléfono no lo guarda y la app falla sin red.');
});

test('publicar: cada CSS de componentes está enlazado en index.html', () => {
  const html = read('index.html');
  const bad = CSS.filter((f) => f.startsWith('css/components/') && !html.includes(f));
  expectNone(bad, 'Enlázalo en su lugar de la cascada.');
});

test('publicar: la versión de caché de sw.js coincide con SISTEMA.md y DESIGN.md', () => {
  const version = read('sw.js').match(/const VERSION = '(v\d+)'/)[1];
  assert.match(read('SISTEMA.md'), new RegExp(`Caché de la app \`${version}\``), 'SISTEMA.md cita otra versión');
  assert.match(read('DESIGN.md'), new RegExp(`\\(caché \`${version}\`\\)`), 'DESIGN.md cita otra versión');
});

/* Nació de un error: Progreso dibujaba su propia línea de músculos y el arreglo de Entreno no le llegó. */
test('interfaz: la línea «grupo · músculos» se escribe en un solo sitio', () => {
  const writes = /class="muscle-focus|className\s*=\s*'muscle-focus/;
  const bad = JS.filter((f) => f !== 'js/utils/components.js' && writes.test(code(f)));
  expectNone(bad, 'Usa muscleLineHtml() de js/utils/components.js.');
});
