# Bía — sistema

Documento vivo del producto. Describe cómo está armado, dónde vive cada dato y qué no se puede romper. Cuando cambie el comportamiento, el esquema, una pantalla o la forma de publicar, este archivo se actualiza en el mismo cambio.

Última revisión: 16 de noviembre de 2026. Base de datos versión 3. Caché de la app `v202`.

## Qué es

Bía es una aplicación web progresiva para registrar entrenos, peso corporal, creatina y comidas en el teléfono. Los datos del atleta viven en el navegador, no en un servidor propio. Lo único que sale del teléfono son las llamadas a IA, y solo si el atleta pegó su clave: Bía (voz y texto en directo) y el análisis de comidas por foto o por texto. Proveedores: Gemini u OpenAI.

## Rumbo

El objetivo es publicar Bía en **Google Play Store**. Toda decisión de arquitectura, datos, permisos y privacidad se toma pensando en pasar la revisión de Play y en atletas que no son el autor: nada de datos personales sembrados en el código, claves y permisos explicados, y datos que se pueden exportar y borrar.

Se usa con una mano, en vertical, con fondo negro y amarillo eléctrico. El nombre público de la app instalada es «Bía», el mismo de la asistente.

**Nombre.** Hasta la `v184` la app se llamó Brother Fit y la asistente Fit. Se cambió a un solo nombre, Bía, por riesgo de marca (Brother es una marca registrada) y para tener una identidad propia. Los identificadores internos **no** cambian, porque cambiarlos borra datos o rompe respaldos: la base `brother-fit`, el respaldo `app: "brother-ft"` y su nombre de archivo, el prefijo de caché `brother-ft-`, las claves `brother_fit_*` de `localStorage`/`sessionStorage`, y nombres de código como `FitAgent`, `fit-chat.js` o `meta.fitChat`.

- Repositorio: https://github.com/danieth-dev/Brother-Bía.git
- Teléfono: https://danieth-dev.github.io/Brother-Bía/
- Local: desde la carpeta del proyecto, `python -m http.server 8000` y abrir `http://127.0.0.1:8000`. No se abre como archivo suelto: los módulos y el service worker lo exigen.

No hay paso de compilación. El navegador carga HTML, CSS y módulos de JavaScript tal cual están en el repositorio.

## Cómo se actualiza este archivo

Se toca en el mismo cambio que modifica el sistema. No es un diario de cada ajuste visual. Sí se reescribe cuando cambia alguna de estas cosas:

- una pantalla, su ruta o lo que el atleta puede hacer ahí
- una tabla, un campo, un índice o `DB_VERSION`
- una regla de negocio (descanso, semilla de ejercicios, 1RM, creatina, Bía)
- la forma de publicar, la caché o el modelo de voz
- una decisión que, si se olvida, borra datos o duplica historial

## Arquitectura

Las reglas completas de capas, patrones y calidad están en `AGENTS.md`; el sistema visual, en `DESIGN.md`. Las vistas dibujan y escuchan. Los servicios deciden y calculan. `js/db.js` es el único módulo que abre IndexedDB. Las vistas no leen ni escriben tablas por su cuenta. Las claves y el proveedor de IA se leen y escriben con `getAgentConfig()` / `setAgentConfig()` de `js/services/bia/config.js`, y `js/services/meals.js` las reutiliza para el análisis de comidas.

```
index.html
  └─ js/main.js          abre la base, siembra ejercicios, carga ajustes, arranca el router
       ├─ js/db.js       IndexedDB brother-fit
       ├─ js/store.js    ajustes en memoria
       ├─ js/router.js   hash → vista
       └─ js/utils/picker.js   listas propias, fuera de #app
            └─ js/views/*       llaman a js/services/* y a js/voice/
                 ├─ js/voice/fit-agent.js   voz en directo; usa services/bia/
                 │    └─ gemini-live.js · openai-realtime.js · pcm-player.js
                 └─ js/services/*   llaman a db (la asistente vive en services/bia/)
```

Al navegar, el router crea un `<section class="view">` nuevo y tira el anterior. Los listeners y temporizadores de esa pantalla mueren con ella. Si el atleta cambia de ruta mientras una vista todavía está cargando, el resultado viejo se descarta.

La pantalla de entreno se vuelve a dibujar sola al añadir o borrar una serie, sin pasar por el router. El observador de `watchPickers` vuelve a enganchar los `<select>` después de cada reemplazo del HTML.

```mermaid
flowchart TD
  telefono[Telefono]
  pages[GitHub Pages]
  sw[Service worker red primero]
  app[Vistas]
  srv[Servicios]
  idb[(IndexedDB brother-fit)]
  live[Gemini Live u OpenAI Realtime]
  vision[Gemini u OpenAI vision y texto]

  telefono --> pages
  pages --> sw
  sw --> app
  app --> srv
  srv --> idb
  srv -->|turnos y herramientas de Bía| live
  live -->|audio y transcripcion| srv
  srv -->|foto comprimida o descripcion| vision
  vision -->|alimentos y macros en JSON| srv
```

## Arranque

1. Se bloquea el tirón de recarga de Chrome solo cuando el documento está arriba y ninguna lista interna puede seguir subiendo.
2. Se abre IndexedDB. Si falla, la app avisa y no sigue. Suele pasar en navegación privada.
3. Se recupera la pregunta de esfuerzo pendiente (`loadPending()`).
4. `ensureSeed()` añade los ejercicios del catálogo que todavía no existen. Un nombre ya guardado no se toca y su historial sigue en el mismo id.
5. Datos de prueba: con `?fixtures`, `?test` o `?seed` en la URL, o en `localhost` con la base sin entrenos ni tomas, se restaura `fixtures/latest-backup.json` (carpeta fuera de git). Si el atleta usó «Borrar todo», `localStorage.brother_fit_cleared` evita que vuelvan a cargarse solos.
6. Se leen los ajustes y se aplican modo (oscuro/claro/sistema) y color de acento.
7. Se observan `#app` para sustituir `<select>`, fechas y horas por hojas propias y para activar el arrastre de los `.seg`.
8. El router pinta la ruta del hash.
9. Se pide almacenamiento persistente para que el navegador no borre los datos por falta de espacio.
10. Se registra `sw.js` y se reanudan los recordatorios de agua (también al volver la app a primer plano). Cuando un service worker nuevo toma el control, la página se recarga sola.

## Pantallas

