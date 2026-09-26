import { css } from './palette';

import type { Palette } from './palette';
import type {
  AllPaintProperties,
  BackgroundLayerSpecification,
  CircleLayerSpecification,
  ExpressionSpecification,
  FillLayerSpecification,
  FilterSpecification,
  HeatmapLayerSpecification,
  LayerSpecification,
  LineLayerSpecification,
  Map as MapLibreMap,
  SkySpecification,
  SourceSpecification,
  StyleSpecification
} from 'maplibre-gl';

/**
 * The map's style, as a function of the palette.
 *
 * Everything is a GeoJSON source this element owns — the world from `public/geo/world.json`, the events from the
 * space's binding — so there is no tile server, no key and no glyph server behind it. The layers are listed once and
 * their paint is recomputed whole when the theme changes, which keeps "what the map looks like" in one place.
 */

export const SOURCES = {
  land: 'land',
  borders: 'borders',
  plates: 'plates',
  graticule: 'graticule',
  quakes: 'quakes',
  rings: 'rings',
  shaking: 'shaking'
} as const;

/** The layers the element reads back by name: the one a click resolves against, and the ones it filters or toggles. */
export const LAYERS = {
  quake: 'quake-core',
  glow: 'quake-glow',
  selected: 'quake-selected',
  heat: 'quake-heat',
  pulse: 'quake-pulse',
  rings: 'range-rings',
  shaking: 'shaking'
} as const;

const PLATE_KINDS = ['convergent', 'divergent', 'transform'] as const;

export const PLATE_LAYERS = PLATE_KINDS.map(kind => `plates-${kind}` as const);

/** The layers that draw events, which the magnitude floor applies to alike. */
export const QUAKE_LAYERS = [LAYERS.heat, LAYERS.glow, LAYERS.quake] as const;

/**
 * The replay's clock, as map state rather than as a filter.
 *
 * A replay moves this every frame. Written into a filter, each frame would re-lay out every event in a worker; read
 * from `global-state` by a PAINT property, it only re-evaluates a colour — which is what lets two thousand events
 * appear in order at sixty frames a second. Outside a replay it sits past the end of time and shows everything.
 */
export const REPLAY_CLOCK = 'until';

/**
 * Where the fresh events' pulse is in its beat, 0 to 1 — map state for the same reason as the replay clock.
 *
 * The pulse is a ring drawn ON the globe: it curves with the surface near the limb and goes behind the Earth with the
 * dot it belongs to. A DOM ring over the canvas did neither — it faced the screen however the globe turned, and showed
 * through the planet from the far side. Moving one number a frame is all the animation costs.
 */
export const PULSE_PHASE = 'pulse';

const NOT_YET = Number.MAX_SAFE_INTEGER;

const happened: ExpressionSpecification = ['<=', ['get', 'time'], ['global-state', REPLAY_CLOCK]];

const whenHappened = (value: number | ExpressionSpecification): ExpressionSpecification => ['case', happened, value, 0];

/**
 * Area with magnitude, not radius.
 *
 * A magnitude is already logarithmic in energy, so a radius that grew linearly made every M6 a blot over the coast
 * under it. These stops keep a M7 unmistakably bigger than a M5 and leave a busy day legible, and the whole scale
 * grows a little as the reader zooms in, where there is room for it.
 */
const sized = (scale: number): ExpressionSpecification => [
  'interpolate',
  ['exponential', 1.6],
  ['get', 'magnitude'],
  0,
  1.6 * scale,
  3,
  3 * scale,
  5,
  6 * scale,
  7,
  13 * scale,
  9,
  26 * scale
];

const radius = (scale: number, extra: number | ExpressionSpecification = 0): ExpressionSpecification => [
  'interpolate',
  ['linear'],
  ['zoom'],
  1,
  ['+', sized(scale), extra],
  6,
  ['+', sized(scale * 1.9), extra]
];

const byBand = (palette: Palette, opacity = 1): ExpressionSpecification => [
  'match',
  ['get', 'band'],
  'shallow',
  css(palette.shallow, opacity),
  'intermediate',
  css(palette.intermediate, opacity),
  css(palette.deep, opacity)
];

type Paints = {
  ocean: BackgroundLayerSpecification['paint'];
  graticule: LineLayerSpecification['paint'];
  land: FillLayerSpecification['paint'];
  coast: LineLayerSpecification['paint'];
  borders: LineLayerSpecification['paint'];
  'plates-convergent': LineLayerSpecification['paint'];
  'plates-divergent': LineLayerSpecification['paint'];
  'plates-transform': LineLayerSpecification['paint'];
  'quake-heat': HeatmapLayerSpecification['paint'];
  'quake-glow': CircleLayerSpecification['paint'];
  'quake-core': CircleLayerSpecification['paint'];
  'quake-pulse': CircleLayerSpecification['paint'];
  'quake-selected': CircleLayerSpecification['paint'];
  'range-rings': LineLayerSpecification['paint'];
  shaking: LineLayerSpecification['paint'];
};

