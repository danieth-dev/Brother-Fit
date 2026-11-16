---
name: Bía
description: Sistema visual de Bía. Negro OLED y amarillo eléctrico, una sola mano, números grandes, cero ruido.
colors:
  bg: "#0A0A0A"
  surface: "#1E1E1E"
  surface-2: "#262626"
  surface-elevated: "#2F2F2F"
  line: "#2A2A2A"
  line-strong: "#3D3D3D"
  line-accent: "rgba(255, 230, 0, 0.28)"
  text: "#FFFFFF"
  muted: "#A1A1A1"
  text-dim: "#71717A"
  primary: "#FFE600"
  primary-hover: "#F5DC00"
  primary-active: "#D6C000"
  primary-ink: "#07080A"
  yellow-dim: "rgba(255, 230, 0, 0.12)"
  green: "#10B981"
  green-ink: "#022C22"
  red: "#F43F5E"
  blue: "#38BDF8"
  orange: "#FB923C"
  purple: "#C084FC"
typography:
  display:
    fontFamily: '"Fugaz One", ui-rounded, "SF Pro Rounded", system-ui, sans-serif'
    fontSize: "2.25rem"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  headline:
    fontFamily: '"Fugaz One", ui-rounded, "SF Pro Rounded", system-ui, sans-serif'
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  body:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.05em"
  numeric:
    fontFamily: 'ui-monospace, "SF Mono", "Roboto Mono", monospace'
    fontSize: "2.75rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.04em"
rounded:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  base: "16px"
  lg: "20px"
  xl: "24px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-ink}"
    rounded: "{rounded.md}"
    padding: "0 22px"
    height: "52px"
  button-secondary:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "0 22px"
    height: "52px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.md}"
    height: "52px"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.red}"
    rounded: "{rounded.md}"
    height: "52px"
  field:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "48px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "20px"
  row:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "18px 20px"
  sheet:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl} {rounded.xl} 0 0"
    padding: "8px 16px 16px"
  tabbar-island:
    backgroundColor: "{colors.surface-elevated}"
    rounded: "28px"
    padding: "6px"
  toast:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "15px 18px"
---

# Bía — sistema visual

Este documento es la fuente de verdad del diseño de Bía. Lo leen las personas y los agentes (la skill `impeccable` lo carga junto con `PRODUCT.md`) antes de tocar cualquier pantalla. Si el CSS y este archivo no coinciden, uno de los dos está mal: se corrige en el mismo cambio.

Fuente de los valores: `css/tokens.css` (tokens), `css/base.css` (página, tipografía base e iconos) y `css/components/01-…css` a `14-…css` (componentes, cargados en ese orden desde `index.html`). El frontmatter de arriba usa el formato de `DESIGN.md` que entiende la skill; los valores son los del **modo oscuro con acento amarillo**, que es el de fábrica.

Última revisión: 15 de noviembre de 2026 (caché `v192`).

## 1. Idea

Bía se usa en el gimnasio, entre series, con una mano sudada y poco tiempo. El diseño responde a eso:

- **Negro OLED y un solo color de acción.** El fondo casi negro ahorra batería y no deslumbra bajo luces de sala. El amarillo eléctrico marca lo único que hay que tocar.
- **Los números mandan.** Peso, reps, descanso y racha se leen a un brazo de distancia: grandes, en cifras tabulares, sin decoración alrededor.
- **Plano y técnico.** Inspiración: discos calibrados, maquinaria negra mate, marcas de precisión. Sin degradados de color, sin brillos, sin emojis.
- **Táctil antes que bonito.** Ningún control interactivo baja de 44 px; los principales tienen 48–52 px.

Modo de la skill: **Operate**. La app es una herramienta; la marca vive en los detalles precisos, no en la decoración.

## 2. Color

Todo color sale de un token de `css/tokens.css`. Un componente nunca escribe un hex ni un `rgba()` del acento: usa `var(--primary)`, `var(--yellow-dim)`, `var(--line-accent)`, etc. Así los modos y acentos funcionan sin tocar el componente.

### Modo oscuro (de fábrica)