La barra es una isla fija abajo con Inicio, Entreno y Progreso. Historial, creatina, comidas y ajustes cuelgan de Inicio. Aspecto cuelga de Ajustes. Bía cuelga de Entreno y, mientras está abierto, la isla se oculta (`body.in-agent-view`). Una pulsación larga en cualquier vínculo o botón **nunca** debe abrir el menú del navegador (copiar vínculo, compartir, abrir en Brave): `main.js` cancela `contextmenu` y `dragstart` en captura (salvo campos de texto), marca `draggable=false` en los `<a>` también tras cada repintado, y `base.css` aplica `-webkit-touch-callout: none` a botones, filas, disco, chips y `[data-action]`. Regla de agente: `.cursor/rules/no-browser-link-menu.mdc`.

Los `<select>` de ejercicio, grupo muscular y descanso no usan el menú del sistema. Un botón abre una hoja inferior con la misma paleta. El `<select>` real sigue en el formulario: al elegir, se escribe su valor y se dispara `change`, así que las vistas no saben que la lista es propia. La hoja vive en `document.body`, fuera de `#app`, y se cierra al elegir, al cambiar de ruta o si el control desaparece.

El día del peso corporal y el de una toma de creatina usan la misma hoja, con el mes en curso y el día elegido en amarillo. El `input type="date"` sigue en el formulario y recibe la fecha. El calendario del teléfono no se abre.

| Ruta | Pantalla | Qué hace |
| --- | --- | --- |
| `#/` | Inicio | Creatina de hoy, la semana en siete días (amarillo si hubo entreno), tarjeta de entreno (empezar o continuar), anillo de calorías del día con enlace a Comidas y últimos entrenos. Cada entreno abre `#/history/:id`. |
| `#/workout` | Entreno | Una sesión abierta. Si no hay ninguna, el botón la crea. Peso, reps, tipo de serie y esfuerzo; encima del peso, la sesión anterior completa, para repetirla o pasarla. Si ya la pasaste, lo dice y parte del último peso. Las series de hoy van en un pliegue. La lista de ejercicios pone primero los de hoy, y se recorta por nombre o por grupo muscular. Descanso, alta de ejercicio y corrección desde esa lista. |
| `#/history` y `#/history/:id` | Historial | Lista por semanas con filtro por grupo muscular, y detalle. En el detalle se edita una serie (peso, reps, tipo, esfuerzo) y se enlaza al progreso del ejercicio. Borrar un entreno borra también sus series. |
| `#/progress` y `#/progress/:id` | Progreso | Dos pestañas. Ejercicio: PR, comparativa, gráfica (1RM estimado, ajustado, peso máximo, volumen) y tabla. Peso corporal: registro, gráfica y lista. |
| `#/meals` | Comidas | Anillo de calorías y barras de proteína, carbos y grasa del día frente a la meta; objetivo (ganar, mantener, definir) que recalcula la meta con el último peso corporal; lista de comidas del día con su tipo y proteína (tocar una la edita); escanear foto, añadir a mano o pedir a Bía. |
| `#/creatine` | Creatina | Disco + racha, calendario, progreso/ciencia en pliegue, últimas 5 tomas (+ pliegue «Ver todas»). |
| `#/agent` | Bía | Voz en directo y caja de texto, con botón de cámara para escanear comida. Sin clave, solo pide la clave. Panel «Recuerdos»: perfil (nombre, peso, estatura, creatina), rutina semanal, notas y entrenos. Panel «Conexión y clave»: proveedor (Gemini u OpenAI), claves y estado. La charla se guarda en el teléfono; Nuevo chat la borra tras confirmar. |
| `#/settings` | Ajustes | Cinco grupos: Preferencias (Aspecto, descanso, recordatorios de agua), Asistente Bía (Recuerdos y Conexión), Datos y respaldo, Aplicación (instalar) y Zona de riesgo (borrar todo). |
| `#/appearance` | Aspecto e inicio | Modo de pantalla (oscuro, claro o sistema), color de acento (amarillo, azul o rosado) y vista del disco de creatina en Inicio (completo o compacto al tomar). |

Si el ejercicio tiene grupo muscular, el nombre lo lleva debajo, en letra pequeña y con un punto de color. También queda bajo el campo ya elegido y junto al nombre en las series registradas. El grupo `Otro` no se muestra: no nombra un músculo. Cuando el grupo se queda corto, la misma línea sigue con la parte concreta en minúscula, por ejemplo «PIERNAS · cuádriceps y glúteo». Eso se ve al elegir y bajo el campo. En las series ya registradas sigue solo el grupo.

Un ejercicio es del atleta cuando su nombre no está en el catálogo. En la lista, esa fila lleva un lápiz justo antes del círculo y fuera de la cápsula amarilla. El nombre sigue eligiendo. El lápiz abre la ficha «Editar ejercicio» (nombre y grupo). Eliminar está en esa ficha, no en la fila: si hay series, la confirmación dice cuántas y se borran con el ejercicio en la misma operación. El catálogo no lleva lápiz. La ficha vive en `document.body`, como las otras hojas.

## Datos

Base `brother-fit`, versión 3 (la 3 añadió `meals`). Para una tabla o un índice nuevo se sube `DB_VERSION` y se añade un bloque `if (old < N)` en `migrate()`. No se sube la versión por un cambio de pantalla.

| Tabla | Qué guarda |
| --- | --- |
| `exercises` | `{ id, nombre, grupo }`. El nombre es único. No hay campo de dueño: es del atleta si el nombre no está en el catálogo. |
| `workouts` | `{ id, fecha, startedAt, finishedAt, duracion, notas }`. `fecha` es índice. |
| `sets` | `{ id, workoutId, exerciseId, peso, reps, tipo?, rpe?, ts }`. `tipo` es `trabajo` o `calentamiento`. Índices por entreno y por ejercicio. Una serie vieja sin `tipo` sigue contando en el volumen y en el 1RM estimado, y no pide esfuerzo. |
| `supplements` | `{ id, tipo, fecha, hora, cantidad, ts }`. Hoy `tipo` es `creatina`. |
| `bodyMetrics` | `{ id, fecha, peso, ts }`. |
| `agentMemory` | `{ id, contenido, ts }`. Recuerdos de Bía, no las series. |
| `meals` | `{ id, fecha, ts, hora, tipo, nombre, kcal, proteina, carbos, grasa, items, origen }`. `fecha` es índice. `tipo` es Desayuno, Almuerzo, Merienda o Cena. `items` son los alimentos: `{ nombre, gramos, kcal, proteina, carbos, grasa, kcal100, p100, c100, g100 }`. `origen` es `foto`, `manual` o `voz` (Bía). Nunca se guarda la imagen. |
| `meta` | Pares `{ key, value }`. Ver la tabla siguiente. |

Claves de `meta`:

