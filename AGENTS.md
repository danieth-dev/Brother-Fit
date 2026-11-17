# Bía — reglas para trabajar en este repositorio

Estas reglas valen para cualquier persona o agente (Claude Code, Codex, Cursor, Gemini) que cambie el proyecto. `CLAUDE.md` importa este archivo.

Bía es una PWA local-first (HTML, CSS y JavaScript puro, sin build) para registrar entrenos, creatina, peso corporal y comidas, con una asistente de voz llamada también Bía. **Objetivo: publicarla en Google Play Store.** Cada decisión se mide contra eso: calidad de producto, privacidad y usuarios que no son el autor.

## Documentos fuente de verdad

| Archivo | Qué describe | Cuándo se actualiza |
| --- | --- | --- |
| `SISTEMA.md` | Cómo funciona: pantallas, datos, reglas de negocio, la asistente, publicación. | Cambia una pantalla, ruta, tabla, campo, clave de `meta`, regla de negocio, herramienta de la asistente o forma de publicar. |
| `DESIGN.md` | El sistema visual: tokens, tipografía, componentes, reglas y deuda de diseño. | Cambia un token, un componente, un modo o acento, un icono, una fuente o el aspecto de una pantalla. |
| `PRODUCT.md` | Para quién es, propósito, principios de producto. | Cambia el público, el posicionamiento o un principio. |
| `README.md` | Cómo correrla y publicarla, en corto. | Cambia cómo se instala, prueba o publica. |
| `docs/politica-privacidad.md` | Qué datos se guardan, qué se envía y a quién, permisos y borrado. | Cambia lo que se guarda, lo que sale del teléfono (contexto de Bía, fotos, voz), un permiso o un proveedor de IA. |

**La documentación se actualiza en el mismo commit que el código.** Un cambio sin su documentación no está terminado. Antes de cerrar una tarea, revisa si alguna fila de la tabla aplica.

Lee `SISTEMA.md` antes de tocar lógica y `DESIGN.md` antes de tocar interfaz. Para trabajo de diseño se usa la skill `impeccable` (`.agents/skills/impeccable/`), que carga `PRODUCT.md` y `DESIGN.md`.

## Arquitectura

```
index.html → js/main.js (arranque) → js/router.js (hash → vista)
   js/views/*      dibujan y escuchan; una pantalla por archivo
   js/utils/*      dos clases de pieza (ver abajo)
   js/voice/*      adaptador de voz: micrófono, audio y conexión en directo con la IA
   js/services/*   reglas de negocio, cálculos y llamadas a la IA
                   (services/bia/: la asistente, un archivo por responsabilidad)
   js/db.js        el ÚNICO módulo que conoce IndexedDB
   js/store.js     ajustes en memoria y su persistencia
```

`js/utils/` tiene dos clases de archivo:

- **Piezas de interfaz** (`picker.js`, `meal-scanner.js`, `confirm-sheet.js`, `rest-pill.js`, `rest-sheet.js`, `exercise-editor.js`, `memories-panel.js`, `connection-panel.js`, `backup-export.js`, `image.js`, `chart.js`, `components.js`…): usan el DOM o APIs del navegador y pueden llamar servicios.
- **Utilidades puras** (`dates.js`, `clock.js`, `units.js`, `events.js`, `text-match.js`): sin DOM y sin servicios; cualquier capa puede usarlas.

`js/voice/` es un adaptador del navegador: usa `<audio>`, `AudioContext`, `SpeechRecognition`, WebSocket y WebRTC, y llama a `services/bia/` para las reglas (instrucciones, herramientas). Las vistas lo usan; los servicios nunca lo importan.

Dependencias en un solo sentido: **vistas → piezas de interfaz y voz → servicios → db**, y todas pueden usar utilidades puras. Nunca al revés.

- Una vista no importa `db.js` ni abre IndexedDB. Pide los datos a un servicio.
- Un servicio no toca el DOM (`document`, `window`, `innerHTML`, `<canvas>`, descargas). Recibe datos y devuelve datos o lanza un `Error` con un mensaje para el atleta. Para avisar a una pantalla de algo que pasó, emite con `emit(EVENTS.X, detalle)` de `js/utils/events.js`; la vista escucha con `on()`.
- Una vista no importa otra vista. Lo que se comparte entre pantallas (una hoja, un panel) vive en `js/utils/`. Si una pantalla crece, sus partes van a `js/views/<pantalla>/` y solo las importa esa pantalla (ejemplo: `js/views/workout/`).
- Las claves y el proveedor de IA se leen con `getAgentConfig()` de `js/services/bia/config.js`. Las llamadas a la IA las hace el servicio del dominio (`services/meals.js`) o el adaptador de voz, nunca una vista.

## Patrones