| Token | Valor | Uso |
| --- | --- | --- |
| `--bg` | `#0a0a0a` | Lienzo de la página. |
| `--surface` | `#1e1e1e` | Tarjetas, filas, hojas, segmentos. |
| `--surface-2` | `#262626` | Campos, botón secundario, chips. |
| `--surface-elevated` | `#2f2f2f` | Isla de navegación, avisos, hover de botón. |
| `--line` | `#2a2a2a` | Bordes y divisores. |
| `--line-strong` | `#3d3d3d` | Bordes en hover, borde de la isla y de las hojas, barrita de arrastre. |
| `--line-accent` | acento al 28 % | Bordes que deben teñirse con el acento. |
| `--text` | `#ffffff` | Texto principal. |
| `--muted` | `#a1a1a1` | Etiquetas, fechas, texto secundario. |
| `--text-dim` | `#71717a` | Placeholders, estados inactivos. |
| `--primary` / `--yellow` | `#ffe600` | La acción principal, la pestaña activa, la pastilla del segmento, el foco. |
| `--primary-hover` / `--primary-active` | `#f5dc00` / `#d6c000` | Respuesta al tocar. |
| `--primary-ink` / `--yellow-ink` | `#07080a` | Texto e iconos **sobre** el acento. |
| `--yellow-dim` | acento al 12 % | Fondo del descanso, chips de aviso, halos de foco. |
| `--primary-glow` | `0 0 24px` acento al 22 % | Solo en el aviso (toast). |
| `--accent-faint` | acento al 6 % (`color-mix`) | Fondos muy suaves: hover de botones discontinuos, tarjeta objetivo. |
| `--line-accent-strong` | acento al 45 % (`color-mix`) | Borde del primario y bordes de aviso marcados. |
| `--focus-ring` | `0 0 0 3px` acento al 22 % | Halo de foco de campos y botones de hoja. |

Los tres últimos se calculan desde `--primary` en `:root`, así que siguen solos al modo claro y a los acentos sin redefinirse. Para un tinte nuevo del acento se usa uno de estos tokens o se añade otro con `color-mix(in srgb, var(--primary) N%, transparent)`; nunca un `rgba()` con el color escrito.

`--swatch-amarillo`, `--swatch-azul` y `--swatch-rosado` son los colores fijos de las muestras en Aspecto: enseñan cada opción, no el acento activo, y no deben usarse en otro sitio.

### Colores de estado

| Token | Valor | Uso |
| --- | --- | --- |
| `--green` / `--green-dim` / `--green-ink` | `#10b981` | Hecho: creatina tomada, serie efectiva, calorías de Comidas. |
| `--red` / `--red-dim` / `--red-ink` | `#f43f5e` | Borrar, zona de riesgo, aviso de error. |
| `--blue`, `--orange`, `--purple` (+ `-dim`) | `#38bdf8`, `#fb923c`, `#c084fc` | Acentos secundarios de datos. |
| `--white` | `#f8fafc` | Punto de grupo muscular sin grupo. |
| `--macro-proteina`, `--macro-carbos`, `--macro-grasa` | `#4db8ff`, `#ff9f43`, `#b38cff` | Barras y puntos de macros en Comidas. Iguales en los dos modos. |

### Modo claro (`html[data-modo="claro"]`)

Fondo `#edf0f5`, superficies blancas, texto `#090b0f`, bordes `#cbd5e1`. El amarillo no se lee sobre blanco, así que el acento pasa a **ámbar `#b45309`** con texto blanco encima. Las sombras pasan a pizarra suave. `modo: "sistema"` sigue a `prefers-color-scheme`. `meta[name="theme-color"]` se sincroniza con el modo efectivo (`#07080a` o `#edf0f5`) desde `js/store.js`.

### Acentos (`html[data-tema]`)

Solo cambian los tokens de acento (`--primary*`, `--yellow*`, `--line-accent`, `--primary-glow`):

