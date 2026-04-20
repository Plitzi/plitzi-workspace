export type GradientStop = {
  id: string;
  color: string;
  position: string;
};

export type BackgroundLayerType = 'none' | 'url' | 'linear-gradient' | 'radial-gradient' | 'conic-gradient';

export type BackgroundLayer = {
  id: string;
  type: BackgroundLayerType;
  url: string;
  angle: string;
  radialShape: 'circle' | 'ellipse';
  radialExtent: string;
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

export const DEFAULT_LAYER_PROPS = {
  url: '',
  angle: '180deg',
  radialShape: 'ellipse' as const,
  radialExtent: 'farthest-corner',
  radialPosition: '50% 50%',
  conicAngle: '0deg',
  conicPosition: '50% 50%',
  stops: DEFAULT_STOPS,
  size: 'auto',
  positionX: '0%',
  positionY: '0%',
  repeat: 'no-repeat',
  attachment: 'scroll',
  clip: 'border-box'
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

function parseStopToken(token: string): Omit<GradientStop, 'id'> {
  const t = token.trim();

  let depth = 0;
  let lastSpaceIdx = -1;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '(') {
      depth++;
    } else if (t[i] === ')') {
      depth--;
    } else if (t[i] === ' ' && depth === 0) {
      lastSpaceIdx = i;
    }
  }

  if (lastSpaceIdx !== -1) {
    const maybePosition = t.slice(lastSpaceIdx + 1).trim();
    if (/^-?[\d.]/.test(maybePosition) || /\d(px|em|rem|%|vw|vh|dvh|dvw|lvh|lvw|fr|ch|ex)$/.test(maybePosition)) {
      return { color: t.slice(0, lastSpaceIdx).trim(), position: maybePosition };
    }
  }

  return { color: t, position: '' };
}

function parseGradientStops(stopsStr: string): GradientStop[] {
  return splitTopLevelCommas(stopsStr).map(token => ({ id: newStopId(), ...parseStopToken(token) }));
}

function parseLinearGradient(content: string): Partial<BackgroundLayer> {
  const tokens = splitTopLevelCommas(content);
  const first = (tokens[0] ?? '').trim();

  const isAngle = /^\d/.test(first) || first.startsWith('to ');
  const angle = isAngle ? first : DEFAULT_LAYER_PROPS.angle;
  const stopsStr = tokens.slice(isAngle ? 1 : 0).join(', ');

  return { angle, stops: parseGradientStops(stopsStr) };
}

function parseRadialGradient(content: string): Partial<BackgroundLayer> {
  const tokens = splitTopLevelCommas(content);
  const first = (tokens[0] ?? '').trim();

  let radialShape: 'circle' | 'ellipse' = DEFAULT_LAYER_PROPS.radialShape;
  let radialExtent = DEFAULT_LAYER_PROPS.radialExtent;
  let radialPosition = DEFAULT_LAYER_PROPS.radialPosition;
  let stopsStart = 0;

  if (/circle|ellipse|closest|farthest|at\s/.test(first)) {
    stopsStart = 1;
    if (first.includes('circle')) {
      radialShape = 'circle';
    }

    if (first.includes('ellipse')) {
      radialShape = 'ellipse';
    }

    if (first.includes('closest-side')) {
      radialExtent = 'closest-side';
    } else if (first.includes('closest-corner')) {
      radialExtent = 'closest-corner';
    } else if (first.includes('farthest-side')) {
      radialExtent = 'farthest-side';
    } else if (first.includes('farthest-corner')) {
      radialExtent = 'farthest-corner';
    }

    const atMatch = first.match(/at\s+(.+)$/);
    if (atMatch) {
      radialPosition = atMatch[1].trim();
    }
  }

  const stopsStr = tokens.slice(stopsStart).join(', ');
  return { radialShape, radialExtent, radialPosition, stops: parseGradientStops(stopsStr) };
}

