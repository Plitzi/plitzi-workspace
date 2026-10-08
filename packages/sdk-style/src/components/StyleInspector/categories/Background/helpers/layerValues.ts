import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

/** The properties a background's layers are written across, one comma-separated list each. */
export const BG_LAYER_KEYS: StyleCategory[] = [
  'background-image',
  'background-size',
  'background-position',
  'background-repeat',
  'background-attachment',
  'background-clip'
];

/**
 * The layers' properties as one string — what tells a change made elsewhere (undo, another collaborator) from the one
 * the editor just wrote, which it already shows.
 */
export const layerValuesKey = (record: Partial<Record<StyleCategory, StyleValue>>): string =>
  BG_LAYER_KEYS.map(key => String(record[key])).join('||');