| Acento | Oscuro | Claro |
| --- | --- | --- |
| Amarillo (sin atributo) | `#ffe600`, tinta negra | `#b45309`, tinta blanca |
| Azul (`azul`) | `#5ec4ff`, tinta negra | `#0369a1`, tinta blanca |
| Rosado (`rosado`) | `#ff7ad1`, tinta negra | `#be185d`, tinta blanca |

Regla de contraste: sobre el acento siempre va `--primary-ink`. Nunca texto blanco sobre amarillo, azul claro o rosado claro.

### Grupos musculares

Cada grupo tiene un color fijo, igual en los dos modos, para el punto (`.dot`, `.muscle-dot`) junto al nombre del ejercicio:

| Grupo | Color |
| --- | --- |
| Pecho | `#ff6b7a` |
| Espalda | `#2ec4b6` |
| Piernas | `#ffd166` |
| Hombros | `#7ed957` |
| Bíceps (y Brazos) | `#4d8dff` |
| Tríceps | `#ff9f43` |
| Core | `#b38cff` |
| Cardio | `#00c49f` |
| Otro | `#a8a8a8` (y no se muestra el nombre del grupo) |

Hoy estos colores viven escritos en `css/components/04-series-descanso.css`. Las rutinas semanales guardadas antes de la `v189` traen además un `dot` con su hex; las nuevas no, y su punto usa `--line-strong`. Ver «Deuda conocida».

## 3. Tipografía

Tres voces, cada una con un trabajo:

| Voz | Familia | Dónde |
| --- | --- | --- |
| **Display** | `--font-display`: Fugaz One (archivo local `fonts/FugazOne-Regular.ttf`, licencia OFL) | Solo `h1`, `h2`, `h3` y `.section-title`. |
| **Interfaz** | `--font`: fuente del sistema | Cuerpo, etiquetas, botones, campos, números normales. |
| **Reloj** | `--font-mono`: monoespaciada del sistema | Cronómetro de sesión (`.elapsed`), descanso, campos técnicos. |

Reglas de Fugaz One: un único peso real (400) y `font-synthesis: none`. Nunca se le pide 700/800: el navegador inventaría una negrita falsa. Nunca se usa para números, etiquetas ni párrafos.

Todo valor que cambia (peso, reps, tiempo, kcal, racha) lleva `font-variant-numeric: tabular-nums` (clase `.num`) para que no baile.

### Escala

| Token | Valor | Uso |
| --- | --- | --- |
| `--fs-2xs` | 11 px | Etiquetas de la isla de navegación. |
| `--fs-xs` | 12 px | Etiquetas de campo en mayúsculas, chips, metadatos. |
| `--fs-xs-plus` | 13 px | Texto secundario de filas, subtítulos de tarjeta, etiquetas de campo en paneles. |
| `--fs-sm` | 14 px | Texto secundario, botones compactos, avisos. |
| `--fs-sm-plus` | 15 px | Títulos de fila (Ajustes, Recuerdos), botones secundarios, valores de lista. |
| `--fs-base` | 16 px | Cuerpo, campos, botones. |
| `--fs-md` | 18 px | `h3`, títulos de sección. |
| `--fs-lg` | 20 px | `h2`. |
| `--fs-xl` | 24 px | Descanso, cifras de tarjeta. |
| `--fs-2xl` | 30 px | Cifras destacadas. |
| `--fs-3xl` | 36 px | `h1`, PR. |
| `--fs-hero` | 44 px | Cronómetro de sesión. |

Etiquetas de campo y de sección: `--fs-xs`, peso 600–700, mayúsculas, `letter-spacing: 0.05em`, color `--muted`.

## 4. Espacio y layout

- **Columna única** de 560 px como máximo, centrada (`#app`). Márgenes laterales de 18 px o el área segura, lo que sea mayor.
- **Áreas seguras**: arriba, abajo y a los lados se suma `env(safe-area-inset-*)`. El final de la página deja sitio para la isla (`--tabbar-h: 92px`) más 28 px.
- **Ritmo**: 4, 8, 12, 16, 20, 24 y 32 px. 12 px entre filas de una lista, 16 px entre campos (`.stack`), 32 px antes de un título de sección. Hoy no hay tokens de espacio en CSS: se escribe el valor de esta escala, nunca uno fuera de ella.
- **Sin zoom con dos dedos** y sin rebote de scroll en `html`/`body`. Las listas internas sí desplazan, con `overscroll-behavior: contain`.

