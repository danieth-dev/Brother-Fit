---
name: Brother Fit
description: Sistema de diseño atlético de alto rendimiento en Negro Carbón y Amarillo Eléctrico
colors:
  primary: "#FFE600"
  primary-hover: "#E6CF00"
  primary-ink: "#0A0B0E"
  neutral-bg: "#0A0B0E"
  surface: "#13151A"
  surface-2: "#1C2028"
  surface-elevated: "#252B37"
  line: "#2A303D"
  line-strong: "#3B4456"
  text: "#F8FAFC"
  muted: "#94A3B8"
  text-dim: "#64748B"
  yellow: "#FFE600"
  yellow-dim: "rgba(255, 230, 0, 0.12)"
  green: "#10B981"
  green-dim: "rgba(16, 185, 129, 0.3)"
  green-ink: "#022C22"
  red: "#F43F5E"
  blue: "#38BDF8"
  orange: "#FB923C"
typography:
  display:
    fontFamily: 'ui-rounded, "SF Pro Rounded", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: "2.25rem"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  headline:
    fontFamily: 'ui-rounded, "SF Pro Rounded", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  body:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  numeric:
    fontFamily: 'ui-rounded, "SF Pro Rounded", system-ui, sans-serif'
    fontSize: "1.75rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.025em"
rounded:
  xs: "3px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "14px"
  lg: "20px"
  xl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-ink}"
    rounded: "{rounded.md}"
    padding: "0 22px"
    height: "52px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.primary-ink}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.md}"
    padding: "0 18px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "18px"
---

# Design System: Brother Fit

## Overview

Brother Fit es una herramienta atlética enfocada en la fuerza, la constancia y el rendimiento físico. Su diseño está inspirado en la estética industrial del gimnasio de alto rendimiento: pesas olímpicas calibradas, maquinaria negra mate y marcas de precisión en amarillo eléctrico.

La combinación de **Negro Carbón (`#0A0B0E`)** y **Amarillo Eléctrico (`#FFE600`)** transmite dinamismo, energía y enfoque. Todo elemento en la pantalla tiene una función clara, máxima legibilidad a distancia y superficies táctiles generosas preparadas para el uso en medio de una sesión de entrenamiento intensa.

## Colors

### Paleta Principal (Dark Athletic Core)

- **Canvas Principal (`--bg` / `neutral-bg`):** `#0A0B0E` — Negro profundo con ligero matiz carbón, reduce el consumo de batería en pantallas OLED y minimiza reflejos bajo luces de gimnasio.
- **Superficie Base (`--surface`):** `#13151A` — Nivel base para tarjetas, formularios y barra de navegación inferior.
- **Superficie Secundaria (`--surface-2`):** `#1C2028` — Fondos de inputs, botones secundarios y selector segmentado.
- **Superficie Elevada (`--surface-elevated`):** `#252B37` — Elementos flotantes como avisos (toasts) y menús.
- **Bordes y Divisores (`--line`):** `#2A303D` — Separación nítida entre filas y tarjetas sin generar ruido visual.
- **Bordes de Enfoque (`--line-strong`):** `#3B4456` — Contornos definidos para botones en hover e inputs activos.

### Color de Acción e Identidad (Electric Yellow)

- **Primario de Acción (`--primary` / `yellow`):** `#FFE600` — Amarillo eléctrico de alta energía y visibilidad instantánea.
- **Texto sobre Primario (`--primary-ink`):** `#0A0B0E` — Negro carbón sólido que garantiza un ratio de contraste superior a **13:1** (supera holgadamente el estándar WCAG AAA de 7:1).
- **Primario Activo/Hover (`--primary-hover`):** `#E6CF00` — Variación con respuesta táctil inmediata.
- **Tinte de Descanso (`--yellow-dim`):** `rgba(255, 230, 0, 0.14)` — Fondo suave para el banner del temporizador de descanso.

### Tipografía y Jerarquía Textual

- **Texto Principal (`--text`):** `#F3F5F9` — Blanco neutro suave para lectura descansada.
- **Texto Secundario (`--muted`):** `#9EA7B5` — Gris plateado legible para etiquetas, fechas y notas.
- **Texto Atenuado (`--text-dim`):** `#6B7688` — Indicadores inactivos o fechas futuras.

### Colores de Estado Semántico y Grupos Musculares

- **Éxito / Completado (`--green`):** `#22C55E` / Texto: `#052E16` (Series finalizadas, creatina tomada).
- **Peligro / Alerta (`--red`):** `#EF4444` (Borrado de datos, cancelación de serie).
- **Acento Piernas (`--blue`):** `#38BDF8` (Código de color por grupo muscular).
- **Acento Brazos (`--orange`):** `#F97316` (Código de color por grupo muscular).

## Typography