| Clave | Valor |
| --- | --- |
| `settings` | `{ descanso, descansoMode, unidad, aguaRecordatorios, tema, modo, creatinaCompacta, metaKcal, metaProteina, metaCarbos, metaGrasa, metaObjetivo }`. `unidad` es `kg` o `lb` (preferencia de pantalla). `tema` es `amarillo`, `azul` o `rosado`; `modo` es `oscuro`, `claro` o `sistema`. `metaObjetivo` es `ganar`, `mantener` o `definir`. La toma de creatina es siempre 5 g (`DOSE_G`). |
| `waterReminders` | Plan del día: `{ fecha, items: [{ id, at, body, done }] }`. Avisos locales de agua tras la creatina. |
| `activeWorkoutId` | Id de la sesión abierta. Se borra al terminar o si esa sesión ya está cerrada. |
| `activeRest` | `{ restEnd, lastReps }` del descanso en curso. Si ya venció, se borra al leerlo. |
| `pendingRpe` | Pregunta abierta: `{ setId, mark, attempts, until }`. Se suelta al anotar, al vencer, al crear otra serie, al terminar o descartar, al borrar esa serie, al pasarla a calentamiento o al usar los botones. |
| `rpeSeq` | Entero de la próxima marca. No vuelve a cero al cerrar la pregunta. Solo puede bajar si se importa un respaldo o se borra todo, porque esas dos acciones recargan la página y cortan la sesión de Bía. |
| `seeded` | Marca de que el catálogo ya se intentó. La semilla ya no depende de esta marca para volver a correr. |
| `lastBackup` | Marca de tiempo del último respaldo compartido o descargado. |
| `backupNudgeDay` | Día ISO en que ya se mostró el aviso «Asegura tus PRs». Como máximo una vez al día. |
| `voiceProvider` | `gemini` (de fábrica) u `openai`. Elige el proveedor de Bía y el primero que se intenta al analizar comidas. |
| `geminiApiKey` | Clave de Gemini. Solo en este teléfono. No va al repositorio ni al respaldo, y un respaldo importado no la pisa. |
| `openaiApiKey` | Clave de OpenAI. Mismo trato que la de Gemini. |
| `openaiModel` | Modelo de OpenAI Realtime. De fábrica `gpt-4o-mini-realtime-preview`. |
| `athleteProfile` | `{ nombre, peso, estatura, creatina }` en texto libre, editable en Recuerdos. De fábrica está vacío salvo la creatina (`5 g al día`); la pantalla muestra «Sin definir» y Bía recibe «sin dato» y no lo inventa. |
| `weeklyRoutine` | `[{ dia, grupo, dot? }]`. Rutina semanal que Bía conoce. De fábrica son los siete días sin grupo; un día vacío es «Descanso» y se puede volver a vaciar. Si ningún día tiene grupo, Bía recibe «sin definir» y no supone qué toca. |
| `aiReports` | `[{ ts, reason, note, text }]`, como mucho 50. Respuestas de Bía que el atleta reportó. `reason` es `ofensiva`, `peligrosa`, `incorrecta` u `otra`. |
| `fitChat` | `{ messages: [{ role, text, ts }], updatedAt }`. Charla visible de Bía. Tope 60 mensajes. No son recuerdos. Se borra solo con Nuevo chat. |

Ajustes de fábrica: descanso manual de 90 s, modo automático, unidad `kg`, recordatorios de agua activos. La creatina del botón es 5 g fijos.

Tras registrar la creatina de hoy, si los recordatorios están activos y el teléfono concede notificaciones, se programan hasta dos avisos locales (aprox. 45 min y 3 h después), sin sonar de noche. Deshacer o borrar la última toma del día cancela el plan. No hay push desde un servidor.

Los pesos de series y peso corporal se guardan siempre en **kg**. En Entreno y en Progreso un segmento `kg | lb` junto al campo Peso cambia `settings.unidad`, convierte el valor del input abierto y muestra historial/PR/volumen en esa unidad (`js/utils/units.js`). Lo ya guardado se interpreta como kg.

Los controles segmentados (`.seg`: tipo de serie, kg/lb, métricas, tipo en historial) se pueden pulsar o arrastrar: la pastilla amarilla se mueve con el dedo y al soltar encaja en la opción más cercana (`js/utils/seg-swipe.js`). Si el `.seg` tiene varias filas (métricas en Progreso), el gesto es libre en 2D. En Progreso, cambiar kg/lb o la métrica del gráfico actualiza números y charts sin remount del `.seg` (si no, parpadea la pastilla). El segmento de unidad no va dentro del `<label>` del input de peso, para no liar el gesto.

El respaldo es un JSON `{ app: "brother-ft", schema: 1, exportedAt, data }`. Al asegurar PRs se intenta `navigator.share` con el archivo; si el teléfono no puede, se descarga como antes. Cancelar la hoja de compartir no actualiza `lastBackup`. Las claves de IA (`geminiApiKey`, `openaiApiKey`) no salen en el respaldo; al importar, se descartan las que traiga el archivo y se conservan las del teléfono. Importar reemplaza todas las tablas en una sola transacción: si falla, no queda a medias. Una fila dañada (sin clave válida) aborta la transacción y avisa «El respaldo tiene datos dañados. No se cambió nada.»; hasta la `v195` esa fila dejaba las tablas vacías. Las reglas sin base (leer el archivo, mezclar las claves, cuándo avisar) son funciones puras de `services/backup.js` con pruebas en `tests/logic-backup.test.js`. Borrar todo es restaurar un volcado vacío.

Aviso de respaldo (`js/utils/backup-nudge.js`): al abrir Inicio o al terminar un entreno, si hay al menos un entreno cerrado y nunca respaldó, o el último respaldo tiene ≥7 días, o hay ≥5 entrenos cerrados desde entonces. Copy: «Asegura tus PRs». No más de una vez al día (`backupNudgeDay`).

Toasts (`#toast`): píldora elevada con borde amarillo completo (look clásico Bía). `toast(msg, { tone: 'danger' })` cambia el borde a rojo; `ok`/`warn` comparten el mismo look.

## Entrenamiento

Una sesión empieza con `startWorkout()`. Si ya hay una abierta, se reutiliza. Al terminar se escribe `finishedAt` y `duracion`, y se suelta `activeWorkoutId`.

Cada serie dispara el descanso y lo guarda en `meta.activeRest`. Recargar el teléfono no lo borra. El tiempo sale de las repeticiones cuando el modo es automático:

| Reps | Descanso |
| --- | --- |
| 1–5 | 3:00 |
| 6–8 | 2:00 |
| 9–12 | 1:30 |
| 13 o más | 1:00 |

En modo manual se usan los segundos de Ajustes (`descanso`, 90 por defecto).

