import { splitBySpaceOutsideParens } from './cssValues';

/** One shadow of a `box-shadow` or `text-shadow` list, its parts named. A text shadow has no `inset` and no `spread`. */
export type Shadow = {
  inset: boolean;
  x: string;
  y: string;
  blur: string;
  spread: string;
  color: string;
};

export const DEFAULT_SHADOW: Shadow = {
  inset: false,
  x: '0px',
  y: '4px',
  blur: '12px',
  spread: '0px',
  color: 'rgba(0, 0, 0, 0.25)'
};

const LENGTH = /^[-+]?(\d|\.\d)|^calc\(/i;

/**
 * A shadow as CSS allows it to be written: `inset` and the color on either end, two to four lengths between. What does
 * not read as one — a token standing for the whole shadow, `none` — answers `undefined`, and the editor keeps it as
 * text rather than replacing it with a guess.
 */
export const parseShadow = (value: string): Shadow | undefined => {
  const lengths: string[] = [];
  let inset = false;
  let color: string | undefined;

  for (const token of splitBySpaceOutsideParens(value.trim())) {
    if (token.toLowerCase() === 'inset') {
      inset = true;
    } else if (LENGTH.test(token)) {
      lengths.push(token);
    } else if (/^var\(/i.test(token) && lengths.length < 2) {
      // A token before the offsets are complete is one of them; after, it can only be the color.
      lengths.push(token);
    } else if (color === undefined) {
      color = token;
    } else {
      return undefined;
    }
  }

  if (lengths.length < 2 || lengths.length > 4) {
    return undefined;
  }

  const [x, y, blur = '0px', spread = '0px'] = lengths;

  return { inset, x, y, blur, spread, color: color ?? 'currentColor' };
};

/** Written back in the canonical order, `spread` and `inset` only where the property has them. */
export const serializeShadow = (shadow: Shadow, { withSpread }: { withSpread: boolean }): string =>
  [
    withSpread && shadow.inset ? 'inset' : undefined,
    shadow.x,
    shadow.y,
    shadow.blur,
    withSpread ? shadow.spread : undefined,
    shadow.color
  ]
    .filter((part): part is string => !!part)
    .join(' ');
