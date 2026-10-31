/**
 * Brother Fit - Iconografía High-Tech Athletic SVG
 * Trazado unificado a 24x24 con stroke-width 2, sin dependencias de fuentes externas.
 * Cumple estrictamente con la regla Craft Floor de Impeccable (cero emojis / cero unicode).
 */

function svg(paths, { size = 20, cls = '', stroke = 'currentColor' } = {}) {
  return `<svg class="icon ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

export const icons = {
  check: (opts) => svg('<polyline points="20 6 9 17 4 12"/>', opts),
  flame: (opts) => svg('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>', opts),
  bolt: (opts) => svg('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>', opts),
  flask: (opts) => svg('<path d="M10 2v7.31L4.66 18.2A2 2 0 0 0 6.4 21h11.2a2 2 0 0 0 1.74-2.8L14 9.31V2M8.5 2h7M7 16h10"/>', opts),
  muscle: (opts) => svg('<path d="M6 4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2H6V4zm0 6h6v4H6v-4zm-2 8h10a2 2 0 0 0 2-2v-2H4v2a2 2 0 0 0 2 2zm14-10a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3"/>', opts),
  droplet: (opts) => svg('<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>', opts),
  coffee: (opts) => svg('<path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3"/>', opts),
  dumbbell: (opts) => svg('<path d="m6.5 6.5 11 11M21 21l-1-1M3 3l1 1M18 22l4-4M2 6l4-4M3 10l7-7M14 21l7-7"/>', opts),
  clock: (opts) => svg('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>', opts),
  calendar: (opts) => svg('<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>', opts),
  chevronLeft: (opts) => svg('<polyline points="15 18 9 12 15 6"/>', opts),
  chevronRight: (opts) => svg('<polyline points="9 18 15 12 9 6"/>', opts),
  chevronDown: (opts) => svg('<polyline points="6 9 12 15 18 9"/>', opts),
  chevronUp: (opts) => svg('<polyline points="18 15 12 9 6 15"/>', opts),
  x: (opts) => svg('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>', opts),
  plus: (opts) => svg('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>', opts),
  chat: (opts) => svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="12" y1="7" x2="12" y2="13"/><line x1="9" y1="10" x2="15" y2="10"/>', opts),
  pencil: (opts) => svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>', opts),
  trash: (opts) => svg('<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>', opts),
  activity: (opts) => svg('<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>', opts),
  sparkle: (opts) => svg('<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>', opts),
  shield: (opts) => svg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>', opts),
  info: (opts) => svg('<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>', opts),
  download: (opts) => svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>', opts),
  upload: (opts) => svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>', opts),
  share: (opts) => svg('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>', opts),
  mic: (opts) => svg('<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>', opts),
  close: (opts) => svg('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>', opts),
  dots: (opts) => svg('<circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>', opts),
  search: (opts) => svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>', opts),
  bot: (opts) => svg('<rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8.01" y2="16"/><line x1="16" y1="16" x2="16.01" y2="16"/>', opts),
  sliders: (opts) => svg('<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>', opts),
  /* Premio PR Brother Fit (original): estrella, laureles y pedestal. */
  trophy: (opts) => svg(
    '<path d="M12 1.4l1.2 3.14 3.37.18-2.62 2.11.87 3.25L12 8.25l-2.82 1.83.87-3.25-2.62-2.11 3.37-.18z"/>' +
    '<path d="M6.4 12.2c-2-1.4-2.5-4-1.1-6"/>' +
    '<path d="M4.6 9.8l1.4.35M4.3 7.7l1.35.7M5 5.8l1.1.95"/>' +
    '<path d="M17.6 12.2c2-1.4 2.5-4 1.1-6"/>' +
    '<path d="M19.4 9.8l-1.4.35M19.7 7.7l-1.35.7M19 5.8l-1.1.95"/>' +
    '<path d="M12 11.6v2.4"/>' +
    '<rect x="7.5" y="14.2" width="9" height="4.2" rx="1.15"/>' +
    '<path d="M9.2 16.3h5.6"/>' +
    '<path d="M5.6 20.2h12.8"/>' +
    '<path d="M7.2 22h9.6"/>',
    opts
  ),
  trendUp: (opts) => svg('<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>', opts),
  trendDown: (opts) => svg('<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>', opts),
  arrowUp: (opts) => svg('<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>', opts),
  arrowDown: (opts) => svg('<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>', opts),
};
