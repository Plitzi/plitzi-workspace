/**
 * The colours the map is drawn in, and the contract that says where they come from.
 *
 * The map ships no colours of its own. Everything it paints is read from a CSS custom property on the element — the
 * space sets them from its own tokens — so the display follows the space's theme, light or dark, without the element
 * knowing a theme exists. These are the names it asks for, and the whole of its styling API.
 */
export const PALETTE_TOKENS = {
  /** The sea, and the globe's disc. */
  ocean: '--seismic-ocean',
  land: '--seismic-land',
  coast: '--seismic-coast',
  border: '--seismic-border',
  graticule: '--seismic-graticule',
  /** Plate boundaries. One hue: their KIND is told by the stroke, so the depth colours stay the only colours on the map. */
  plate: '--seismic-plate',
  /** Focal depth, which is what the colour of an event means: shallow ones are the dangerous ones. */
  shallow: '--seismic-shallow',
  intermediate: '--seismic-intermediate',
  deep: '--seismic-deep',
  /** The instrument's own trace: selection, range rings, the glow at the edge of the globe. */
  accent: '--seismic-accent',
  /** What an event's outline is drawn in, so it separates from whatever is under it. */
  halo: '--seismic-halo'
} as const;

export type PaletteName = keyof typeof PALETTE_TOKENS;

/** Red, green, blue in 0–255 and alpha in 0–1: what a WebGL style can take, whatever the CSS was written in. */
export type Rgba = readonly [number, number, number, number];

export type Palette = Record<PaletteName, Rgba>;

export const css = ([red, green, blue, alpha]: Rgba, opacity = 1): string =>
  `rgba(${red}, ${green}, ${blue}, ${Math.round(alpha * opacity * 1000) / 1000})`;

/**
 * Every token, resolved to four numbers.
 *
 * Read through the browser rather than parsed: a token may be written as a hex, a `light-dark()`, a `color-mix()` or
 * a variable of another variable, and only the browser knows what each of those is on this page right now. A probe
 * inside the element resolves it with the element's own custom properties, and a one-pixel canvas turns whatever
 * colour syntax comes back into bytes — which is the only form a map style reads reliably.
 */
export const readPalette = (probe: HTMLElement): Palette => {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });

  const resolve = (token: string): Rgba => {
    probe.style.color = `var(${token})`;
    const color = getComputedStyle(probe).color;
    if (!context) {
      return [128, 128, 128, 1];
    }

    context.clearRect(0, 0, 1, 1);
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;

    return [red, green, blue, alpha / 255];
  };

  return Object.fromEntries(
    Object.entries(PALETTE_TOKENS).map(([name, token]) => [name, resolve(token)])
    // `fromEntries` widens its keys to `string`; they are every key of PALETTE_TOKENS by construction.
  ) as Palette;
};