## 5. Forma y profundidad

| Token | Valor | Uso |
| --- | --- | --- |
| `--r-xs` | 4 px | Detalles mínimos. |
| `--r-sm` | 8 px | Campos, botón compacto, pastilla del segmento. |
| `--r-md` | 12 px | Botones, segmentos, descanso, avisos. |
| `--r-lg` | 16 px | Tarjetas de entreno reciente. |
| `--r-xl` | 20 px | Tarjetas de formulario, filas, hojas inferiores. |
| `--r-full` | 9999 px | Chips, barrita de arrastre, discos y anillos. |

La isla de navegación usa 28 px por fuera y 22 px en cada pestaña.

Profundidad con sombras neutras de contacto, nunca de color: `--shadow-sm` (filas y tarjetas), `--shadow-md` (descanso, hover del primario), `--shadow-lg` (isla, hojas, avisos). La única luz de color es `--primary-glow`, y solo en el aviso.

## 6. Movimiento

- Entrada de pantalla: fundido de 180 ms, `cubic-bezier(0.16, 1, 0.3, 1)`.
- Respuesta al tocar: `transform: scale(0.98)` en botones, `0.92` en la isla; transiciones de color de 140–160 ms.
- Hojas: suben en 250 ms con la misma curva; el fondo se oscurece a negro al 72 %. Se cierran arrastrando la barrita (`js/utils/sheet-drag.js`).
- Pastilla del segmento: 200 ms; sigue al dedo mientras se arrastra (`js/utils/seg-swipe.js`).
- `prefers-reduced-motion: reduce` deja todas las animaciones y transiciones en 0,01 ms.

## 7. Iconos

Un único juego propio en `js/utils/icons.js`: SVG de 24×24, trazo de 2 px, puntas y uniones redondeadas, `currentColor`, `aria-hidden="true"`. Se piden como `icons.nombre({ size })`. No se usan fuentes de iconos, emojis ni caracteres Unicode como icono. El ícono de la app (`icons/icon.svg`) es un disco: anillos amarillos sobre negro.

## 8. Componentes

Cada componente existe una vez en `css/components/` y las pantallas lo reutilizan. Antes de crear una clase nueva, se busca la existente.

Los archivos se cargan en orden numérico y **ese orden es la cascada**: una regla de `13-progreso.css` gana a una igual de `01-controles.css`. Un componente compartido va en el archivo de su familia (01–05); uno de una sola pantalla, en el de esa pantalla.

| Archivo | Qué contiene |
| --- | --- |
| `01-controles.css` | Encabezados, botones, formularios, hojas de listas (picker), calendario, hora y confirmación. |
| `02-listas-chips.css` | Listas, filas, estadísticas y chips. |
| `03-inicio.css` | Disco de creatina, pastillas, tarjeta de entreno y últimos entrenos. |
| `04-series-descanso.css` | Puntos de grupo muscular, series del entreno y descanso. |
| `05-segmento-isla-aviso.css` | Segmento, gráfica, isla de navegación y aviso. |
| `06-creatina.css` | Pantalla de creatina, calendario y estado vacío. |
| `07-bia.css` | Chat de Bía, paneles Recuerdos y Conexión, reporte de respuestas. |
| `08-entreno.css` | Estado e inicio del entreno, rutina guiada, confirmación enriquecida, volver, segmento de 3. |
| `09-detalle-entreno.css` | Detalle de un entrenamiento y editor de serie. |
| `10-historial.css` | Historial. |
| `11-ajustes.css` | Ajustes. |
| `12-aspecto.css` | Aspecto. |
| `13-progreso.css` | Progreso. |
| `14-comidas.css` | Comidas, su tarjeta en Inicio y el escáner. |

