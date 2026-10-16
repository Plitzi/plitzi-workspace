import { splitBySpaceOutsideParens } from '../../../cssValues';

export type GradientStop = {
  id: string;
  color: string;
  /** Empty, one position or two (`10% 20%`, a hard band) — as written. */
  position: string;
};

/**
 * What a layer is. `raw` is any image the editor has no controls for — a token standing for it, `image-set()`,
 * `cross-fade()` — kept word for word, so editing another layer never rewrites it into something else.
 */
export type BackgroundLayerType = 'none' | 'url' | 'linear-gradient' | 'radial-gradient' | 'conic-gradient' | 'raw';

export type BackgroundLayer = {
  id: string;
  type: BackgroundLayerType;
  url: string;
  raw: string;
  /** A gradient's `repeating-` form. */
  repeating: boolean;
  /** Empty for CSS's default (to bottom), which is then not written. */
  angle: string;
  radialShape: 'circle' | 'ellipse';
  /** A keyword (`closest-side`…) or an explicit size (`100px`, `40% 20%`). */
  radialExtent: string;
  /** Empty for CSS's default (center). */
  radialPosition: string;
  conicAngle: string;
  conicPosition: string;
  stops: GradientStop[];
  size: string;
  positionX: string;
  positionY: string;
  repeat: string;
  attachment: string;
  clip: string;
};

export const DEFAULT_STOPS: GradientStop[] = [
  { id: 'stop-default-0', color: '#000000', position: '0%' },
  { id: 'stop-default-1', color: '#ffffff', position: '100%' }
];

/** What a layer is where its own CSS says nothing: CSS's initial values, which a layer read back must keep. */
const CSS_INITIAL = {
  size: 'auto',
  positionX: '0%',
  positionY: '0%',
  repeat: 'repeat',
  attachment: 'scroll',
  clip: 'border-box'
};

/** What a layer added in the editor starts as — a gradient or a picture placed once, not tiled. */
export const DEFAULT_LAYER_PROPS = {
  url: '',
  raw: '',
  repeating: false,
  angle: '',
  radialShape: 'ellipse' as const,
  radialExtent: 'farthest-corner',
  radialPosition: '',
  conicAngle: '0deg',
  conicPosition: '',
  stops: DEFAULT_STOPS,
  ...CSS_INITIAL,
  repeat: 'no-repeat'
};

let idCounter = 0;

export const newLayerId = () => `layer-${++idCounter}`;
export const newStopId = () => `stop-${++idCounter}`;