El 1RM estimado es Epley: si hay una repetición, el peso; si hay más, `peso * (1 + reps / 30)`. El volumen de una serie es peso por repeticiones, también en el calentamiento. El PR de un ejercicio sigue siendo el mayor peso, las mayores reps y el mayor 1RM de Epley. Esa curva no cambia el día que empieza el esfuerzo.

Una serie de trabajo pregunta «¿Cuántas repeticiones más podrías haber hecho?» con cinco botones: 0, 1, 2, 3 y «4 o más». Debajo, «0 es no salía otra». No se copia de la serie anterior. Se guarda `rpe = 10 - rir`, y un 4 o cualquier entero mayor queda en 4, así que el RPE es 6. Ese 6 es un piso, no un punto medio, y no cuenta como serie efectiva. En calentamiento los botones siguen en su sitio, atenuados: «Los calentamientos no llevan esfuerzo». Si había un número elegido, se borra y no vuelve solo al pasar otra vez a trabajo.

En la pantalla, una serie de trabajo **no se guarda** sin elegir el esfuerzo (0–4). El aviso es «Elige el esfuerzo (0–4).» y no se crea la fila. El calentamiento sí se guarda sin RIR. Bía por voz puede seguir anotando sin `rir` y abrir la pregunta pendiente: el pendiente significa solo que Bía preguntó en voz alta y espera respuesta. Un doble toque en «Registrar» no crea dos series: mientras se guarda, el segundo toque no hace nada. Dos series iguales anotadas seguidas, por rápido que sea, son dos series. El candado de 8 segundos con la misma serie es solo de Bía, que a veces repite la llamada. En series ya hechas (p. ej. importadas o de Bía sin respuesta), «Falta esfuerzo» sigue abriendo los cinco botones. Esos botones sí pisan un esfuerzo ya guardado. Bía no lo pisa.

Bía, si no lo oyó al anotar, abre una pregunta con marca y hace la misma pregunta que la pantalla. El plazo se escribe en ese momento: fin del descanso más un minuto si hay reloj, o cinco minutos si no hay. Saltar el descanso es el único caso que lo reescribe, a un minuto desde ahora, en la misma operación que apaga el reloj. La respuesta entra con `anotar_rpe` y la marca vigente. Una marca vieja no anota y no gasta intento. Un número inválido gasta un intento; al segundo, la serie se queda sin esfuerzo. «No sé» la suelta sin gastar ese intento. Si no hay pregunta, el plazo venció o la serie ya no está, Bía no vuelve a preguntar.

En la semana, al lado del volumen, hay tres cuentas al mismo nivel y solo sobre series de trabajo. Sin esfuerzo: tienen tipo y no tienen RPE. Fáciles: RPE menor que 7. Efectivas: RPE de 7 o más. Las tres suman las series de trabajo. Cada efectiva cuenta una vez, en el grupo de su ejercicio: eso es lo que el documento llama directa, y no parte una serie en varios músculos. Una serie vieja sin tipo no entra en ninguna. Si ahora se le pone tipo, el RPE que ya tenía cae en fácil o en efectiva según el umbral.

El 1RM ajustado es otra métrica, `peso * (1 + (reps + (10 - rpe)) / 30)`. Solo usa series de trabajo cuyo RPE es un entero de 6 a 10. El RPE de una serie sin tipo, o uno fuera de ese rango (un 3, un 12, un 8.5 de cuando el campo era libre), no entra en este cálculo ni se lee como repeticiones de reserva. Si las repeticiones efectivas pasan de 12, ese punto no es fiable.

`rpe-test.html` corre estos casos contra la base `brother-fit-rpe-test` y un reloj que se puede adelantar. No registra el service worker y no abre `brother-fit`.

El catálogo inicial, por grupo:

- Pecho: Press banca, Press inclinado con mancuernas, Aperturas, Press en poleas, Press Hammer, Flexiones
- Espalda: Dominadas, Remo con barra, Jalón al pecho, Peso muerto
- Piernas: Sentadilla, Prensa de piernas, Peso muerto rumano, Zancadas, Extensión de pierna, Sentadilla péndulo
- Hombros: Press militar, Elevaciones laterales
- Bíceps: Curl de bíceps, Curl martillo
- Tríceps: Fondos, Extensión de tríceps, Copa
- Core: Plancha, Crunch en polea

Grupos que el atleta puede elegir al crear uno: Pecho, Espalda, Piernas, Hombros, Bíceps, Tríceps, Core, Cardio, Otro.

La semilla corre en cada arranque. Si el nombre ya existe, se ignora solo el error «Ese ejercicio ya existe.» La comparación distingue mayúsculas. Un nombre distinto crea otro ejercicio y el historial se queda en el id viejo. No se renombra ni se fusiona desde aquí.

Corregir un ejercicio del atleta cambia el nombre y el grupo del mismo id: el historial sigue ahí. No se puede usar un nombre del catálogo ni uno que ya exista. Eliminarlo borra también sus series. Un entreno que se queda sin series sigue en el historial, vacío.

## Creatina

Cada toma es una fila de `supplements` con `tipo: "creatina"`. Registrar hoy es un toque. Quitar la toma de hoy (Inicio o Creatina) pide confirmación fuerte («Sí, quitar hoy») porque rompe racha y cancela el agua; borrar una toma vieja en la lista es confirmación más suave. En `#/creatine` el disco muestra `% sat` como señal secundaria bajo «5 g hoy» (el CTA sigue siendo Registrar/Tomada); el above-the-fold es disco + racha + calendario; stats/saturación/ciencia van en «Progreso y ciencia». Un día solo cuenta una toma; la ficha retroactiva no deja añadir otra si ese día ya tiene. La saturación es un modelo simple, no un análisis de laboratorio: 28 días con toma cuentan como saturación, un día saltado no vacía el depósito, y por encima de eso la fase pasa a mantenimiento. La racha no se rompe el mismo día si todavía no se tomó: cuenta desde ayer.

La ciencia que la pantalla explica, y que no hay que contradecir en los textos: sin carga, 3–5 g al día saturan en unas cuatro semanas; con carga, unos 20 g al día durante 5–7 días y luego mantenimiento. La forma de referencia es el monohidrato.

## Comidas

Cada comida es una fila de `meals` con sus alimentos. La foto se comprime en el teléfono (JPEG de 800 px como máximo, unos 50 KB), se manda a la IA y se descarta: no se guarda en ninguna tabla.

