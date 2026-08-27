import { css } from './css';

import type { CssProps, StyleRules } from './types';

/**
 * The three layouts every space writes over and over.
 *
 * Sugar over {@link css}, not a layout system: each one is the two display declarations plus whatever else was
 * asked for, so anything they do not cover is written as plain CSS in the same object.
 */

export const column = (gap: string, extra: CssProps = {}): StyleRules =>
  css({ display: 'flex', 'flex-direction': 'column', gap, ...extra });

export const row = (gap: string, extra: CssProps = {}): StyleRules =>
  css({ display: 'flex', 'flex-direction': 'row', gap, ...extra });

export const grid = (columns: string, gap: string, extra: CssProps = {}): StyleRules =>
  css({ display: 'grid', 'grid-template-columns': columns, gap, ...extra });
