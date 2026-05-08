import type { ColorScale, NamedToken, StyleGuideData } from '../../helpers/getStyleGuideResult';

export const needsWhiteText = (hex?: string): boolean => {
  if (!hex || hex.length < 7) {
    return false;
  }

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.55;
};

export const SHADE_ORDER = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

export const sortedShades = (scale: ColorScale) =>
  Object.entries(scale).sort(([a], [b]) => SHADE_ORDER.indexOf(a) - SHADE_ORDER.indexOf(b));

export type CssVar = { varName: string; value: string; preview?: string };

export const buildCssVars = (
  colors: StyleGuideData['colors'],
  typography: StyleGuideData['typography'],
  spacing: StyleGuideData['spacing'],
  borderRadius: StyleGuideData['borderRadius'],
  shadows: StyleGuideData['shadows']
): CssVar[] => {
  const vars: CssVar[] = [];
  const colorRoles = ['primary', 'secondary', 'accent', 'neutral'] as const;

  for (const role of colorRoles) {
    const scale = colors[role];
    if (!scale) {
      continue;
    }

    for (const [shade, hex] of sortedShades(scale)) {
      vars.push({ varName: `--color-${role}-${shade}`, value: hex, preview: hex });
    }
  }

  if (colors.semantic) {
    const { success, warning, error, info } = colors.semantic;

    if (success) {
      vars.push({ varName: '--color-success', value: success, preview: success });
    }

    if (warning) {
      vars.push({ varName: '--color-warning', value: warning, preview: warning });
    }

    if (error) {
      vars.push({ varName: '--color-error', value: error, preview: error });
    }

    if (info) {
      vars.push({ varName: '--color-info', value: info, preview: info });
    }
  }

  if (typography) {
    vars.push({ varName: '--font-heading', value: typography.fontFamily.heading });
    vars.push({ varName: '--font-body', value: typography.fontFamily.body });
    typography.scale?.forEach(s => vars.push({ varName: `--font-size-${s.name}`, value: s.size }));
  }

  spacing?.forEach(({ name, value }: NamedToken) => vars.push({ varName: `--spacing-${name}`, value }));
  borderRadius?.forEach(({ name, value }: NamedToken) => vars.push({ varName: `--radius-${name}`, value }));
  shadows?.forEach(({ name, value }: NamedToken) => vars.push({ varName: `--shadow-${name}`, value }));

  return vars;
};