El análisis vive en `js/services/meal-ai.js`. Se usa el proveedor elegido en Bía (`voiceProvider`). Si falla, se prueba el otro si tiene clave; con una descripción escrita, si ninguno responde, la lee el catálogo local (`food-catalog.js`). Sin ninguna clave, la foto no se puede analizar: la pantalla avisa «Configura tu clave en Bía › Conexión» y deja añadir los alimentos a mano. Una clave de Gemini inválida corta la búsqueda de modelos. Si un texto no se reconoce, no se inventa nada: la lista queda vacía y un aviso pide añadir los alimentos a mano. Con Gemini, la app pregunta a la cuenta qué modelos con `generateContent` tiene y prueba hasta cinco por orden de preferencia (Flash primero); si esa consulta falla, usa una lista fija. Con OpenAI usa `gpt-4o-mini`. La respuesta es JSON con alimentos y macros. Si la foto no es comida, el error `NOT_FOOD` se muestra tal cual y no se prueba otro proveedor.

El atleta puede añadir una aclaración antes de analizar (por ejemplo «air fryer, sin aceite») o describir el plato por texto o voz (`analyzeMealText`). En la hoja de resultado (`js/utils/meal-scanner.js`) cada alimento se ajusta con − / + en pasos de 5, 10 o 20 g según su tamaño, y kcal y macros se recalculan con los valores por 100 g que guarda el alimento. Faltantes se añaden desde el catálogo local (`COMMON_FOODS`, unos 30 alimentos con porción típica) o por nombre y gramos. El tipo de comida sale de la hora si no se elige: Desayuno hasta 11:30, Almuerzo hasta 16:00, Merienda hasta 19:30, luego Cena.

Las metas de fábrica son una referencia general: 2000 kcal, 120 g de proteína, 235 g de carbos y 65 g de grasa, con objetivo «mantener». Al elegir un objetivo se recalculan con el último peso corporal (acotado entre 35 y 180 kg). Sin peso registrado no se calcula nada: un aviso pide registrarlo en Progreso y las metas se pueden escribir a mano.

| Objetivo | kcal por kg | Proteína por kg | Grasa por kg |
| --- | --- | --- | --- |
| Ganar | 43 | 2,05 g | 1,35 g |
| Mantener | 36 | 1,9 g | 1,2 g |
| Definir | 30 | 2,2 g | 1,0 g |

Los carbos son el resto de las kcal, con un piso de 100, 80 o 60 g según el objetivo.

## Progreso y peso corporal

Progreso agrupa las series de un ejercicio por día y muestra el 1RM estimado, el 1RM ajustado, el peso máximo y el volumen. El ajustado no se dibuja en la misma línea que el estimado. La gráfica es un SVG propio (`js/utils/chart.js`). Los números del eje van en el color del texto, no en el negro por defecto del SVG.

El peso corporal es independiente del entreno. Se guarda por fecha y se dibuja con la misma gráfica.

## Bía, la asistente

La app y la asistente se llaman igual: **Bía**. Es un solo nombre y un solo personaje. Antes la asistente se llamaba Fit y la app Brother Fit; si el atleta la llama Fit, responde igual sin corregirlo, pero si preguntan su nombre dice Bía.

Bía tiene dos proveedores, que se eligen en «Conexión y clave» (`voiceProvider`):

- **Gemini** (de fábrica): canal en directo por WebSocket, modelo `models/gemini-3.8-live`, voz Aoede, audio de respuesta a 24 kHz PCM16. No se envía `thinkingConfig`. En pantalla solo entra `outputTranscription.text`. El texto de `part.text` es razonamiento interno y no se muestra. Lo que dice el atleta se transcribe en el teléfono con `SpeechRecognition` del navegador y se manda como texto.
- **OpenAI Realtime**: WebRTC, modelo `openaiModel` (de fábrica `gpt-4o-mini-realtime-preview`), voz Coral, transcripción con `whisper-1`.

También se puede escribir a Bía. El botón de cámara abre el escáner de comidas desde la charla.

Herramientas que el modelo puede llamar:

| Herramienta | Efecto |
| --- | --- |
| `usar_ejercicio` | Deja Entreno en el ejercicio nombrado, sin anotar una serie. Si no está, o hay varios, no cambia el de la pantalla. |
| `registrar_serie` | Anota la serie en la sesión abierta. Si el atleta nombra el ejercicio, la app lo busca en su lista y Entreno pasa a ese. Si no lo nombra, usa el de la pantalla. Si no está, o hay varios, no anota en otro. Reps de 1 a 100. Peso de 0 a 600; si no viene, usa el de la serie anterior de ese ejercicio. Peso corporal es 0 kg añadidos, no el de la báscula. `tipo` es trabajo si no dicen calentamiento. `rir` responde a cuántas repeticiones más podría haber hecho. Si faltan o no son un entero de 0 para arriba, guarda la serie y abre la pregunta. |
| `anotar_rpe` | No crea filas. Recibe la marca y el `rir`, u `omitir` si el atleta no sabe. La serie la elige `pendingRpe`, no el modelo. |
| `consultar_creatina` | Lee el registro real. Devuelve si hoy está tomada, los gramos, la racha (hoy sin toma no la corta), días en 7 y en 30, fase y porcentaje, la última toma y los días fallados de los seis anteriores. No anota ni borra. Bía la llama solo si preguntan, y contesta con una frase. |
| `registrar_creatina` | Marca la toma de hoy (5 g por defecto) o la deshace. Escribe en `supplements`. |
| `registrar_peso_corporal` | Anota el peso de la báscula en `bodyMetrics` (unidad activa, fecha opcional) y actualiza el perfil. Nunca va a recuerdos. |
| `gestionar_entrenamiento` | `iniciar` abre la sesión de hoy; `finalizar` la cierra y devuelve el resumen. |
| `consultar_entrenamientos` | Lee sesiones reales: hoy, ayer, anteayer, un grupo muscular o la más reciente. |
| `consultar_progreso_ejercicio` | PR de peso, reps y 1RM estimado, última sesión y tendencia de un ejercicio. |
| `consultar_comidas` | Diario de hoy, ayer, la semana (con promedios) o una fecha; lo consumido y lo que falta para la meta. |
| `registrar_comida` | Guarda una comida (`origen: 'voz'`) con plato, tipo, kcal y macros estimados. |
| `corregir_comida` | Cambia o borra una comida de hoy; sin id, la última. |
| `guardar_recuerdo` | Guarda una nota cualitativa en `agentMemory` (molestias, técnica, metas, horarios). No guarda series, peso corporal, creatina ni comidas: para eso están sus herramientas. |
| `listar_recuerdos` | Devuelve lo guardado. |
| `borrar_recuerdo` | Borra uno por id. |

Además de los recuerdos, el contexto de Bía incluye el perfil, la rutina semanal, los entrenos recientes, el peso corporal y las comidas del día.

