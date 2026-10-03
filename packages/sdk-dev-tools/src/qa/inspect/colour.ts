/**
 * Colours as the page draws them: any CSS colour resolved to RGBA, laid over what is behind it, and the contrast
 * between two of them (WCAG 2).
 */

export type Rgba = [number, number, number, number];

let painter: CanvasRenderingContext2D | null | undefined;

const canvasContext = (): CanvasRenderingContext2D | null => {
  if (painter === undefined) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      painter = canvas.getContext('2d', { willReadFrequently: true });
    } catch {
      painter = null;
    }
  }

  return painter;
};

const CHANNELS = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i;

const opacityOf = (alpha: string | undefined): number => {
  if (alpha === undefined) {
    return 1;
  }

  return alpha.endsWith('%') ? parseFloat(alpha) / 100 : parseFloat(alpha);
};

/** `rgb()`, `rgba()` and hex — what a computed colour is where nothing can paint one. */
const parse = (css: string): Rgba | undefined => {
  const value = css.trim();
  const channels = CHANNELS.exec(value);
  if (channels) {
    return [Number(channels[1]), Number(channels[2]), Number(channels[3]), opacityOf(channels.at(4))];
  }

  const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(value)?.[1];
  if (!hex) {
    return value === 'transparent' ? [0, 0, 0, 0] : undefined;
  }

  const full = hex.length === 3 ? hex.replace(/./g, digit => digit + digit) : hex;
  const [red, green, blue] = [0, 2, 4].map(index => parseInt(full.slice(index, index + 2), 16));

  return [red, green, blue, 1];
};

/**
 * Any colour the browser accepts — `oklch()`, `color-mix()`, a keyword — as RGBA, by painting one pixel with it: a
 * computed colour is not always `rgb()` any more.
 */
export const toRgba = (css: string): Rgba | undefined => {
  const context = canvasContext();
  if (!context) {
    return parse(css);
  }

  context.clearRect(0, 0, 1, 1);
  context.fillStyle = '#000';
  context.fillStyle = css;
  context.fillRect(0, 0, 1, 1);
  const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;

  return [red, green, blue, alpha / 255];
};

/** One colour laid over another. */
export const over = (top: Rgba, bottom: Rgba): Rgba => {
  const alpha = top[3] + bottom[3] * (1 - top[3]);
  if (alpha === 0) {
    return [0, 0, 0, 0];
  }

  const mix = (channel: number): number => (top[channel] * top[3] + bottom[channel] * bottom[3] * (1 - top[3])) / alpha;

  return [mix(0), mix(1), mix(2), alpha];
};

const luminance = ([red, green, blue]: Rgba): number => {
  const [r, g, b] = [red, green, blue].map(channel => {
    const value = channel / 255;

    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG 2's contrast ratio, from 1 to 21. */
export const contrastRatio = (first: Rgba, second: Rgba): number => {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);

  return (light + 0.05) / (dark + 0.05);
};

export const toHex = ([red, green, blue, alpha]: Rgba): string => {
  const hex = `#${[red, green, blue].map(channel => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;

  return alpha < 1 ? `${hex} · ${String(Math.round(alpha * 100))}%` : hex;
};

/**
 * The colour behind an element: every translucent background from it outwards, down to the first opaque one or the
 * canvas. Undefined where an image or a gradient is in the way — that backdrop is pixels this cannot read.
 */
export const backdropOf = (element: Element): Rgba | undefined => {
  const view = element.ownerDocument.defaultView;
  if (!view) {
    return undefined;
  }

  const layers: Rgba[] = [];
  for (let node: Element | null = element; node; node = node.parentElement) {
    const style = view.getComputedStyle(node);
    if (style.backgroundImage && style.backgroundImage !== 'none') {
      return undefined;
    }

    const layer = toRgba(style.backgroundColor);
    if (layer && layer[3] > 0) {
      layers.push(layer);
      if (layer[3] >= 1) {
        break;
      }
    }
  }

  const dark = view.getComputedStyle(element.ownerDocument.documentElement).colorScheme.includes('dark');
  const canvas: Rgba = dark ? [18, 18, 18, 1] : [255, 255, 255, 1];

  return layers.reduceRight<Rgba>((below, layer) => over(layer, below), canvas);
};

/** Text the size WCAG calls large: 24 px, or 18.66 px in bold — it may get by on 3:1 instead of 4.5:1. */
export const isLargeText = (fontSize: number, fontWeight: number): boolean =>
  fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
