# Bía

Registro personal de entrenamiento, creatina, peso corporal y comidas, con una asistente de voz que también se llama Bía.
PWA en HTML, CSS y JavaScript puro: sin frameworks, sin dependencias y sin paso de compilación.
Funciona offline y guarda todo en el teléfono (IndexedDB). Objetivo: publicarla en Google Play Store.

La descripción completa y al día del sistema (pantallas, datos, reglas, Bía) está en [SISTEMA.md](SISTEMA.md).

## Qué incluye

- **Inicio:** botón de creatina de un toque (con "Deshacer"), racha, resumen semanal, últimos entrenos.
- **Entreno:** sesión activa con cronómetro, series (peso, repeticiones, RPE), autocompletado con la última serie, temporizador de descanso con vibración, ejercicios propios.
- **Historial:** todos los entrenamientos y su detalle.
- **Progreso:** récord de peso, gráfico (1RM estimado, peso máximo o volumen) y peso corporal.
- **Creatina:** calendario mensual, rachas, últimos 7 y 30 días, tomas pasadas y borrado.
- **Ajustes:** descanso, recordatorios de agua, asegurar PRs (compartir o descargar JSON) / restaurar, instalar, borrar todo. La unidad kg/lb se cambia en Entreno o Progreso.

## Estructura

```
index.html            punto de entrada y barra de navegación
manifest.webmanifest  nombre, colores e iconos de la app instalada
sw.js                 service worker (offline)
css/                  tokens.css (colores) · base.css · components/01-…14-….css (en orden)
icons/                iconos PNG y SVG
js/
  main.js             arranque: BD, datos iniciales, ajustes, router, service worker
  router.js           router por hash (#/workout, #/progress/3, ...)
  db.js               ÚNICO archivo que conoce IndexedDB (esquema y migraciones)
  store.js            ajustes del usuario
  services/           lógica de negocio: workouts, effort, creatine, body, meals, seed, backup, agent (Bía), fit-chat, water-reminders
  views/              una pantalla por archivo: home, workout, history, progress, creatine, meals, agent, settings, appearance
  utils/              dates, dom (eventos, avisos), chart (gráfico SVG)
```

Flujo de dependencias (nunca al revés): `views → services → db`.

## Probarlo en tu computadora

El service worker solo funciona en `localhost` o con HTTPS (abrir el archivo con doble clic no sirve):

```
cd "Bía"
python3 -m http.server 8000
```

Abre http://localhost:8000. Para probar desde el teléfono en la misma red, usa la IP de tu PC,
aunque la instalación y el modo offline requieren HTTPS (siguiente sección).

## Pruebas

```
npm test
```

Corre las pruebas de lógica de `tests/` con Node (sin instalar nada). Las de esfuerzo con base de datos están en `rpe-test.html`: ábrelo con el servidor local.

## Publicarlo y usarlo en el teléfono

Necesitas HTTPS. Las opciones gratuitas más simples:

1. **GitHub Pages:** sube la carpeta a un repositorio, en *Settings → Pages* elige la rama `main` y la carpeta raíz.
2. **Netlify Drop:** arrastra la carpeta a https://app.netlify.com/drop.

Después, en Android abre la URL con **Chrome**, menú ⋮ → **Instalar aplicación** (o el botón en *Ajustes* de la app).
Quedará en la pantalla de inicio, a pantalla completa y funcionando sin internet.

## Actualizar la app

Edita los archivos y súbelos de nuevo. El service worker va a la red primero: con conexión sirve lo publicado
y guarda una copia; sin conexión usa esa copia.
Si añades archivos nuevos, agrégalos a `ASSETS` en `sw.js` y sube `VERSION`.

## Tus datos

- Viven solo en el navegador de ese teléfono. Si borras los datos del sitio o desinstalas el navegador, se pierden.
- Haz un respaldo en **Ajustes → Exportar respaldo** cada cierto tiempo y guárdalo en tu nube.
- Importar reemplaza todo, de forma atómica: si el archivo falla, no se cambia nada.

## Cómo extenderla

- **Otro suplemento (proteína, cafeína):** la tabla `supplements` ya tiene el campo `tipo`; copia `services/creatine.js` cambiando `TIPO`.
- **Nuevos campos o tablas:** sube `DB_VERSION` en `db.js` y agrega un bloque `if (old < 2) { ... }` en `migrate()`. Los datos existentes se conservan.
- **Nueva pantalla:** crea `views/nombre.js` con `export async function render(el, params)`, regístrala en `router.js` y añade el enlace en `index.html`.

## Modelo de datos

| Tabla | Campos |
|---|---|
| `exercises` | id, nombre (único), grupo |
| `workouts` | id, fecha, startedAt, finishedAt, duracion, notas |
| `sets` | id, workoutId, exerciseId, peso, reps, rpe?, ts |
| `supplements` | id, tipo, fecha, hora, cantidad, ts |
| `bodyMetrics` | id, fecha, peso, ts |
| `meta` | key, value (ajustes, entrenamiento activo, marcas internas) |

El 1RM estimado usa la fórmula de Epley: `peso × (1 + reps / 30)`.
