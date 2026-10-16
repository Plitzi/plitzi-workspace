import clsx from 'clsx';
import { memo, use, useMemo } from 'react';

import { CHECKERBOARD } from './helpers';
import { resolveTokens } from '../../cssValues';
import StyleInspectorContext from '../../StyleInspectorContext';

import type { CSSProperties } from 'react';

export type ColorSwatchProps = {
  className?: string;
  /** A color, or any background (a gradient, an image) — drawn over a checkerboard so transparency shows. */
  value: string;
  property?: 'background-color' | 'background';
};

/**
 * A preview of a color or a background in the editor's own document, where the space's tokens do not exist: they are
 * resolved first, so `var(--accent)` shows the accent rather than nothing. The ring keeps black visible on the dark
 * theme and white on the light one.
 */
const ColorSwatch = ({ className, value, property = 'background-color' }: ColorSwatchProps) => {
  const { variables } = use(StyleInspectorContext);
  const style = useMemo<CSSProperties>(
    () => ({ [property === 'background' ? 'background' : 'backgroundColor']: resolveTokens(value, variables) }),
    [property, value, variables]
  );

  return (
    <span
      className={clsx(
        'relative inline-flex shrink-0 overflow-hidden rounded ring-1 ring-black/15 ring-inset dark:ring-white/20',
        className
      )}
      style={CHECKERBOARD}
    >
      <span className="absolute inset-0" style={style} />
    </span>
  );
};

export default memo(ColorSwatch);