| Componente | Clase | Especificación |
| --- | --- | --- |
| Botón | `.btn` | Alto mínimo 52 px, relleno horizontal 22 px, `--r-md`, peso 700, fondo `--surface-2`, borde `--line`. |
| Primario | `.btn-primary` | Fondo `--primary`, texto `--primary-ink`. Uno por pantalla: la acción principal. |
| Silencioso | `.btn-quiet` | Transparente, texto `--muted`, borde `--line`. |
| Peligro | `.btn-danger` | Transparente con borde y texto `--red`; relleno rojo al confirmar. |
| Compacto | `.btn-sm` | Alto 48 px, `--r-sm`, `--fs-sm`. |
| Botón icono | `.btn-x`, `.head-link` | 48×48 (44 en cabecera), sin borde hasta el hover. |
| Campo | `.field` | Etiqueta en mayúsculas `--fs-xs`; input de 48 px, `--surface-2`, `--r-sm`, cifras tabulares. Foco: borde `--primary` y halo del acento. |
| Lista nativa | `.picker-*` | Los `<select>`, fechas y horas no abren el menú del sistema: abren una hoja propia (`js/utils/picker.js`, `calendar.js`, `time-sheet.js`). |
| Hoja inferior | `.picker-sheet` y similares | Panel `--surface` de hasta 560 px, esquinas superiores `--r-xl`, barrita de 44×5 px, vive en `document.body`. Confirmaciones con `js/utils/confirm-sheet.js`. |
| Segmento | `.seg` + `.seg-thumb` | Fondo `--surface`, padding 4 px, `--r-md`; la opción activa es una pastilla `--primary` que se arrastra. |
| Isla de navegación | `.tabbar` | Flotante abajo, `--surface-elevated`, borde `--line-strong`, desenfoque 12 px. Pestaña activa en `--primary`. Se oculta dentro de la pantalla de la asistente. |
| Aviso | `#toast` | Píldora `--surface-elevated` con borde `--primary` completo y `--primary-glow`. `tone: 'danger'` cambia el borde a `--red`. |
| Fila y tarjeta | `.row`, `.form-card`, `.recent-workout-card` | `--surface`, `--r-xl` (16 px en recientes), `--shadow-sm`, sin borde salvo en recientes. |
| Chip | `.chip`, `.chip-ok`, `.chip-warn` | Píldora de 12 px; verde para hecho, acento para aviso. |
| Disco de creatina | `.plate` | Disco olímpico: aros concéntricos del acento (`--c`) sobre ranuras oscuras, hasta 248 px. `.plate.done` cambia `--c` a `--green`. Versión compacta en Inicio según ajuste. |
| Descanso | `.rest` | Banda `--yellow-dim` con borde del acento, tiempo en mono `--fs-xl`. |
| Punto muscular | `.dot`, `.muscle-dot` | 8–9 px con el color del grupo. |
| Anillo de calorías | `.meal-ring-svg`, `.home-food-ring` | SVG con trazo verde sobre `--line`; cifra central en `--text`. |
| Estado vacío | `.empty` y variantes | Texto `--muted` centrado y una sola acción primaria. |
| Reportar respuesta | `.agent-bubble-actions`, `.agent-bubble-report`, `.agent-bubble-bot.is-reported` | Al tocar una burbuja de Bía aparece una píldora de 44 px con bandera; una burbuja reportada queda con borde discontinuo y texto `--muted`. La hoja usa las clases `.picker-*`. |
| Barra de progreso | `.creatine-sat-fill`, `.home-food-protein-fill`, `.meals-macro-fill--*` | Ancho con `style="--pct: N%"`; color por token (`--green`, `--macro-proteina`, `--macro-carbos`, `--macro-grasa`). |
| Dato sin definir | `.agent-rec-value.is-empty`, `.agent-rec-day-text.is-empty` | «Sin definir» o «Descanso» en `--text-dim`, peso 500: el atleta ve que falta y nada se inventa. |

## 9. Accesibilidad