El nombre lo resuelve la app: ignora mayúsculas y acentos, y acepta el singular si solo hay un ejercicio. Si el atleta añade el grupo muscular al final («aperturas de pecho», «copa de tríceps»), la app reconoce el ejercicio base siempre que lo sobrante sea únicamente un músculo; si empatan varios, Bía pregunta cuál. Nombrarlo, aunque todavía no haya serie, deja Entreno en ese ejercicio. Un acierto al anotar también lo cambia, aunque el atleta esté en Bía. Cero aciertos o varios no escriben nada y no crean el ejercicio. El peso, si no lo dice, sale de la última serie de ese ejercicio. Bía no pregunta el peso antes de la serie ni dice «lastre». Una segunda llamada igual, de Bía o de la pantalla, sobre la misma serie y el mismo ejercicio dentro de 8 segundos, no escribe otra fila ni abre otra marca. La pantalla lo dice en un aviso. Su criterio de fondo son cuatro pilares: dormir bien, comer bien, hacer ejercicio y no estresarse. Solo los usa si el atleta saca el tema o propone algo que los rompe. No los recita ni los pone por delante de anotar la serie. Durante el descanso Bía no habla por su cuenta, ni de creatina. Al cerrar una sesión con series, si hoy sigue sin toma, lo dice una sola vez junto al resumen. El micrófono se abre de uno en uno: un silencio no dispara dos aperturas, y si el teléfono lo rechaza varias veces seguidas, Bía lo suelta en vez de dejarlo en bucle. Si la pregunta está abierta y el atleta dice 0, cero o ninguna, la app lo anota y ese turno no se lo manda a Bía, para que no lea una nota interna. Pregunta el esfuerzo con las mismas palabras que la pantalla. No sugiere pesos ni cambia el descanso. Los turnos van en español, cortos, sin markdown y sin el razonamiento en inglés. El resumen de la sesión incluye el esfuerzo de cada serie.

**Reportar una respuesta.** La política de Play para IA generativa pide que el atleta pueda marcar una respuesta ofensiva o dañina sin salir de la app. Tocar una burbuja de Bía muestra «Reportar respuesta»; la hoja pide un motivo y un comentario opcional (`js/utils/report-sheet.js`). El reporte se guarda en `meta.aiReports` y la burbuja queda con borde discontinuo. Si `APP_INFO.supportEmail` (`js/app-info.js`) tiene un correo, se abre el correo del teléfono con el reporte ya escrito; si está vacío, solo se guarda.

Las claves se escriben en «Conexión y clave» y quedan en `meta.geminiApiKey` y `meta.openaiApiKey`. Sin la clave del proveedor activo no hay sesión. La charla visible vive en `meta.fitChat`. Al cambiar de pestaña, si la sesión sigue abierta, solo se redibuja. Si se cortó, al reconectar se inyecta el historial una vez como contexto y Bía no lo repite. Nuevo chat (icono +) pide confirmación, borra solo esa charla y abre sesión limpia. Los recuerdos no se tocan.

## Interfaz

Tokens en `css/tokens.css`. Fondo `#07080a`, texto `#f8fafc`, amarillo `#ffe600`. Hay modo claro (`data-modo="claro"`, fondo `#edf0f5`) y acentos azul y rosado (`data-tema`); `meta[name="theme-color"]` sigue al modo efectivo. El anillo y las barras de Comidas usan verde (`#10B981`), fuera de la paleta de acento. Fugaz One es solo la voz de los títulos, en peso 400, para que el navegador no invente una negrita. Números, etiquetas, cuerpo y el reloj usan la fuente de interfaz o la monoespaciada.

La isla de navegación sustituye una barra de borde a borde. El zoom con dos dedos está cerrado en el viewport. `html` y `body` no encadenan el scroll; las listas de la hoja y la de recuerdos de Bía sí se desplazan, con `overscroll-behavior: contain`.

## Publicación

Cada push a `main` dispara `.github/workflows/deploy.yml`. En GitHub, Settings → Pages tiene como fuente **GitHub Actions**: ese workflow es lo único que publica. Si se vuelve a «Deploy from a branch», GitHub publica además el repositorio entero sin pasar por las pruebas. Primero corre las pruebas de `tests/` con Node; si fallan, no se publica. Después copia solo la app a `_site/` (`index.html`, `manifest.webmanifest`, `sw.js`, `.nojekyll`, `css/`, `js/`, `fonts/`, `icons/`) y publica eso en GitHub Pages. No se publican los documentos, `rpe-test.html` ni las carpetas de agentes. Un archivo nuevo en la raíz se añade a esa lista; uno dentro de esas carpetas ya va incluido (y siempre se añade a `ASSETS` de `sw.js`).

Para Play Store la app tendrá que empaquetarse como app de Android (por ejemplo, una Trusted Web Activity sobre la URL publicada). La forma está por decidir y ese paso todavía no existe en el repositorio.

`sw.js` va a la red primero y solo usa la copia local si no hay conexión. Al publicar se sube `VERSION`. Ese cambio de nombre de caché hace que el teléfono suelte la anterior. Para verlo: esperar a que Pages termine, cerrar la app desde las recientes y abrirla de nuevo. No se borran los datos del sitio para forzar la actualización: ahí están los entrenos.

## Qué no se rompe

- No se vacía IndexedDB ni se pide al atleta que borre los datos del sitio para probar un cambio.
- No se sube `DB_VERSION` si no cambia el esquema.
- No se duplica un ejercicio que ya existe con el mismo nombre. El historial pertenece al id, no al texto.
- Los pesos en base están en kg; la unidad de pantalla convierte al mostrar y al escribir.
- No se mezclan el 1RM estimado y el ajustado en la misma curva.
- No se marca «falta esfuerzo» en una serie vieja que no tiene tipo.
- No se muestra `part.text` de Bía ni se manda configuración de pensamiento.
- No se deja que el bloqueo del tirón de recarga cancele el dedo que sube una lista.
- La capa de vistas no abre IndexedDB. El acceso pasa por `js/db.js`.
- No se guarda la foto de una comida: solo los números y los alimentos.
- Las claves de IA no se escriben en el código ni en el repositorio.
- Un archivo nuevo de la app se añade a `ASSETS` en `sw.js`, y cada publicación sube `VERSION`.
- Este archivo se actualiza cuando cambia lo que está escrito arriba.

## Deuda técnica

Medida el 15 de noviembre de 2026 contra las reglas de `AGENTS.md`. No se añade deuda nueva; al tocar una de estas zonas, se corrige y se borra la fila. La deuda visual está en `DESIGN.md` → «Deuda conocida».

**Capas**