export function splitTopLevelCommas(str: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';

  for (const char of str) {
    if (char === '(') {
      depth++;
    } else if (char === ')') {
      depth--;
    }

    if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

const LENGTH = /^[-+]?(\d|\.\d)[\w.%]*$|^calc\(/i;

const ANGLE = /^[-+]?(\d|\.\d)[\d.]*(deg|rad|turn|grad)?$/i;

const isLength = (token: string): boolean => LENGTH.test(token);

/** A stop: its color, then none, one or two positions. A lone position is a color hint, kept as it is. */
function parseStopToken(token: string): Omit<GradientStop, 'id'> {
  const parts = splitBySpaceOutsideParens(token.trim());
  let colorEnd = parts.length;
  while (colorEnd > 1 && isLength(parts[colorEnd - 1])) {
    colorEnd--;
  }

  return { color: parts.slice(0, colorEnd).join(' '), position: parts.slice(colorEnd).join(' ') };
}

function parseGradientStops(stops: string[]): GradientStop[] {
  return stops.map(token => ({ id: newStopId(), ...parseStopToken(token) }));
}

function parseLinearGradient(content: string): Partial<BackgroundLayer> {
  const tokens = splitTopLevelCommas(content);
  const first = (tokens[0] ?? '').trim();
  const hasAngle = ANGLE.test(first) || first.startsWith('to ');

  return { angle: hasAngle ? first : '', stops: parseGradientStops(tokens.slice(hasAngle ? 1 : 0)) };
}

const RADIAL_PRELUDE = /^(circle|ellipse|closest-|farthest-|at\s)|\sat\s/;

function parseRadialGradient(content: string): Partial<BackgroundLayer> {
  const tokens = splitTopLevelCommas(content);
  const first = (tokens[0] ?? '').trim();
  const isPrelude = RADIAL_PRELUDE.test(first) || isLength(splitBySpaceOutsideParens(first)[0] ?? '');
  if (!isPrelude) {
    return { stops: parseGradientStops(tokens) };
  }

  const [shapeAndSize, position = ''] = first.startsWith('at ') ? ['', first.slice(3)] : first.split(/\s+at\s+/);
  const parts = splitBySpaceOutsideParens(shapeAndSize);
  const shape = parts.find(part => part === 'circle' || part === 'ellipse');
  const extent = parts.filter(part => part !== 'circle' && part !== 'ellipse').join(' ');

  return {
    radialShape: shape === 'circle' ? 'circle' : 'ellipse',
    radialExtent: extent || DEFAULT_LAYER_PROPS.radialExtent,
    radialPosition: position.trim(),
    stops: parseGradientStops(tokens.slice(1))
  };
}

function parseConicGradient(content: string): Partial<BackgroundLayer> {
  const tokens = splitTopLevelCommas(content);
  const first = (tokens[0] ?? '').trim();
  if (!first.startsWith('from ') && !first.startsWith('at ')) {
    return { stops: parseGradientStops(tokens) };
  }

  return {
    conicAngle: /from\s+(\S+)/.exec(first)?.[1] ?? DEFAULT_LAYER_PROPS.conicAngle,
    conicPosition: /at\s+(.+?)(?:\s+from\s|$)/.exec(first)?.[1].trim() ?? '',
    stops: parseGradientStops(tokens.slice(1))
  };
}

const GRADIENT = /^(repeating-)?(linear|radial|conic)-gradient\(([\s\S]+)\)$/i;

const URL = /^url\(\s*(?:"(.*)"|'(.*)'|(.*?))\s*\)$/i;

function parseImageToken(token: string): Partial<BackgroundLayer> & { type: BackgroundLayerType } {
  const t = token.trim();
  if (!t || t === 'none') {
    return { type: 'none' };
  }

  const url = URL.exec(t);
  if (url) {
    // One of the three groups matched — double quotes, single quotes or none; the others are empty.
    return { type: 'url', url: url.slice(1).find(Boolean) ?? '' };
  }

  const gradient = GRADIENT.exec(t);
  if (!gradient) {
    return { type: 'raw', raw: t };
  }

  const repeating = !!gradient[1];
  const kind = gradient[2].toLowerCase();
  if (kind === 'linear') {
    return { type: 'linear-gradient', repeating, ...parseLinearGradient(gradient[3]) };
  }

  if (kind === 'radial') {
    return { type: 'radial-gradient', repeating, ...parseRadialGradient(gradient[3]) };
  }

  return { type: 'conic-gradient', repeating, ...parseConicGradient(gradient[3]) };
}

const VERTICAL = new Set(['top', 'bottom']);

const HORIZONTAL = new Set(['left', 'right']);

/**
 * A layer's position as its two axes. One value names one axis and centers the other (`20%` is `20% center`, `top`
 * is `center top`); two keywords may come in either order; with offsets (`right 10px bottom 20px`) each axis keeps
 * its keyword and its offset.
 */
const parsePosition = (token: string | undefined): [string, string] => {
  const parts = splitBySpaceOutsideParens(token ?? '');
  if (parts.length === 0) {
    return [CSS_INITIAL.positionX, CSS_INITIAL.positionY];
  }

  if (parts.length === 1) {
    return VERTICAL.has(parts[0]) ? ['center', parts[0]] : [parts[0], 'center'];
  }

  if (parts.length === 2) {
    const [first, second] = parts;

    return VERTICAL.has(first) || HORIZONTAL.has(second) ? [second, first] : [first, second];
  }

  if (parts.length === 3) {
    return isLength(parts[1]) ? [`${parts[0]} ${parts[1]}`, parts[2]] : [parts[0], `${parts[1]} ${parts[2]}`];
  }

  return [`${parts[0]} ${parts[1]}`, parts.slice(2).join(' ')];
};

export type BackgroundCSSValues = {
  'background-image'?: string;
  'background-size'?: string;
  'background-position'?: string;
  'background-repeat'?: string;
  'background-attachment'?: string;
  'background-clip'?: string;
};

/** The value a layer takes from a list: CSS repeats a list shorter than the images over them. */
const nth = (tokens: string[], index: number): string | undefined =>
  tokens.length > 0 ? tokens[index % tokens.length] : undefined;

export function parseBackgroundLayers(values: BackgroundCSSValues): BackgroundLayer[] {
  const imageValue = (values['background-image'] ?? '').trim();
  if (!imageValue || imageValue === 'none') {
    return [];
  }

  const imageTokens = splitTopLevelCommas(imageValue);
  const sizeTokens = splitTopLevelCommas(values['background-size'] ?? '');
  const posTokens = splitTopLevelCommas(values['background-position'] ?? '');
  const repeatTokens = splitTopLevelCommas(values['background-repeat'] ?? '');
  const attachTokens = splitTopLevelCommas(values['background-attachment'] ?? '');
  const clipTokens = splitTopLevelCommas(values['background-clip'] ?? '');

  return imageTokens.map((token, i) => {
    const [positionX, positionY] = parsePosition(nth(posTokens, i));

    return {
      ...DEFAULT_LAYER_PROPS,
      ...parseImageToken(token),
      id: newLayerId(),
      size: nth(sizeTokens, i) ?? CSS_INITIAL.size,
      positionX,
      positionY,
      repeat: nth(repeatTokens, i) ?? CSS_INITIAL.repeat,
      attachment: nth(attachTokens, i) ?? CSS_INITIAL.attachment,
      clip: nth(clipTokens, i) ?? CSS_INITIAL.clip
    };
  });
}

export function serializeStop(stop: GradientStop): string {
  return stop.position ? `${stop.color} ${stop.position}` : stop.color;
}

/** What precedes a gradient's stops, defaults left out: they say nothing, and leaving them keeps the value as read. */
const gradientPrelude = (layer: BackgroundLayer): string => {
  switch (layer.type) {
    case 'linear-gradient':
      return layer.angle;

    case 'radial-gradient': {
      const shape = layer.radialShape !== 'ellipse' ? layer.radialShape : '';
      const extent = layer.radialExtent !== 'farthest-corner' ? layer.radialExtent : '';
      const at = layer.radialPosition ? `at ${layer.radialPosition}` : '';

      return [shape, extent, at].filter(Boolean).join(' ');
    }

    case 'conic-gradient': {
      const from = layer.conicAngle && layer.conicAngle !== '0deg' ? `from ${layer.conicAngle}` : '';
      const at = layer.conicPosition ? `at ${layer.conicPosition}` : '';

      return [from, at].filter(Boolean).join(' ');
    }

    default:
      return '';
  }
};

export function serializeLayerImage(layer: BackgroundLayer): string {
  switch (layer.type) {
    case 'url':
      return `url("${layer.url}")`;

    case 'raw':
      return layer.raw || 'none';

    case 'linear-gradient':
    case 'radial-gradient':
    case 'conic-gradient': {
      const prelude = gradientPrelude(layer);
      const stops = layer.stops.map(serializeStop).join(', ');

      return `${layer.repeating ? 'repeating-' : ''}${layer.type}(${prelude ? `${prelude}, ` : ''}${stops})`;
    }

    default:
      return 'none';
  }
}

export function serializeLayersToCSS(layers: BackgroundLayer[]): BackgroundCSSValues {
  if (layers.length === 0) {
    return {
      'background-image': undefined,
      'background-size': undefined,
      'background-position': undefined,
      'background-repeat': undefined,
      'background-attachment': undefined,
      'background-clip': undefined
    };
  }

  return {
    'background-image': layers.map(serializeLayerImage).join(', '),
    'background-size': layers.map(l => l.size).join(', '),
    'background-position': layers.map(l => `${l.positionX} ${l.positionY}`).join(', '),
    'background-repeat': layers.map(l => l.repeat).join(', '),
    'background-attachment': layers.map(l => l.attachment).join(', '),
    'background-clip': layers.map(l => l.clip).join(', ')
  };
}