El sistema tipográfico prioriza la **densidad numérica clara** y el **peso atlético contundente**:

- **Familia Display / Titulares:** `ui-rounded, "SF Pro Rounded", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` para titulares, cronómetros y marcas numéricas.
- **Familia Body:** `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` para formularios, etiquetas y descripciones.
- **Números Tabulares (`font-variant-numeric: tabular-nums`):** Obligatorio en cronómetros, pesos, repeticiones y tablas.

### Escala Tipográfica Estandarizada

| Token CSS | Valor | Uso Principal |
|---|---|---|
| `--fs-xs` | `0.75rem` (12px) | Etiquetas de la barra inferior, días de semana, stats |
| `--fs-sm` | `0.875rem` (14px) | Subtítulos, encabezados de tabla, botones compactos, inputs |
| `--fs-base` | `1.0rem` (16px) | Cuerpo de texto, filas de series, botones principales |
| `--fs-md` | `1.125rem` (18px) | Títulos de sección, subtítulos destacados |
| `--fs-lg` | `1.25rem` (20px) | Encabezados H2 |
| `--fs-xl` | `1.5rem` (24px) | Disco de creatina, iconos de acción |
| `--fs-2xl` | `1.75rem` (28px) | Estadísticas numéricas destacadas |
| `--fs-3xl` | `2.25rem` (36px) | Título principal H1, récord 1RM |
| `--fs-hero` | `2.6rem` (42px) | Cronómetro de descanso gigante |

## Layout

- **Estructura Móvil Centralizada:** La aplicación está concebida como PWA móvil con contenedor máximo centrado a `560px` en pantallas anchas.
- **Zonas Seguras (`safe-area-inset`):** Integración nativa con notch y áreas de gestos táctiles.
- **Barra de Navegación Inferior Fija:** Altura de `64px` con desenfoque de fondo (`backdrop-filter: blur(16px)`).
- **Espaciado Modular:** Separaciones de `16px` entre campos y bloques secundarios; `24px` a `32px` entre secciones principales.

## Elevation & Depth

- **Capa 0 (Canvas):** `#0A0B0E`.
- **Capa 1 (Tarjetas y Tabbar):** `#13151A` con borde de `1px solid #2A303D`.
- **Capa 2 (Inputs y Botones):** `#1C2028` con borde `1px solid #2A303D`.
- **Sombra Tonal Elevada:** `0 4px 16px -2px rgba(0, 0, 0, 0.55)`.
- **Resplandor Amarillo (`--primary-glow`):** `0 4px 18px -2px rgba(255, 230, 0, 0.25)`.

## Shapes

- **Micro-radios (`--r-xs`):** `3px` (Indicador activo de la barra inferior).
- **Controles compactos (`--r-sm`):** `8px` (Inputs, celdas de calendario, botones pequeños).
- **Botones y contenedores (`--r-md`):** `12px` (Botones de acción, tarjetas de descanso).
- **Tarjetas y paneles (`--r-lg`):** `16px` (Formularios y paneles de estadísticas).
- **Píldoras circulares (`--r-full`):** `9999px` (Chips de estado, scrollbars, disco olímpico).

## Components

### 1. Botón de Acción Primaria (`.btn-primary`)
- Fondo: `var(--primary)` (`#FFE600`).
- Texto: `var(--primary-ink)` (`#0A0B0E`).
- Altura táctil mínima: `52px`.
- Elevación: `var(--shadow-primary)`.

### 2. Disco de Creatina (`.plate`)
- Elemento hero interactivo circular en la pantalla de Inicio.
- Aros concéntricos amarillos y carbón en estado pendiente; esmeralda en estado confirmado.

### 3. Temporizador de Descanso (`.rest`)
- Superficie ámbar/amarillo atenuado (`var(--yellow-dim)`) con cronómetro gigante y controles para ajustar el tiempo sin interrumpir la respiración.

### 4. Navegación Inferior (`.tabbar`)
- Barra translúcida fijada con indicador superior brillante en amarillo eléctrico para la sección en curso.

## Do's and Don'ts

### Do's
- **Usar siempre texto negro sobre amarillo primario:** Mantiene un contraste insuperable de 13:1.
- **Mantener siempre `tabular-nums` en valores dinámicos:** Previene saltos horizontales en números de repeticiones y temporizadores.
- **Preservar botones con altura mínima de 48–52px:** Esencial para manejo con dedos cansados o temblorosos en el gimnasio.

### Don'ts
- **No mezclar degradados multicolores:** La estética es plana, limpia y técnica.
- **No usar sombras moradas o azules:** Todo relieve responde al color negro carbón con resplandor amarillo donde corresponda.
- **No usar texto blanco sobre amarillo:** Incumpliría normas de accesibilidad de contraste.
