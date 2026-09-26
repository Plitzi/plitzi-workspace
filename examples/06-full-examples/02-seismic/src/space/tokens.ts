import type { SpaceSpec } from '@plitzi/sdk-authoring';

/**
 * The palette, in two schemes: NIGHT, a phosphor trace on a black field, and DAY, a plotting table's paper chart.
 *
 * A monitor is usually read in a dark room, so night is where it opens — but a projector in a lit meeting room washes
 * a black screen to grey, and that is exactly where this display gets shown. Day is the same instrument redrawn for
 * light: every token has both values, and nothing on the page names a colour.
 *
 * The map reads these too. It ships no colours of its own and asks for `--seismic-*` properties, which `css.ts` points
 * at the tokens below — so a theme switch recolours the globe along with everything around it.
 */

const scheme = (dark: string, light: string) => ({ light, dark, default: light });

export const variables: SpaceSpec['variables'] = {
  color: {
    /** Behind everything, and around the globe. */
    void: scheme('#02070a', '#e6e2d6'),
    ocean: scheme('#041117', '#d0d9d5'),
    land: scheme('#0f262a', '#f4efe3'),
    coast: scheme('#2f8173', '#7d8876'),
    border: scheme('rgba(61, 255, 201, 0.16)', 'rgba(38, 58, 48, 0.28)'),
    graticule: scheme('rgba(61, 255, 201, 0.08)', 'rgba(20, 70, 56, 0.14)'),
    /** Plate boundaries. A hue nothing else uses, so colour on the map only ever means depth. */
    plate: scheme('#b48cff', '#7446c4'),
    /** The instrument's own trace: headings, selection, the live readouts. */
    trace: scheme('#3dffc9', '#05705a'),
    'trace-glow': scheme('rgba(61, 255, 201, 0.42)', 'rgba(5, 112, 90, 0.26)'),
    ink: scheme('#d2e8e1', '#16201c'),
    dim: scheme('#6f9a90', '#55645d'),
    /** Focal depth, hot to cold: the shallow events are the ones that do damage, so they are the loudest. */
    shallow: scheme('#ff513d', '#d4311b'),
    intermediate: scheme('#ffb22e', '#b86e00'),
    deep: scheme('#4f8fff', '#2356c7'),
    /** PAGER, the USGS estimate of losses: its own four colours, as the USGS publishes them. */
    'pager-green': scheme('#40d98a', '#1d8f4e'),
    'pager-yellow': scheme('#ffd84a', '#a67e00'),
    'pager-orange': scheme('#ff8f33', '#c65f14'),
    'pager-red': scheme('#ff3d3d', '#c01f1f'),
    panel: scheme('rgba(3, 12, 15, 0.8)', 'rgba(247, 244, 236, 0.88)'),
    'panel-strong': scheme('rgba(3, 14, 18, 0.94)', 'rgba(251, 249, 243, 0.96)'),
    cell: scheme('rgba(61, 255, 201, 0.06)', 'rgba(5, 112, 90, 0.07)'),
    edge: scheme('rgba(61, 255, 201, 0.24)', 'rgba(5, 80, 62, 0.3)'),
    'edge-soft': scheme('rgba(61, 255, 201, 0.1)', 'rgba(5, 80, 62, 0.13)'),
    /** What separates an event's dot from the land under it. */
    halo: scheme('rgba(2, 7, 10, 0.85)', 'rgba(255, 255, 255, 0.92)'),
    /** The scanlines and the sweep: visible only once you look for them. */
    scanline: scheme('rgba(61, 255, 201, 0.035)', 'rgba(5, 80, 62, 0.03)')
  },
  // Fonts are not a colour, and the vocabulary has no category for them — `custom` is where a variable that is
  // neither goes, and it is emitted as a custom property like every other.
  custom: {
    display: "'Chakra Petch', 'Barlow Condensed', ui-sans-serif, system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
  }
};

/** The faces the page asks for: a `font-family` above loads only if its face is listed here. */
export const fonts: NonNullable<SpaceSpec['fonts']> = [
  {
    source: 'google',
    family: 'Chakra Petch',
    fallback: 'ui-sans-serif, system-ui, sans-serif',
    weights: [500, 600, 700],
    styles: ['normal'],
    display: 'swap',
    preload: true
  },
  {
    source: 'google',
    family: 'JetBrains Mono',
    fallback: 'ui-monospace, Menlo, monospace',
    weights: [400, 500, 700],
    styles: ['normal'],
    display: 'swap',
    preload: true
  }
];

/** The toasts an arrival raises, in the display's own panel and trace. */
export const notifications: SpaceSpec['notifications'] = {
  background: 'var(--panel-strong)',
  text: 'var(--ink)',
  success: 'var(--trace)',
  info: 'var(--trace)',
  warning: 'var(--intermediate)',
  danger: 'var(--shallow)',
  radius: '0px'
};