/** Paint, by layer id, for one palette. `layers()` builds from this, and a theme change re-applies it whole. */
export const paints = (palette: Palette): Paints => ({
  ocean: { 'background-color': css(palette.ocean) },
  graticule: {
    'line-color': css(palette.graticule),
    'line-width': ['case', ['boolean', ['get', 'equator'], false], 1.1, 0.6]
  },
  land: { 'fill-color': css(palette.land) },
  coast: { 'line-color': css(palette.coast), 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.6, 6, 1.4] },
  borders: { 'line-color': css(palette.border), 'line-width': 0.5, 'line-dasharray': [3, 2] },
  // Convergent margins are where the great earthquakes are, so they carry the heaviest stroke; a ridge is a double
  // line — the gap is the rift — and a transform fault a row of dots. One hue for all three, so colour on this map
  // only ever means depth.
  'plates-convergent': {
    'line-color': css(palette.plate, 0.9),
    'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1.5, 6, 2.8],
    'line-blur': 0.4
  },
  'plates-divergent': {
    'line-color': css(palette.plate, 0.75),
    'line-width': 0.8,
    'line-gap-width': ['interpolate', ['linear'], ['zoom'], 1, 1.4, 6, 2.6]
  },
  'plates-transform': {
    'line-color': css(palette.plate, 0.8),
    'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1.4, 6, 2.4],
    'line-dasharray': [0.1, 2.2]
  },
  'quake-heat': {
    'heatmap-weight': whenHappened(['interpolate', ['linear'], ['get', 'magnitude'], 0, 0, 2.5, 0.15, 5, 0.6, 7, 1]),
    'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 1, 0.9, 6, 2.2],
    'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 1, 14, 6, 38],
    'heatmap-opacity': 0.85,
    'heatmap-color': [
      'interpolate',
      ['linear'],
      ['heatmap-density'],
      0,
      css(palette.deep, 0),
      0.15,
      css(palette.deep, 0.45),
      0.4,
      css(palette.accent, 0.6),
      0.7,
      css(palette.intermediate, 0.8),
      1,
      css(palette.shallow, 0.95)
    ]
  },
  'quake-glow': {
    'circle-radius': radius(2.4),
    'circle-color': byBand(palette, 0.3),
    'circle-blur': 1,
    'circle-opacity': whenHappened(1),
    'circle-pitch-alignment': 'map'
  },
  'quake-core': {
    'circle-radius': radius(1),
    'circle-color': byBand(palette, 0.8),
    'circle-stroke-color': css(palette.halo, 0.9),
    'circle-stroke-width': ['interpolate', ['linear'], ['get', 'magnitude'], 2, 0.4, 6, 1.2],
    'circle-opacity': whenHappened(1),
    'circle-stroke-opacity': whenHappened(1),
    'circle-pitch-alignment': 'map'
  },
  // A ring that leaves the dot and fades as it grows, once per beat.
  'quake-pulse': {
    'circle-radius': radius(1, ['*', ['global-state', PULSE_PHASE], 16]),
    'circle-color': 'rgba(0, 0, 0, 0)',
    'circle-stroke-color': byBand(palette, 0.9),
    'circle-stroke-width': 1.4,
    'circle-stroke-opacity': ['-', 1, ['global-state', PULSE_PHASE]],
    'circle-pitch-alignment': 'map'
  },
  'quake-selected': {
    'circle-radius': radius(1, 5),
    'circle-color': 'rgba(0, 0, 0, 0)',
    'circle-stroke-color': css(palette.accent),
    'circle-stroke-width': 2,
    'circle-pitch-alignment': 'map'
  },
  'range-rings': {
    'line-color': css(palette.accent, 0.7),
    'line-width': 1,
    'line-dasharray': [2, 3]
  },
  // Shaking, from felt to damaging, in the colours the map already uses for danger: the instrument's trace where
  // it is barely felt, the intermediate hue where objects fall, the shallow red where buildings are damaged.
  shaking: {
    'line-color': [
      'interpolate',
      ['linear'],
      ['get', 'mmi'],
      3,
      css(palette.accent, 0.55),
      5,
      css(palette.intermediate, 0.8),
      7,
      css(palette.shallow, 0.95)
    ],
    'line-width': ['interpolate', ['linear'], ['get', 'mmi'], 3, 1.6, 8, 3.2],
    'line-blur': 0.3
  }
});