- **Vista**: `export async function render(el, params)`. Carga datos con servicios, pinta con un template y escucha con `delegate(el, { accion: handler })` sobre `data-action`. Todo texto dinámico pasa por `esc()`.
- **Hojas y paneles**: viven en `document.body`, fuera de `#app`, se cierran al cambiar de ruta y usan `sheet-drag.js` para cerrarse arrastrando. Confirmaciones con `confirm-sheet.js`. Un panel que se abre desde varias pantallas recibe `{ onChange }` para que cada una se redibuje a sí misma; nunca llama al `render` de otra vista.
- **Controles**: los `<select>`, fechas y horas usan las hojas propias (`picker.js`, `calendar.js`, `time-sheet.js`); el control real sigue en el formulario.
- **Datos**: pesos siempre en kg en la base; la conversión a lb es solo de pantalla (`units.js`). Fechas como `YYYY-MM-DD` (`dates.js`). La hora actual sale de `clock.js` (`now()`) para que las pruebas puedan moverla.
- **Escrituras de varias tablas**: en una sola transacción con `db.mutate()`.
- **Esquema**: tabla o índice nuevo = subir `DB_VERSION` y añadir `if (old < N)` en `migrate()`. Nunca se sube por otra razón.
- **Avisos**: `toast(msg, { tone })`. Errores para el atleta, en español y sin jerga.

Las excepciones que existen hoy están listadas en `SISTEMA.md` → «Deuda técnica». No se añaden nuevas; al tocar una, se corrige.

## Calidad de código

- Funciones cortas con un solo trabajo. Si una función o un archivo crece hasta mezclar responsabilidades, se parte. Archivos de más de ~600 líneas son una señal para dividir.
- Datos, campos y textos en español, como el dominio (`peso`, `metaKcal`, `registrar_serie`). Los nombres de funciones siguen la convención del archivo donde viven; no se mezclan dos estilos en el mismo módulo.
- Sin código muerto, sin `console.log` de depuración, sin comentarios que repiten el código. Un comentario explica el **porqué**.
- Sin constantes mágicas sueltas: se nombran (`DOSE_G`, `SATURATION_DAYS`).
- Sin datos personales ni valores del autor en el código (nombre, peso, rutina). Los valores por defecto son neutros.
- Los músculos se nombran con su nombre anatómico en todo texto que ve el atleta o dice Bía (pectoral mayor, dorsal ancho, trapecio medio, isquiotibiales…). «Pecho alto/medio/bajo» o «espalda media» no son músculos: una porción o cabeza se escribe como énfasis, nunca como músculo aparte («pectoral mayor (énfasis clavicular)», «deltoides (énfasis lateral)»). Las palabras del gimnasio solo sirven para entender lo que escribe o dice el atleta.
- Sin claves, tokens ni URLs privadas en el repositorio.
- Sin dependencias nuevas ni paso de build sin acordarlo antes.

## Estilo (resumen de `DESIGN.md`)

- Todo color, radio, tamaño de letra y sombra sale de un token de `css/tokens.css`. Nada de hex ni `rgba()` del acento dentro de un componente.
- Sin `style="…"` en el HTML que generan las vistas, salvo un dato como variable CSS (`style="--pct: 40%"`). Mostrar u ocultar: atributo `hidden`, no `style.display`. Sin `!important` nuevos. Sin colores escritos en el JS: el color va en una clase con token.
- Fugaz One solo en títulos y a peso 400; cifras con `tabular-nums`; objetivos táctiles de 44 px o más.
- Cada cambio visual se prueba en modo oscuro y claro, con los tres acentos, a ancho de teléfono.
- Antes de crear una clase, se busca la existente en `css/components/`. Una regla nueva va al archivo de su familia o pantalla (tabla en `DESIGN.md` → Componentes); un archivo nuevo se enlaza en `index.html` en su lugar de la cascada y se añade a `ASSETS` de `sw.js`.

## Publicar

- Archivo nuevo de la app → añadirlo a `ASSETS` en `sw.js`. Si está en la raíz (no en `css/`, `js/`, `fonts/` o `icons/`), también a la copia de `.github/workflows/deploy.yml`: solo se publica lo que esa lista copia.
- Cada publicación sube `VERSION` en `sw.js` y la versión de caché que cita `SISTEMA.md`.
- Push a `main` publica en GitHub Pages.

## Lo que no se rompe

- No se vacía IndexedDB ni se pide borrar los datos del sitio para probar.
- No se renombran los identificadores internos: base `brother-fit`, respaldo `brother-ft`, prefijo de caché `brother-ft-`, claves `brother_fit_*`. Hacerlo borra datos o rompe respaldos.
- No se duplica un ejercicio con un nombre existente: el historial pertenece al id.
- La pulsación larga nunca abre el menú del navegador (`.cursor/rules/no-browser-link-menu.mdc`).
- Las fotos de comida nunca se guardan.

## Probar

Servidor local: `python -m http.server 8123` en la raíz y abrir `http://localhost:8123`. Con la base vacía en localhost se cargan solos los datos de `fixtures/` (fuera de git).

Dos juegos de pruebas, y los dos deben pasar antes de cerrar un cambio:

- **Lógica pura** con Node (sin dependencias): `npm test` o `node --test "tests/*.test.js"`. Cubre fechas, unidades, 1RM, esfuerzo, lo habitual, creatina, comidas, respaldo y texto y reportes de Bía. Corre también en GitHub Actions y, si falla, no se publica.
- **Lógica con base de datos** en el navegador: abrir `http://localhost:8123/rpe-test.html` (esfuerzo, series, herramientas de Bía y respaldo sobre la base aparte `brother-fit-rpe-test`).

Una regla nueva o un error corregido en una función pura llega con su prueba en `tests/`. Las funciones de `services/` que no tocan IndexedDB se prueban ahí; las que sí, en `rpe-test.html`.