- Contraste AA como mínimo; el texto sobre el acento usa siempre la tinta del acento.
- Foco visible: contorno de 2 px en `--primary` (`:focus-visible`).
- Objetivos táctiles de 44 px o más; los frecuentes, 48–52 px.
- Todo botón de solo icono lleva `aria-label`. Los iconos son `aria-hidden`.
- El menú de pulsación larga del navegador nunca aparece sobre botones ni vínculos (`base.css` y `main.js`).
- Respeta `prefers-reduced-motion`.

## 10. Sí y no

**Sí**
- Usar tokens para todo color, radio, tamaño de letra y sombra.
- Una sola acción primaria amarilla por pantalla.
- Cifras tabulares en todo valor que cambie.
- Fugaz One solo en títulos y a peso 400.
- Probar cada cambio en modo oscuro y claro y con los tres acentos.

**No**
- Hex o `rgba()` del acento dentro de un componente: rompe azul, rosado y modo claro.
- `style="..."` en el HTML que generan las vistas: el estilo va en una clase. Única excepción: un **dato** que el CSS no puede conocer, pasado como variable (`style="--pct: 40%"` para el ancho de una barra, `--dot` para el color guardado de un día de la rutina). Mostrar u ocultar se hace con el atributo `hidden`, nunca con `style.display`.
- `!important` para ganar a otra regla: se corrige la especificidad.
- Degradados de color, sombras de color, emojis o iconos de otra librería.
- Texto blanco sobre el acento en modo oscuro.

## 11. Deuda conocida

Medida el 15 de noviembre de 2026. Cada cambio que toque una de estas zonas la deja mejor, y esta lista se actualiza.

Resuelto en la `v192`: 13 y 15 px entraron a la escala como `--fs-xs-plus` y `--fs-sm-plus`; sus 69 usos pasaron a token sin cambio visual.

Resuelto en la `v191`: los 89 `style="…"` del JS pasaron a clases, `hidden` o variables de dato (quedan 6, todos `--pct`/`--dot`); los colores fijos del JS (macros, anillos, estados, chevrons) pasaron a tokens (`--macro-*`, `.ring-progress`, `.settings-dot--*`, `.icon-muted`, `.icon-ok`); 118 `font-size` que coincidían exactamente con la escala pasaron a token; y `components.css` se partió en 14 archivos por sección, en el mismo orden. Se comprobó comparando los estilos calculados de cada elemento antes y después en todas las pantallas, en oscuro y claro.

Resuelto: el amarillo escrito a mano en `components.css` (22 usos que dejaban bordes y halos amarillos con acento azul o rosado) pasó a tokens del acento en la `v186`, y se borró el bloque `.tema-pick`, que no se usaba.

| Problema | Hoy | Meta |
| --- | --- | --- |
| Hex y `rgba()` sueltos en `css/components/` | 93 hex y 39 `rgba()` | Tokens o, si es propio de un componente, una variable local documentada |
| `font-size` escrito en px/rem en vez de token | 52 frente a 305 con token. Ninguno pasa de 6 usos: 17 px (6), 13,5 px (6), 32 px, 22 px, 19 px, 14,5 px, 11,5 px y varios en rem. | Llevar cada uno al token más cercano al tocar su componente, comprobándolo a la vista. |
| `!important` en `css/components/` | 156 | Solo en `[hidden]` y en movimiento reducido |
| Colores de grupo muscular escritos en CSS, y `dot` con hex en rutinas guardadas antes de la `v189` | Literales | Tokens `--g-pecho`, etc., y la rutina coloreada por grupo, sin hex guardado |
| Selectores repetidos (`.field`, `.compare-card`, `.compare-row`…) en distintos puntos de la cascada | Varios | Una sola definición por selector |

## 12. Cómo se mantiene

- Un cambio visual (token, componente, pantalla nueva, modo, acento, icono, fuente) actualiza este archivo **en el mismo commit**.
- Si se añade un token, va primero a `css/tokens.css` y después a la tabla de este archivo y al frontmatter si es de modo oscuro/amarillo.
- La revisión de diseño se hace con la skill `impeccable` (`.agents/skills/impeccable/`), que lee este archivo y `PRODUCT.md`.
- Se actualiza la fecha de «Última revisión».
