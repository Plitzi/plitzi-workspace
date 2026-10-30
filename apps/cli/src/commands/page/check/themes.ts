import { openPage } from '@plitzi/sdk-authoring';

import { openProjectPage, projectSettling, VIEW_HEIGHT } from '../../../browser';
import { awaitHydration } from '../hydration';
import { standInPictures } from '../visit';

import type { CheckIssue } from './types';
import type { Browser } from '../../../browser';

/**
 * A ground that does not follow the theme under a text that does, read where it costs the text: in one scheme the two
 * barely tell apart. A run's judges' rows were a fixed dark colour (`on-photo-shade` at 55%) under the
 * theme's text — right in dark, grey bars with dark words in light; the reference had no light scheme, and only the
 * lead's look saw it. Read in both schemes, element by element: the same ground in both, its text's colour not, and in
 * one of them under 3:1 against it. A text that changes its colour and reads well on both (cream, then gold, on a dark
 * card) is no finding; a ground that is a picture cannot be judged, and is not.
 */

/** A text of the page: its element, its colour, the ground under it, and the page's own background behind that. */
export interface TextGround {
  text: string;
  color: string;
  ground: string;
  /** The ground's `background-color` and `background-image`, as computed. */
  background: string;
  /** The page's own background colour: what a ground's transparency shows through. */
  page: string;
}

/**
 * Run in the page: each element with words of its own a reader sees — not one hidden for screen readers alone (a box of
 * a pixel, or one that it or a box above it clips to nothing: `overflow: hidden` on a pixel, `clip-path: inset(50%)`,
 * `clip: rect(0 0 0 0)`), nor one transparent — its colour, and the nearest element, it or one above it, painting a
 * background. Self-contained: sent to the browser as it is.
 */
export const textGrounds = (): TextGround[] => {
  const named = (node: Element): string => node.getAttribute('data-plitzi-el') ?? node.tagName.toLowerCase();
  const paints = (node: Element): boolean => {
    const style = getComputedStyle(node);
    const alpha = /rgba?\([^)]*?,\s*([\d.]+)\)$/.exec(style.backgroundColor)?.[1];

    return style.backgroundImage !== 'none' || (style.backgroundColor !== 'transparent' && alpha !== '0');
  };
  // The page's own ground: the first of the body, the document and the root of the space that is not transparent.
  const page =
    [document.body, document.documentElement, document.querySelector('[data-plitzi-el]')]
      .flatMap(node => (node ? [getComputedStyle(node).backgroundColor] : []))
      .find(colour => colour !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(colour)) ?? 'rgb(255, 255, 255)';

  // An sr-only line's words overflow a pixel-wide box, so their own box can be large: only the box clipping them says
  // nobody sees them (a run's ON AIR lamp). A clipping box of any size is left be — a scrolled panel shows its words.
  const tiny = (box: DOMRect): boolean => box.width < 2 || box.height < 2;
  const seen = (node: Element): boolean => {
    if (tiny(node.getBoundingClientRect())) {
      return false;
    }

    for (let at: Element | null = node; at; at = at.parentElement) {
      const style = getComputedStyle(at);
      const clipsAll =
        /inset\(\s*50%/.test(style.clipPath) || /^rect\(0(px)?,?\s*0(px)?,?\s*0(px)?,?\s*0(px)?\)$/.test(style.clip);
      const clipsToAPixel =
        /hidden|clip|auto|scroll/.test(`${style.overflow} ${style.overflowX} ${style.overflowY}`) &&
        tiny(at.getBoundingClientRect());
      if (clipsAll || clipsToAPixel) {
        return false;
      }
    }

    return true;
  };

  return Array.from(document.querySelectorAll('[data-plitzi-el]')).flatMap(node => {
    const words = Array.from(node.childNodes).some(
      child => child.nodeType === 3 && (child.textContent ?? '').trim() !== ''
    );
    const style = getComputedStyle(node);
    if (!words || !seen(node) || style.visibility === 'hidden' || Number(style.opacity) === 0) {
      return [];
    }

    let ground: Element | null = node;
    while (ground && !paints(ground)) {
      ground = ground.parentElement;
    }

    const under = ground ? getComputedStyle(ground) : undefined;

    return [
      {
        text: named(node),
        color: style.color,
        ground: ground ? named(ground) : 'the page',
        background: under ? `${under.backgroundColor} ${under.backgroundImage}`.slice(0, 160) : '',
        page
      }
    ];
  });
};