Sin deuda abierta: las vistas no abren IndexedDB y ningún servicio toca el DOM.

Resuelto en la `v188`: `js/services/agent.js` (1 660 líneas) se partió en `js/services/bia/` (configuración, memoria, texto, declaraciones de herramientas, herramientas, contexto e instrucciones) y la sesión de voz `FitAgent` pasó a `js/voice/fit-agent.js`, fuera de los servicios. En la `v200` `views/agent.js` (718 líneas) se partió en la pantalla (319) y `js/views/agent/`, y `utils/agent-panels.js` (673) en `memories-panel.js`, `connection-panel.js` y la hoja común `agent-sheet.js`; las tarjetas de herramientas son una tabla y los modelos de OpenAI viven en `bia/config.js`. De paso: «Registrar serie 1» abre Entreno con ese ejercicio (antes escribía un campo que nadie leía), se borró un oyente de «change-key» que nunca se activaba y el recuerdo deshecho se apaga con una clase, no con estilo en el JS. En la `v199` `services/meals.js` (740 líneas) se partió en diario (`meals.js`), cálculos (`nutrition.js`), catálogo con lector local (`food-catalog.js`) e IA (`meal-ai.js`), con pruebas; el lector local se comparó con el viejo y da lo mismo. De paso: «anteayer» ya no se lee como «ayer», una clave de Gemini inválida deja de probar los otros modelos y la descripción escrita también usa el proveedor de respaldo antes del catálogo local. En la `v198` `workout.js` (854 líneas) se partió en la pantalla (488) y `js/views/workout/` (estado, plantillas y reloj); las reglas sin DOM pasaron a `services/session-plan.js` con pruebas. De paso: al acabar el descanso de una rutina ya se pasa de verdad al siguiente ejercicio (antes el repintado volvía al anterior), el aviso de ejercicio creado ya no se acumula con cada repintado y se quitaron los emojis. En la `v197` `picker.js` (849 líneas) se partió en hoja, buscador (`picker-find.js`) y alta de ejercicio (`picker-creator.js`); la regla del grupo muscular pasó a `services/muscle-groups.js` y la búsqueda sin tildes a `utils/text-match.js`, las dos con pruebas; su arrastre propio se borró y usa `sheet-drag.js` (mismos umbrales que las demás hojas). En la `v195` `fit-agent.js` (777 líneas) se partió en un archivo por proveedor (`gemini-live.js`, `openai-realtime.js`) y la cola de audio (`pcm-player.js`); de paso, las respuestas de Bía con OpenAI ya se escriben en el chat (antes solo se oían). Las importaciones dinámicas de `meals.js` desaparecieron: ya no hay ciclo entre comidas y la asistente.

Resuelto en la `v187`: «Borrar todo» pasa por `clearAllData()` del servicio de respaldo; compartir o descargar el respaldo vive en `js/utils/backup-export.js`; los paneles Recuerdos y Conexión salieron de la vista de Bía a `js/utils/agent-panels.js` (Ajustes ya no importa otra vista); el servicio de Bía avisa a Entreno con `js/utils/events.js` en vez de `document`; la compresión de fotos vive en `js/utils/image.js`. De paso se corrigió que guardar la conexión desde Ajustes dibujaba el chat de Bía dentro de Ajustes.

**Tamaño y responsabilidades**

| Archivo | Líneas | Mezcla |
| --- | --- | --- |
| `js/services/workouts.js` | 645 | Catálogo de ejercicios, entrenos, series, récords y progreso. El siguiente corte: el catálogo de ejercicios aparte. |

**Antes de Play Store**

Resuelto en la `v189`: perfil, rutina y metas de fábrica ya no traen datos del autor; el plato de demostración desapareció; las claves de IA no viajan en el respaldo; el deploy publica solo la app.

Pendiente:

- **Empaquetado para Android.** Trusted Web Activity (Bubblewrap) u otra vía. Necesita un nombre de paquete definitivo, una clave de firma y `/.well-known/assetlinks.json` en la **raíz del dominio**: con GitHub Pages de proyecto (`/Brother-Fit/`) eso exige un dominio propio o el repositorio de usuario.
- **Modelo de la IA.** Hoy cada atleta pega su propia clave de Gemini u OpenAI. Para un público general eso es una barrera; la alternativa es un servidor propio que guarde la clave. Decisión de producto pendiente.
- **Política de privacidad**: hay un borrador en `docs/politica-privacidad.md`, con el anexo para el formulario de seguridad de los datos. Faltan los datos del editor, elegir la sección 4A o 4B y publicarla en una URL fija (`APP_INFO.privacyUrl`).
- **Formularios de Play Console:** seguridad de los datos (Data safety), declaración de apps de salud y fitness, clasificación de contenido.
- **Correo de soporte** en `js/app-info.js` (`supportEmail`). Sin él, los reportes de respuestas de Bía solo quedan en el teléfono y no te llegan.
- **Ficha de la tienda:** capturas, ícono de 512 px, gráfico destacado de 1024×500, textos.
- Pruebas: la lógica pura tiene 44 pruebas en `tests/` (Node, corren en CI antes de publicar) y la de base de datos, 36 en `rpe-test.html` (navegador, a mano), incluidas la ida y vuelta del respaldo, el archivo dañado y borrar todo. Faltan pruebas de interfaz.

## Mapa de archivos

