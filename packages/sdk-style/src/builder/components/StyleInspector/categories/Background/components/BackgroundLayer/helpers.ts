import type { BackgroundLayer, BackgroundLayerType } from '../../helpers/backgroundParser';

export const LAYER_TYPE_LABELS: Record<BackgroundLayerType, string> = {
  none: 'None',
  url: 'Image',
  'linear-gradient': 'Linear gradient',
  'radial-gradient': 'Radial gradient',
  'conic-gradient': 'Conic gradient',
  raw: 'Custom (CSS)'
};

/** The order the type picker lists them in. */
export const LAYER_TYPES: BackgroundLayerType[] = [
  'linear-gradient',
  'radial-gradient',
  'conic-gradient',
  'url',
  'raw',
  'none'
];

export const CLIP_OPTIONS = [
  { value: 'border-box', label: 'Border box' },
  { value: 'padding-box', label: 'Padding box' },
  { value: 'content-box', label: 'Content box' },
  { value: 'text', label: 'Text' }
];

export const isGradient = (type: BackgroundLayerType): boolean =>
  type === 'linear-gradient' || type === 'radial-gradient' || type === 'conic-gradient';

/** The file a url names, for the row: the last part of its path, not the whole address. */
const fileName = (url: string): string => url.split(/[?#]/)[0].split('/').filter(Boolean).at(-1) ?? url;

/** How a layer's row names it: what it is, and the one detail that tells two of a kind apart. */
export const layerSummary = (layer: BackgroundLayer): string => {
  const label = `${layer.repeating ? 'Repeating ' : ''}${LAYER_TYPE_LABELS[layer.type]}`;
  switch (layer.type) {
    case 'url':
      return layer.url ? `${label} · ${fileName(layer.url)}` : `${label} · no URL yet`;

    case 'raw':
      return `Custom · ${layer.raw}`;

    case 'linear-gradient':
      return `${label} · ${layer.angle || 'to bottom'}`;

    case 'radial-gradient':
      return `${label} · ${layer.radialShape}`;

    case 'conic-gradient':
      return `${label} · from ${layer.conicAngle || '0deg'}`;

    default:
      return label;
  }
};