/**
 * The haze at the rim of the globe, in the instrument's own trace colour.
 *
 * Faded out as the reader zooms in: close up, an atmosphere is a coloured fog over the thing being looked at.
 */
export const sky = (palette: Palette): SkySpecification => ({
  'sky-color': css(palette.ocean),
  'horizon-color': css(palette.accent, 0.35),
  'fog-color': css(palette.ocean),
  'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 0.9, 4, 0.6, 6, 0]
});

/**
 * A new palette, on a map that already exists: every paint property of every layer, and the sky.
 *
 * Re-applied whole rather than diffed — fourteen layers, a handful of properties each, once per theme switch.
 */
export const applyPalette = (map: MapLibreMap, palette: Palette): void => {
  const all = paints(palette);
  // `Object.keys` and `Object.entries` widen their keys to `string`: these are the layer ids of `Paints` and the paint
  // properties of each layer's own spec, by construction.
  (Object.keys(all) as (keyof Paints)[]).forEach(layer => {
    const paint: Partial<AllPaintProperties> = all[layer] ?? {};
    (Object.keys(paint) as (keyof AllPaintProperties)[]).forEach(property => {
      const value = paint[property];
      if (value !== undefined) {
        map.setPaintProperty(layer, property, value);
      }
    });
  });
  map.setSky(sky(palette));
};

export const layers = (palette: Palette): LayerSpecification[] => {
  const paint = paints(palette);

  return [
    { id: 'ocean', type: 'background', paint: paint.ocean },
    { id: 'graticule', type: 'line', source: SOURCES.graticule, paint: paint.graticule },
    { id: 'land', type: 'fill', source: SOURCES.land, paint: paint.land },
    { id: 'coast', type: 'line', source: SOURCES.land, paint: paint.coast },
    { id: 'borders', type: 'line', source: SOURCES.borders, paint: paint.borders },
    ...PLATE_KINDS.map((kind): LineLayerSpecification => ({
      id: `plates-${kind}`,
      type: 'line',
      source: SOURCES.plates,
      filter: ['==', ['get', 'kind'], kind],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: paint[`plates-${kind}`]
    })),
    {
      id: LAYERS.heat,
      type: 'heatmap',
      source: SOURCES.quakes,
      layout: { visibility: 'none' },
      paint: paint['quake-heat']
    },
    { id: LAYERS.rings, type: 'line', source: SOURCES.rings, paint: paint['range-rings'] },
    {
      id: LAYERS.shaking,
      type: 'line',
      source: SOURCES.shaking,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: paint.shaking
    },
    { id: LAYERS.glow, type: 'circle', source: SOURCES.quakes, paint: paint['quake-glow'] },
    {
      id: LAYERS.pulse,
      type: 'circle',
      source: SOURCES.quakes,
      filter: ['==', ['get', 'fresh'], true],
      paint: paint['quake-pulse']
    },
    // Sorted by magnitude, so a big event is drawn over the small ones around it rather than under them.
    {
      id: LAYERS.quake,
      type: 'circle',
      source: SOURCES.quakes,
      layout: { 'circle-sort-key': ['get', 'magnitude'] },
      paint: paint['quake-core']
    },
    {
      id: LAYERS.selected,
      type: 'circle',
      source: SOURCES.quakes,
      filter: ['==', ['get', 'id'], ''],
      paint: paint['quake-selected']
    }
  ];
};

const emptySource = (): SourceSpecification => ({ type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

export const style = (palette: Palette, projection: 'globe' | 'mercator'): StyleSpecification => ({
  version: 8,
  projection: { type: projection },
  state: { [REPLAY_CLOCK]: { default: NOT_YET }, [PULSE_PHASE]: { default: 0 } },
  sky: sky(palette),
  sources: Object.fromEntries(Object.values(SOURCES).map(source => [source, emptySource()])),
  layers: layers(palette)
});

/** The magnitude floor and the depth band, as the conditions an event must meet to be drawn. */
const quakeConditions = (minMagnitude: number, band: string): ExpressionSpecification[] => {
  const floor: ExpressionSpecification = ['>=', ['get', 'magnitude'], minMagnitude];

  return band === 'all' ? [floor] : [floor, ['==', ['get', 'band'], band]];
};

/** The magnitude floor and the depth band, as one filter every event layer shares. */
export const quakeFilter = (minMagnitude: number, band: string): FilterSpecification => [
  'all',
  ...quakeConditions(minMagnitude, band)
];

/** Fresh events that pass the filters: the pulse layer's filter, which is the event layers' plus freshness. */
export const pulseFilter = (minMagnitude: number, band: string): FilterSpecification => [
  'all',
  ['==', ['get', 'fresh'], true],
  ...quakeConditions(minMagnitude, band)
];