| Ruta | Papel |
| --- | --- |
| `docs/politica-privacidad.md` | Borrador de la política de privacidad y del formulario de seguridad de los datos de Play. |
| `AGENTS.md` | Reglas de arquitectura, patrones, calidad y documentación para personas y agentes. `CLAUDE.md` lo importa. |
| `DESIGN.md` | Sistema visual: tokens, tipografía, componentes, reglas y deuda de diseño. |
| `PRODUCT.md` | Público, propósito y principios de producto. |
| `index.html` | Cascarón, isla y arranque del módulo. |
| `manifest.webmanifest` | Instalación como app. |
| `sw.js` | Caché y versión publicada. |
| `css/tokens.css` | Color, tipo y fuente. |
| `css/base.css` | Página, foco, scroll. |
| `css/components/01-…14-…css` | Componentes por familia y pantalla; `index.html` los carga en orden y ese orden es la cascada. Detalle en `DESIGN.md` → Componentes. |
| `js/main.js` | Arranque. |
| `js/db.js` | IndexedDB. |
| `js/store.js` | Ajustes en memoria. |
| `js/router.js` | Rutas. |
| `js/services/workouts.js` | Ejercicios, sesiones, series, descanso, PR y 1RM ajustado. |
| `js/services/effort.js` | Tipo de serie, pregunta de esfuerzo y marcas. |
| `js/services/seed.js` | Catálogo que no pisa lo ya creado. |
| `js/services/body.js` | Peso corporal. |
| `js/services/creatine.js` | Tomas y saturación. |
| `js/services/backup.js` | Exportar e importar. |
| `js/services/bia/config.js` | Proveedor de IA, claves y modelo (`getAgentConfig`, `setAgentConfig`). |
| `js/services/bia/memory.js` | Recuerdos, perfil y rutina semanal. |
| `js/services/bia/text.js` | Qué se muestra de lo que dice Bía y qué cuenta como turno del atleta. |
| `js/services/bia/tool-declarations.js` | Herramientas que el modelo puede pedir (solo datos). |
| `js/services/bia/tools.js` | `executeToolCall`: ejecuta cada herramienta contra los datos reales. |
| `js/services/bia/context.js` | Entrenos recientes, historial consultado y peso corporal para el contexto. |
| `js/services/bia/prompt.js` | `buildSystemInstruction`: personaje, reglas y contexto. |
| `js/voice/fit-agent.js` | Sesión de voz en el navegador (`FitAgent`, `getActiveAgent`): estado de la charla, micrófono (`SpeechRecognition`), avisos del entreno y herramientas. Elige el proveedor. |
| `js/voice/gemini-live.js` | Conexión con Gemini Live por WebSocket (voz Aoede): traduce su protocolo a los eventos de `FitAgent`. |
| `js/voice/openai-realtime.js` | Conexión con OpenAI Realtime por WebRTC (voz Coral): sesión temporal, canal de datos y herramientas. |
| `js/voice/pcm-player.js` | Cola de audio PCM16 a 24 kHz para las respuestas de Gemini. |
| `js/services/meals.js` | Diario de comidas: guardar, leer, resumir el día y lo que Bía consulta de las comidas. |
| `js/services/nutrition.js` | Cálculos puros: metas por objetivo, alimentos por 100 g, totales, porcentajes y nombre del plato. |
| `js/services/food-catalog.js` | Catálogo local de alimentos y lector de descripciones sin IA (`parseMealTextLocally`). |
| `js/services/meal-ai.js` | Análisis de comidas por foto o texto con Gemini u OpenAI: prompt, modelos, proveedor de respaldo y lectura de la respuesta. |
| `js/services/fit-chat.js` | Charla visible de Bía en `meta.fitChat`. |
| `js/services/water-reminders.js` | Recordatorios locales de agua tras la creatina. |
| `js/views/*.js` | Una pantalla por archivo: home, workout, history, progress, creatine, meals, agent, settings, appearance. |
| `js/views/agent/` | Partes de la pantalla Bía: alta de la clave (`key-setup.js`), plantilla (`chat-markup.js`), lista de mensajes y reportes (`messages.js`) y tarjetas de herramientas (`chat-cards.js`). |
| `js/views/workout/` | Partes de la pantalla Entreno que solo usa `workout.js`: estado entre repintados (`session.js`), plantillas (`markup.js`) y reloj del descanso (`rest.js`). |
| `js/services/session-plan.js` | Reglas puras del entreno en curso: descanso automático, título de una sesión, orden de la lista y siguiente paso de la rutina. |
| `js/utils/meal-scanner.js` | Hoja de foto → resultado, edición de gramos y guardado de una comida. |
| `js/utils/picker.js` | Hoja de las listas: la arma, la abre, la cierra y la llena. Cierra arrastrando con `sheet-drag.js`, como las demás hojas. |
| `js/utils/picker-find.js` | Buscador de la hoja de ejercicios: grupos, búsqueda sin tildes, orden por coincidencia y fila «Crear …». |
| `js/utils/picker-creator.js` | Alta de ejercicio dentro de la hoja. |
| `js/utils/text-match.js` | Búsqueda sin tildes y resaltado (pura). |
| `js/services/muscle-groups.js` | `inferMuscleGroup`: adivina el grupo de un ejercicio nuevo por su nombre. |
| `js/utils/sheet-drag.js` | Arrastrar hacia abajo para cerrar las hojas. |
| `js/utils/seg-swipe.js` | Controles `.seg` que se pulsan o arrastran. |
| `js/utils/units.js` | Conversión kg / lb. |
| `js/utils/dom.js`, `dates.js`, `icons.js`, `components.js` | Eventos, avisos, fechas, iconos SVG y piezas de interfaz compartidas. |
| `js/app-info.js` | Datos públicos del editor: correo de soporte y URL de la política de privacidad. |
| `js/services/bia/reports.js` | Reportes de respuestas de Bía (`meta.aiReports`) y el correo para enviarlos. |
| `js/utils/report-sheet.js` | Hoja para reportar una respuesta: motivo y comentario. |
| `js/utils/backup-nudge.js` | Aviso «Asegura tus PRs». |
| `js/utils/backup-export.js` | Compartir o descargar el respaldo y marcar `lastBackup`. |
| `js/utils/memories-panel.js` | Panel Recuerdos de Bía (perfil, rutina, notas con «Deshacer»); se abre desde Bía y desde Ajustes. |
| `js/utils/connection-panel.js` | Panel Conexión y clave (proveedor, modelo, claves, desconectar); se abre desde Bía, Ajustes y Recuerdos. |
| `js/utils/agent-sheet.js` | Hoja común de los paneles de Bía: abrir, cerrar, fondo y arrastre. |
| `js/utils/events.js` | Avisos entre capas (`EVENTS.EXERCISE_SELECTED`, `EVENTS.SET_LOGGED`) sin tocar el DOM. |
| `js/utils/image.js` | Comprimir la foto de una comida antes de analizarla. |
| `js/utils/exercise-editor.js` | Ficha para corregir o eliminar un ejercicio del atleta. |
| `js/utils/calendar.js` | Hoja del día. |
| `js/utils/time-sheet.js` | Hoja de la hora. Los minutos van de 5 en 5. |
| `js/utils/confirm-sheet.js` | Hoja de confirmación antes de borrar o acciones fuertes. |
| `js/utils/chart.js` | Gráfica SVG. |
| `js/utils/clock.js` | Reloj único. Las pruebas pueden adelantarlo. |
| `js/utils/set-line.js` | Botones de esfuerzo en la serie ya hecha. |
| `rpe-test.html` | Casos del esfuerzo, las herramientas de Bía y el respaldo sobre una base temporal. |
| `tests/*.test.js` | Pruebas de lógica pura con `node:test`. `npm test`. |
| `package.json` | Solo para las pruebas: `type: module` y el script `test`. Sin dependencias; no se publica. |
| `fonts/FugazOne-Regular.ttf` | Títulos. Licencia en `fonts/OFL.txt`. |