/** A colour as a browser computes it — `rgb()`, `rgba()`, `color(srgb …)` — in channels 0–255 and its alpha. */
const colourOf = (text: string): [number, number, number, number] | undefined => {
  const rgb = /rgba?\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\s*\)/.exec(text);
  if (rgb) {
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] ? Number(rgb[4]) : 1];
  }

  const srgb = /color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)/.exec(text);

  return srgb
    ? [Number(srgb[1]) * 255, Number(srgb[2]) * 255, Number(srgb[3]) * 255, srgb[4] ? Number(srgb[4]) : 1]
    : undefined;
};

/** One colour over another, as the eye sees a transparent one. */
const over = (
  top: [number, number, number, number],
  base: [number, number, number, number]
): [number, number, number, number] => [
  top[0] * top[3] + base[0] * (1 - top[3]),
  top[1] * top[3] + base[1] * (1 - top[3]),
  top[2] * top[3] + base[2] * (1 - top[3]),
  1
];

const luminance = ([r, g, b]: [number, number, number, number]): number => {
  const linear = (channel: number): number => {
    const value = channel / 255;

    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
};

/** WCAG's contrast of two colours, 1 to 21. */
const contrast = (a: [number, number, number, number], b: [number, number, number, number]): number => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);

  return (light + 0.05) / (dark + 0.05);
};

/**
 * The colour a ground paints: its own, or its gradient's first stop over it — none for a picture, which is not judged.
 * Seen over the page's background where it lets that through.
 */
