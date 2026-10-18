# Brother Fit

Registro personal de entrenamiento y creatina. PWA en HTML, CSS y JavaScript puro:
sin frameworks, sin dependencias y sin paso de compilación. Funciona offline y guarda
todo en el teléfono (IndexedDB).

## Qué incluye

- **Inicio:** botón de creatina de un toque (con "Deshacer"), racha, resumen semanal, últimos entrenos.
- **Entreno:** sesión activa con cronómetro, series (peso, repeticiones, RPE), autocompletado con la última serie, temporizador de descanso con vibración, ejercicios propios.
- **Historial:** todos los entrenamientos y su detalle.
- **Progreso:** récord de peso, gráfico (1RM estimado, peso máximo o volumen) y peso corporal.
- **Creatina:** calendario mensual, rachas, últimos 7 y 30 días, tomas pasadas y borrado.
- **Ajustes:** gramos por toma, descanso, unidad, exportar/importar respaldo JSON, instalar, borrar todo.

## Estructura

```
index.html            punto de entrada y barra de navegación
manifest.webmanifest  nombre, colores e iconos de la app instalada
sw.js                 service worker (offline)
css/                  tokens.css (colores) · base.css · components.css
icons/                iconos PNG y SVG
js/
  main.js             arranque: BD, datos iniciales, ajustes, router, service worker
  router.js           router por hash (#/workout, #/progress/3, ...)
  db.js               ÚNICO archivo que conoce IndexedDB (esquema y migraciones)
  store.js            ajustes del usuario
  services/           lógica de negocio: workouts, creatine, body, seed, backup
  views/              una pantalla por archivo: home, workout, history, progress, creatine, settings
  utils/              dates, dom (eventos, avisos), chart (gráfico SVG)
```

Flujo de dependencias (nunca al revés): `views → services → db`.

## Probarlo en tu computadora

El service worker solo funciona en `localhost` o con HTTPS (abrir el archivo con doble clic no sirve):

```
cd brother-ft
python3 -m http.server 8000
```

Abre http://localhost:8000. Para probar desde el teléfono en la misma red, usa la IP de tu PC,
aunque la instalación y el modo offline requieren HTTPS (siguiente sección).

## Publicarlo y usarlo en el teléfono

Necesitas HTTPS. Las opciones gratuitas más simples:

1. **GitHub Pages:** sube la carpeta a un repositorio, en *Settings → Pages* elige la rama `main` y la carpeta raíz.
2. **Netlify Drop:** arrastra la carpeta a https://app.netlify.com/drop.

Después, en Android abre la URL con **Chrome**, menú ⋮ → **Instalar aplicación** (o el botón en *Ajustes* de la app).
Quedará en la pantalla de inicio, a pantalla completa y funcionando sin internet.

## Actualizar la app

Edita los archivos y súbelos de nuevo. El service worker usa *stale-while-revalidate*: la app abre al instante
con la copia guardada y descarga la nueva en segundo plano, que se usa en la siguiente apertura.
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
