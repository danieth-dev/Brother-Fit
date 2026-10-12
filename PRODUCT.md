# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

PWA estática con HTML5, Vanilla CSS (tokens nativos y diseño modular), Vanilla JavaScript moderno (ES Modules) y base de datos local IndexedDB. Sin dependencias de compilación ni frameworks pesados para garantizar máxima velocidad y portabilidad.

## Users

Deportistas, practicantes de levantamiento de pesas, calistenia, fuerza e hipertrofia que entrenan en el gimnasio y consumen suplementación regular (como creatina). Necesitan registrar series, repeticiones, peso, RPE y descansos mientras entrenan, operando la aplicación con una sola mano, a menudo con fatiga muscular y sin tiempo para interfaces complejas o esperas de red.

## Product Purpose

Ofrecer un compañero de entrenamiento ultra rápido, libre de fricción y con foco 100% privado en el atleta. Permite:
1. Registrar la dosis diaria de creatina con un solo toque y mantener la racha de suplementación.
2. Gestionar sesiones activas de entrenamiento con cronómetro, autocompletado inteligente de la última serie y temporizador de descanso con vibración háptica.
3. Analizar la progresión mediante gráficos de 1RM estimado (fórmula de Epley), volumen acumulado y peso corporal.
4. Consultar al asistente atlético personalizado (Fit AI) con voz y memoria persistente que aprende objetivos y contexto del usuario sin costos mensuales.
5. Funcionar 100% offline y conservar todos los datos en el dispositivo del usuario.

## Positioning

A diferencia de las aplicaciones de fitness convencionales (que exigen cuentas en la nube, suscripciones premium mensuales, anuncios molestos y cargan lentamente en sótanos o zonas de gimnasio con mala cobertura), **Brother Fit** arranca al instante, almacena los datos de forma local, garantiza privacidad absoluta y está optimizada para la interacción táctil inmediata bajo esfuerzo físico.

## Operating Context

- **Entorno de uso primario:** Sala de pesas o gimnasio; iluminación artificial variable, pantalla móvil sostenida con una sola mano, manos sudorosas o con tiza/magnesio.
- **Patrón de interacción:** Ráfagas cortas de 5 a 15 segundos entre series para anotar peso y repeticiones y activar el temporizador de descanso, seguido por bloqueo o reposo del teléfono.
- **Ritual diario:** Un toque rápido al iniciar el día o pre/post-entreno para marcar la toma de creatina.

## Capabilities and Constraints

- **PWA Offline-First:** Funciona de inmediato sin conexión a internet mediante Service Worker y almacenamiento persistente en IndexedDB.
- **Gestión local y respaldo:** Exportación e importación segura de respaldos atómicos en formato JSON.
- **Temporizador activo:** Cuenta regresiva de descanso configurable por ejercicio con alarma visual y vibración háptica.
- **Cálculo analítico:** Estimación de 1RM en tiempo real mediante la ecuación Epley: `peso × (1 + reps / 30)`.
- **Asistente de voz y memoria persistente (Fit AI):** Conexión en tiempo real con Gemini Multimodal Live API mediante WebSockets y memoria a largo plazo en IndexedDB (`agentMemory`), con llamadas a herramientas automáticas (`guardar_recuerdo`, `listar_recuerdos`, `borrar_recuerdo`).
- **Restricción técnica:** No depende de backend ni autenticación remota; la persistencia depende del almacenamiento del navegador/dispositivo, por lo que se prioriza la retención persistente del sistema de archivos (`navigator.storage.persist()`).

## Brand Commitments

- **Identidad:** "Brother Fit" — Energía deportiva de alto rendimiento, disciplina, potencia y precisión.
- **Paleta visual vinculante:** Negro carbón profundo y Amarillo eléctrico de alta energía (*Black & Electric Yellow*), evocando el equipamiento de fuerza profesional, discos de calibración y estética de alto impacto.
- **Tono de voz:** Directo, conciso, motivador y claro. Sin rodeos ni jerga publicitaria superflua.

## Evidence on Hand

- Código base funcional implementado en `js/` con arquitectura desacoplada (`views → services → db`).
- Esquema de base de datos IndexedDB estructurado en 7 almacenes (`exercises`, `workouts`, `sets`, `supplements`, `bodyMetrics`, `meta`, `agentMemory`).
- Catálogo base de ejercicios categorizados por grupo muscular (Pecho, Espalda, Piernas, Hombros, Brazos).

## Product Principles

1. **Velocidad de toque ante todo:** Cualquier acción recurrente (anotar serie, registrar creatina, iniciar descanso) debe completarse en 1 o 2 toques como máximo.
2. **Legibilidad a un brazo de distancia:** Los números clave (peso, reps, segundos de descanso, racha) deben distinguirse al instante en una pantalla móvil sin forzar la vista ni detener la concentración.
3. **Alto contraste atlético:** La combinación negro y amarillo proporciona una jerarquía inmediata, guiando la atención del usuario hacia la acción principal.
4. **Soberanía del usuario (Local-First):** Los datos pertenecen exclusivamente al atleta. Sin telemetría intrusiva, sin muros de pago, con respaldo y exportación total.

## Accessibility & Inclusion

- Contraste de texto y elementos de control cumpliendo WCAG 2.1 AA (mínimo 4.5:1 para texto estándar y >10:1 para elementos de acción en amarillo sobre negro).
- Áreas de interacción táctil con tamaño objetivo mínimo de 48×48px para facilitar la pulsación durante el cansancio muscular.
- Soporte explícito para `prefers-reduced-motion` desactivando animaciones cuando el usuario lo configure.
- Tipografía con alineación numérica tabular (`tabular-nums`) para evitar oscilaciones en cronómetros y tablas de series.