const groundColour = (reading: TextGround): [number, number, number, number] | undefined => {
  const page = colourOf(reading.page) ?? [255, 255, 255, 1];
  const [colour, ...image] = reading.background.split(/ (?=none|url|linear|radial|conic|repeating)/);
  const own = colourOf(colour);
  const painted = image.join(' ');
  if (/url\(/.test(painted)) {
    return undefined;
  }

  const stop = /gradient/.test(painted) ? colourOf(painted) : undefined;
  const base = own && own[3] > 0 ? over(own, page) : page;

  return stop ? over(stop, base) : own && own[3] > 0 ? base : undefined;
};

/** Below it a text barely tells from its ground: WCAG's for large text, the least any text is held to. */
const FAINT = 3;

/** Each ground the same in both schemes under a text that changes and, in one of them, barely reads on it. */
export const fixedGrounds = (
  light: readonly TextGround[],
  dark: readonly TextGround[]
): Omit<CheckIssue, 'width'>[] => {
  const inDark = new Map(dark.map(each => [each.text, each]));
  const found = new Map<string, Omit<CheckIssue, 'width'>>();
  for (const lit of light) {
    const other = inDark.get(lit.text);
    if (
      other === undefined ||
      found.has(lit.ground) ||
      lit.ground === 'the page' ||
      other.ground !== lit.ground ||
      other.background !== lit.background ||
      other.color === lit.color
    ) {
      continue;
    }

    const [groundLight, groundDark] = [groundColour(lit), groundColour(other)];
    const [textLight, textDark] = [colourOf(lit.color), colourOf(other.color)];
    if (!groundLight || !groundDark || !textLight || !textDark) {
      continue;
    }

    const readings = [
      { scheme: 'light', ratio: contrast(over(textLight, groundLight), groundLight) },
      { scheme: 'dark', ratio: contrast(over(textDark, groundDark), groundDark) }
    ];
    const faint = readings.find(reading => reading.ratio < FAINT);
    if (!faint) {
      continue;
    }

    found.set(lit.ground, {
      code: 'fixed-ground',
      elementId: lit.ground,
      message: `${lit.ground}'s ground is the same in light and dark (${lit.background.trim()}) while the text on it follows the theme — ${lit.text}: ${lit.color} in light, ${other.color} in dark — and in ${faint.scheme} it reads at ${faint.ratio.toFixed(1)}:1. Give the ground a theme token (light and dark), or the text a colour of its own`
    });
  }

  return [...found.values()];
};

/**
 * Each text that barely reads on its ground, in the scheme it was read in: under 3:1 a visitor can hardly tell its
 * words from what is under them. A run's later shows printed rgb(99, 86, 69) on a readout's rgb(31, 27, 20) glass in
 * light — about 2.4:1 — and every check said "nothing wrong", the picture alone showing it. A ground that is a picture
 * is not judged; a ground's colours are said once, its texts together.
 */
export const faintTexts = (readings: readonly TextGround[]): Omit<CheckIssue, 'width'>[] => {
  const byGround = new Map<string, { texts: string[]; ratio: number; color: string; background: string }>();
  for (const reading of readings) {
    // Judged on a ground of one opaque colour alone — the page's own, or a box's with no picture or gradient: a
    // translucent one shows what is under it, and a gradient's layers (a night sky's lights) are no one colour.
    const [own = '', ...image] = reading.background.split(/ (?=none|url|linear|radial|conic|repeating)/);
    const solid = colourOf(own);
    const ground =
      reading.ground === 'the page'
        ? colourOf(reading.page)
        : image.join(' ').trim() === 'none' && solid !== undefined && solid[3] === 1
          ? solid
          : undefined;
    const text = colourOf(reading.color);
    if (!ground || !text) {
      continue;
    }

    const ratio = contrast(over(text, ground), ground);
    if (ratio >= FAINT) {
      continue;
    }

    const key = `${reading.ground}|${reading.color}`;
    const kept = byGround.get(key);
    if (kept) {
      kept.texts.push(reading.text);
    } else {
      byGround.set(key, {
        texts: [reading.text],
        ratio,
        color: reading.color,
        background: reading.ground === 'the page' ? reading.page : reading.background.trim()
      });
    }
  }

  return [...byGround].map(([key, each]) => ({
    code: 'faint-text' as const,
    elementId: each.texts[0],
    message: `${each.texts.slice(0, 4).join(', ')}${each.texts.length > 4 ? ` and ${String(each.texts.length - 4)} more` : ''} ${each.texts.length === 1 ? 'reads' : 'read'} at ${each.ratio.toFixed(1)}:1 on ${key.split('|')[0]} (${each.color} on ${each.background}) — under 3:1 a visitor can hardly tell the words from their ground: a text colour, a token of the theme, that reads on it`
  }));
};

/** One page read in light and in dark, at `width`: the grounds that do not follow the theme under text that does. */
export const themeIssues = async (
  browser: Browser,
  origin: string,
  route: string,
  width: number,
  { standIns = false, height = VIEW_HEIGHT }: { standIns?: boolean; height?: number } = {}
): Promise<CheckIssue[]> => {
  const read = async (scheme: 'light' | 'dark'): Promise<TextGround[]> => {
    const page = await openProjectPage(browser, origin, { width, height, reducedMotion: true, scheme });
    if (standIns) {
      await standInPictures(page, origin);
    }

    try {
      await openPage(page, `${origin}${route}`, projectSettling(page));
      // A page that does not hydrate is said by the check's own reading of it (`not-hydrated`), not again per theme.
      await awaitHydration(page);

      return await page.evaluate(textGrounds, undefined);
    } finally {
      await page.close();
    }
  };
  const [light, dark] = await Promise.all([read('light'), read('dark')]);

  return fixedGrounds(light, dark).map(issue => ({ ...issue, width }));
};
