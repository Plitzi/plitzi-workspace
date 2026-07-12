import type { ColorItem } from '../../helpers/toolVisualTypes';

export const ROLE_ORDER = [
  'primary',
  'secondary',
  'accent',
  'background',
  'surface',
  'neutral',
  'text',
  'success',
  'warning',
  'error',
  'info'
];

export const sortedColors = (colors: ColorItem[]) =>
  [...colors].sort((a, b) => {
    const ai = ROLE_ORDER.indexOf(a.role ?? '');
    const bi = ROLE_ORDER.indexOf(b.role ?? '');

    if (ai === -1 && bi === -1) {
      return 0;
    }

    if (ai === -1) {
      return 1;
    }

    if (bi === -1) {
      return -1;
    }

    return ai - bi;
  });

export const toVarName = (role: string | undefined, name: string) =>
  `--color-${(role ?? name).toLowerCase().replace(/\s+/g, '-')}`;

export const getHex = (c: ColorItem, isDark: boolean) => (isDark && c.darkHex ? c.darkHex : c.hex);
