import type { SpaceSpec } from '@plitzi/sdk-server/authoring';

/**
 * The palette, and the parts of the display nobody authored.
 *
 * Everything a container or a piece of text wears is declared with `styles()` next to it in `space.ts` — this is
 * one screen, and the rule for a readout belongs beside the readout. What is left here is the two things that
 * cannot be: the custom properties the whole display is written in, and the internals of `seismicMap`, which
 * renders markup no class in the space can reach.
 *
 * The map ships no colours of its own. Every rule below is written in these variables, which is what lets the
 * display be re-themed from this file without the element knowing a theme exists.
 */

const MONO = "'Berkeley Mono', 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
const DISPLAY = "'Barlow Condensed', 'Oswald', 'Roboto Condensed', ui-sans-serif, system-ui, sans-serif";

/**
 * One scheme, deliberately.
 *
 * A monitor is read in a dark room and its whole legibility is a bright trace on a black field. Offering a light
 * scheme would be offering a version of this display that does not work, so the space declares `mode: 'dark'` and
 * every variable answers the same in both.
 */
const fixed = (value: string) => ({ light: value, dark: value, default: value });

export const variables: SpaceSpec['variables'] = {
  color: {
    void: fixed('#04070a'),
    /** The trace colour: everything the instrument itself draws. */
    phosphor: fixed('#38ffc8'),
    'phosphor-glow': fixed('rgba(56, 255, 200, 0.45)'),
    'phosphor-edge': fixed('rgba(56, 255, 200, 0.55)'),
    ink: fixed('#b9d4cd'),
    dim: fixed('#527a72'),
    /** The one colour that is not the trace: something happened. */
    alert: fixed('#ff5f4d'),
    panel: fixed('rgba(4, 12, 14, 0.72)'),
    'panel-strong': fixed('rgba(4, 14, 16, 0.92)'),
    cell: fixed('rgba(56, 255, 200, 0.05)'),
    edge: fixed('rgba(56, 255, 200, 0.18)'),
    'edge-soft': fixed('rgba(56, 255, 200, 0.08)'),
    /** Focal depth, cold to hot: the shallow ones are the destructive ones, so they are the loudest. */
    'depth-shallow': fixed('#ff5f4d'),
    'depth-upper': fixed('#ffb03a'),
    'depth-mid': fixed('#38ffc8'),
    'depth-deep': fixed('#3f8dff')
  },
  // Fonts are not a colour, and the vocabulary has no category for them — `custom` is where a variable that is
  // neither a colour nor a spacing goes, and it is emitted as a custom property like every other.
  custom: {
    mono: MONO,
    display: DISPLAY
  }
};

export const customCss = `
/* The document itself, because a full-screen instrument has no margin and nothing to scroll. */
html, body { background: var(--void); margin: 0; overscroll-behavior: none; }

/* ── The space's own element ─────────────────────────────────────────────────────────────────────────────────
   seismicMap renders a Leaflet map, whose parts are out of reach of a class the way a page's markup is not. Every
   rule here is written in the palette above, which is what makes an element that ships no colours of its own look
   like it was designed with the display. */

.seismic__canvas { position: absolute; inset: 0; width: 100%; height: 100%; background: var(--void); }

/* The tiles are a photograph of the world and this is an instrument: knocked back and tinted, they read as the
   display's own basemap rather than as a map with panels sitting on top of it. */
.seismic__tiles { filter: grayscale(0.55) brightness(0.6) contrast(1.15) saturate(0.55); }

.leaflet-container { background: var(--void); font-family: var(--mono); outline: none; }
.leaflet-control-attribution {
  background: rgba(4, 12, 14, 0.72) !important; color: var(--dim) !important;
  font-family: var(--mono); font-size: 9px; letter-spacing: 0.06em;
  border: 1px solid var(--edge); border-right: 0; border-bottom: 0; padding: 3px 8px;
}
.leaflet-control-attribution a { color: var(--dim) !important; }

/* One glyph, three facts: position, area for magnitude, colour for depth. Written as CSS rather than handed to
   Leaflet as its colour options, which it turns into SVG presentation attributes — a custom property used in one
   of those resolves in Chrome and nowhere else, and a circle with no fill has no surface for a click to land on. */
.seismic__quake {
  fill: currentColor; stroke: currentColor; fill-opacity: 0.5; stroke-opacity: 0.95;
  cursor: pointer; transition: fill-opacity 120ms linear;
}
.seismic__quake--shallow { color: var(--depth-shallow); }
.seismic__quake--upper   { color: var(--depth-upper); }
.seismic__quake--mid     { color: var(--depth-mid); }
.seismic__quake--deep    { color: var(--depth-deep); }

.seismic__quake:hover, .seismic__quake--active { fill-opacity: 0.95; }
.seismic__quake--active { stroke: var(--phosphor); stroke-width: 2.5; }

/* An event that arrived while somebody was watching. It breathes; everything else is still — a display where
   everything pulses says nothing at all. */
.seismic__quake--fresh {
  animation: seismic-ping 2s ease-out infinite; transform-box: fill-box; transform-origin: center;
}

@keyframes seismic-ping {
  0%   { transform: scale(1);   stroke-opacity: 1; }
  70%  { transform: scale(2.6); stroke-opacity: 0; }
  100% { transform: scale(2.6); stroke-opacity: 0; }
}

.seismic__tip {
  background: var(--panel-strong); border: 1px solid var(--phosphor-edge); color: var(--phosphor);
  font-family: var(--mono); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase;
  padding: 4px 8px; border-radius: 0; box-shadow: 0 0 22px -6px var(--phosphor-glow);
}
.seismic__tip::before { display: none; }

/* Scanlines and one slow sweep over the whole display, at an opacity where you see them only once you look for
   them. They are the only things on screen that are not data, and they exist to say the instrument is powered. */
.screen::after {
  content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 3;
  background: repeating-linear-gradient(to bottom, rgba(56, 255, 200, 0.04) 0 1px, transparent 1px 3px);
}
.screen::before {
  content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 2;
  background: linear-gradient(90deg, transparent, rgba(56, 255, 200, 0.05), transparent);
  animation: seismic-sweep 14s linear infinite;
}

@keyframes seismic-sweep {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* The corner brackets, drawn once here rather than as four elements in every panel. */
.panel, .feedPanel, .depthKey, .selectionPanel { position: relative; }
.panel::before, .feedPanel::before, .depthKey::before, .selectionPanel::before,
.panel::after, .feedPanel::after, .depthKey::after, .selectionPanel::after {
  content: ''; position: absolute; width: 9px; height: 9px; border: 1px solid var(--phosphor); opacity: 0.55;
  pointer-events: none;
}
.panel::before, .feedPanel::before, .depthKey::before, .selectionPanel::before {
  top: -1px; left: -1px; border-right: 0; border-bottom: 0;
}
.panel::after, .feedPanel::after, .depthKey::after, .selectionPanel::after {
  bottom: -1px; right: -1px; border-left: 0; border-top: 0;
}

.eventRow:hover { background: var(--cell); }
.rangeLink:hover { color: var(--phosphor); border-color: var(--edge); }

/* A phone is not a monitor: the columns stack and the map keeps the space it needs to be a map. */
@media (max-width: 900px) {
  .overlay { grid-template-columns: 1fr; grid-template-rows: auto 1fr auto; padding: 12px; }
  .rightStack { grid-column: 1; grid-row: 3; max-height: 34vh; }
  .depthKey, .selectionPanel { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .seismic__quake--fresh, .screen::before { animation: none; }
}
`;