function parseConicGradient(content: string): Partial<BackgroundLayer> {
  const tokens = splitTopLevelCommas(content);
  const first = (tokens[0] ?? '').trim();

  let conicAngle = DEFAULT_LAYER_PROPS.conicAngle;
  let conicPosition = DEFAULT_LAYER_PROPS.conicPosition;
  let stopsStart = 0;

  if (first.startsWith('from ') || first.startsWith('at ')) {
    stopsStart = 1;
    const fromMatch = first.match(/from\s+([\d.]+(?:deg|rad|turn|grad))/);
    if (fromMatch) {
      conicAngle = fromMatch[1];
    }

    const atMatch = first.match(/at\s+(.+?)(?:\s+from|$)/);
    if (atMatch) {
      conicPosition = atMatch[1].trim();
    }
  }

  const stopsStr = tokens.slice(stopsStart).join(', ');
  return { conicAngle, conicPosition, stops: parseGradientStops(stopsStr) };
}

function parseImageToken(token: string): Partial<BackgroundLayer> & { type: BackgroundLayerType } {
  const t = token.trim();

  if (!t || t === 'none') {
    return { type: 'none' };
  }

  const urlDoubleQuote = t.match(/^url\("(.*)"\)$/i);
  if (urlDoubleQuote) {
    return { type: 'url', url: urlDoubleQuote[1] };
  }

  const urlSingleQuote = t.match(/^url\('(.*)'\)$/i);
  if (urlSingleQuote) {
    return { type: 'url', url: urlSingleQuote[1] };
  }

  const urlNoQuote = t.match(/^url\((.*)\)$/i);
  if (urlNoQuote) {
    return { type: 'url', url: urlNoQuote[1] };
  }

  const linearMatch = t.match(/^linear-gradient\(([\s\S]+)\)$/i);
  if (linearMatch) {
    return { type: 'linear-gradient', ...parseLinearGradient(linearMatch[1]) };
  }

  const radialMatch = t.match(/^radial-gradient\(([\s\S]+)\)$/i);
  if (radialMatch) {
    return { type: 'radial-gradient', ...parseRadialGradient(radialMatch[1]) };
  }

  const conicMatch = t.match(/^conic-gradient\(([\s\S]+)\)$/i);
  if (conicMatch) {
    return { type: 'conic-gradient', ...parseConicGradient(conicMatch[1]) };
  }

  return { type: 'none' };
}

export type BackgroundCSSValues = {
  'background-image'?: string;
  'background-size'?: string;
  'background-position'?: string;
  'background-repeat'?: string;
  'background-attachment'?: string;
  'background-clip'?: string;
};

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
    const parsed = parseImageToken(token);
    const posParts = (posTokens[i] ?? '').split(' ').filter(Boolean);

    return {
      ...DEFAULT_LAYER_PROPS,
      ...parsed,
      id: newLayerId(),
      size: sizeTokens[i] ?? DEFAULT_LAYER_PROPS.size,
      positionX: posParts.at(0) ?? DEFAULT_LAYER_PROPS.positionX,
      positionY: posParts.at(1) ?? posParts.at(0) ?? DEFAULT_LAYER_PROPS.positionY,
      repeat: repeatTokens[i] ?? DEFAULT_LAYER_PROPS.repeat,
      attachment: attachTokens[i] ?? DEFAULT_LAYER_PROPS.attachment,
      clip: clipTokens[i] ?? DEFAULT_LAYER_PROPS.clip
    };
  });
}

export function serializeStop(stop: GradientStop): string {
  return stop.position ? `${stop.color} ${stop.position}` : stop.color;
}

export function serializeLayerImage(layer: BackgroundLayer): string {
  switch (layer.type) {
    case 'url':
      return `url("${layer.url}")`;

    case 'linear-gradient': {
      const stops = layer.stops.map(serializeStop).join(', ');
      return `linear-gradient(${layer.angle}, ${stops})`;
    }

    case 'radial-gradient': {
      const stops = layer.stops.map(serializeStop).join(', ');
      const shapeStr = layer.radialShape !== 'ellipse' ? `${layer.radialShape} ` : '';
      const extentStr = layer.radialExtent !== 'farthest-corner' ? `${layer.radialExtent} ` : '';
      const atStr = `at ${layer.radialPosition}`;
      const prefix = shapeStr || extentStr ? `${shapeStr}${extentStr}${atStr}` : atStr;
      return `radial-gradient(${prefix}, ${stops})`;
    }

    case 'conic-gradient': {
      const stops = layer.stops.map(serializeStop).join(', ');
      const fromStr = layer.conicAngle !== '0deg' ? `from ${layer.conicAngle} ` : '';
      const atStr = `at ${layer.conicPosition}`;
      return `conic-gradient(${fromStr}${atStr}, ${stops})`;
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
