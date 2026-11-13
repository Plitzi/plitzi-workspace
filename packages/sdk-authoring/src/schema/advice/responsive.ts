import { pageLayouts } from '@plitzi/sdk-shared/schema';

import type { Suggestion } from './types';
import type { Element, Schema, Style, StyleObject, StyleValue } from '@plitzi/sdk-shared';

/**
 * A page styled for the desktop alone where a phone breaks: a width wider than the phone, a grid of three or more
 * columns of fixed tracks, a type size a phone's line holds two words of — written at the desktop, and set again by no
 * `mobile` rule of the classes that carry it (a style's `mobile` is laid over its `desktop` alone, so a `tablet` rule
 * does not reach a phone).
 *
 * Not "no media query": a layout that is fluid on its own — wrapping flex, widths in `%`, `min()` and `clamp()`,
 * `repeat(auto-fit, minmax(…))` — is responsive without one, and is never named. Only a space written desktop first
 * (the default): written mobile first, its base is the phone's.
 */

/** A phone's width, the one the platform's checks draw a page at. */
const PHONE_PX = 390;
/** What a phone leaves a page's content: its width less a gutter each side. */
const PHONE_CONTENT_PX = PHONE_PX - 32;
/** Past this a width overflows a phone, or a tablet held upright, whatever the padding around it. */
const WIDE_PX = 480;
/** Past this a heading on a phone holds a word or two a line, and a long one breaks a word; a price of 56 px fits. */
const LARGE_TYPE_PX = 64;
/** A column a phone squeezes below this holds a card's words a few letters a line. */
const NARROW_COLUMN_PX = 120;
/** From this gap a grid lays out a page's parts — cards, footer columns — not a dense widget (a chart, a tray). */
const LAYOUT_GAP_PX = 16;
const ROOT_PX = 16;

/** A plain length in px — `960px`, `60rem` — or `undefined` for anything fluid or computed. */
const pixels = (value: StyleValue | undefined): number | undefined => {
  if (typeof value === 'number') {
    return value;
  }

  const match = /^\s*(-?\d+(?:\.\d+)?)(px|rem|em)\s*$/.exec(value ?? '');
  if (!match) {
    return undefined;
  }

  const size = Number(match[1]);

  return match[2] === 'px' ? size : size * ROOT_PX;
};

/** The top-level parts of a value, split at the spaces outside any parentheses: `minmax(0, 1fr)` is one. */
const topLevel = (text: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of text) {
    depth += char === '(' ? 1 : char === ')' ? -1 : 0;
    if (/\s/.test(char) && depth === 0) {
      if (current !== '') {
        parts.push(current);
      }

      current = '';
    } else {
      current += char;
    }
  }

  return current === '' ? parts : [...parts, current];
};

/** A grid's tracks with `repeat(n, …)` written out; `undefined` for one that fits its tracks to the width (`auto-fit`). */
const tracksOf = (value: StyleValue | undefined): string[] | undefined => {
  const text = String(value ?? '').trim();
  if (text === '' || /auto-fit|auto-fill/.test(text)) {
    return undefined;
  }

  return topLevel(text).flatMap(part => {
    const repeated = /^repeat\(\s*(\d+)\s*,(.*)\)$/.exec(part);

    return repeated ? Array.from({ length: Number(repeated[1]) }, () => topLevel(repeated[2])).flat() : [part];
  });
};

/** One track: what it takes at least (`px`, a `minmax` floor), and the share of what is left it grows by (`fr`). */
const trackOf = (track: string): { floor: number; share: number } => {
  const minmax = /^minmax\(\s*([^,]+),\s*(.+)\)$/.exec(track);
  const floor = pixels(minmax ? minmax[1] : track) ?? 0;
  const grows = /^(\d+(?:\.\d+)?)fr$/.exec((minmax ? minmax[2] : track).trim());

  return { floor, share: grows ? Number(grows[1]) : 0 };
};

/**
 * What a grid does to a phone, in words, or nothing: its floors and gaps wider than a phone's content — or three or
 * more columns sharing the width, laid out a page's parts apart (`LAYOUT_GAP_PX`), each left narrower than a card reads
 * at. A row whose one growing column takes what fixed ones leave (`48px 1fr auto`) fits, and a dense widget's many thin
 * columns (a chart's bars, an emoji tray) are what it means to draw.
 */
const gridRisk = (rules: StyleObject): string | undefined => {
  const read = (property: string): StyleValue | undefined =>
    (rules as Record<string, StyleValue | undefined>)[property];
  const tracks = tracksOf(read('grid-template-columns'));
  if (!tracks || tracks.length < 2) {
    return undefined;
  }

  const gap = pixels(read('column-gap')) ?? pixels(topLevel(String(read('gap') ?? ''))[1] ?? read('gap')) ?? 0;
  const gaps = gap * (tracks.length - 1);
  const parsed = tracks.map(trackOf);
  const floors = parsed.reduce((sum, track) => sum + track.floor, 0);
  if (floors + gaps > PHONE_CONTENT_PX) {
    return `${String(tracks.length)} columns at least ${String(Math.round(floors + gaps))}px wide`;
  }

  const sharing = parsed.filter(track => track.share > 0);
  const shares = sharing.reduce((sum, track) => sum + track.share, 0);
  if (sharing.length < 3 || gap < LAYOUT_GAP_PX || shares === 0) {
    return undefined;
  }

  const narrowest = Math.min(
    ...sharing.map(track => track.floor + ((PHONE_CONTENT_PX - floors - gaps) / shares) * track.share)
  );

  return narrowest < NARROW_COLUMN_PX
    ? `${String(tracks.length)} columns, about ${String(Math.max(0, Math.round(narrowest)))}px each on a phone`
    : undefined;
};

type Risk = { property: string; value: StyleValue; says: string };

/** What of one class's desktop rules breaks on a phone, in words: `width 960px`, `4 columns`. */
const risksOf = (rules: StyleObject): Risk[] => {
  const risks: Risk[] = [];
  const read = (property: string): StyleValue | undefined =>
    (rules as Record<string, StyleValue | undefined>)[property];
  // Held to the width it is in by a max-width it also says: a `width: 960px; max-width: 100%` box is fluid.
  const capped = /%|vw/.test(String(read('max-width') ?? '')) || (pixels(read('max-width')) ?? Infinity) <= PHONE_PX;
  for (const property of ['width', 'min-width']) {
    const size = pixels(read(property));
    if (size !== undefined && size >= WIDE_PX && (property === 'min-width' || !capped)) {
      risks.push({ property, value: read(property) ?? '', says: `${property} ${String(read(property))}` });
    }
  }

  const grid = gridRisk(rules);
  if (grid !== undefined) {
    risks.push({ property: 'grid-template-columns', value: read('grid-template-columns') ?? '', says: grid });
  }

  const type = pixels(read('font-size'));
  if (type !== undefined && type >= LARGE_TYPE_PX) {
    risks.push({
      property: 'font-size',
      value: read('font-size') ?? '',
      says: `font-size ${String(read('font-size'))}`
    });
  }

  return risks;
};

/** The classes each part of an element wears: every name of its `styleSelectors`. */
const wornBy = (element: Element): string[][] =>
  Object.values(element.definition.styleSelectors).map(names => names.split(/\s+/).filter(Boolean));

type Finding = { className: string; says: string; elements: string[] };

/** A class's own rules at one width — none when the class says nothing there, which a width's map leaves out. */
const rulesAt = (rules: Style['platform']['desktop'], className: string): StyleObject | undefined =>
  Object.hasOwn(rules, className) && Object.hasOwn(rules[className].attributes, 'base')
    ? rules[className].attributes.base.default
    : undefined;

/** What breaks on a phone under one root, by the class that says it: once per class, with the elements wearing it. */
const findingsUnder = (flat: Schema['flat'], root: string, style: Style): Finding[] => {
  const desktop = style.platform.desktop;
  const mobile = style.platform.mobile;
  const byClass = new Map<string, Finding>();
  // What a phone draws as written: an element a `mobile` rule hides (`display: none`) or scales down whole (`transform:
  // scale(0.42)`) is left out with all it holds — a desktop's side panel hidden on a phone, or a scene fitted to it,
  // may be as wide or its type as large as it likes.
  const fittedOnPhone = (element: Element): boolean =>
    wornBy(element).some(classes =>
      classes.some(name => {
        const rules = rulesAt(mobile, name);
        const scale = /scale\(\s*(\d*\.?\d+)/.exec(String(rules?.transform ?? ''));

        return rules?.display === 'none' || (scale !== null && Number(scale[1]) < 1);
      })
    );
  const drawn: Element[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const id = stack.pop();
    const element = id === undefined ? undefined : (flat[id] as Element | undefined);
    if (!element || fittedOnPhone(element)) {
      continue;
    }

    drawn.push(element);
    stack.push(...[...(element.definition.items ?? [])].reverse());
  }

  for (const element of drawn) {
    for (const classes of wornBy(element)) {
      // Set again for a phone by any class the same part wears: a modifier's `mobile` rule fixes the base's.
      const fixed = new Set(classes.flatMap(name => Object.keys(rulesAt(mobile, name) ?? {})));
      for (const className of classes) {
        const rules = rulesAt(desktop, className);
        if (!rules) {
          continue;
        }

        const open = risksOf(rules).filter(risk => !fixed.has(risk.property));
        if (open.length === 0) {
          continue;
        }

        const finding = byClass.get(className) ?? {
          className,
          says: open.map(risk => risk.says).join(', '),
          elements: []
        };
        finding.elements.push(element.id);
        byClass.set(className, finding);
      }
    }
  }

  return [...byClass.values()];
};

/** Most findings named in one suggestion: the rest are the same advice. */
const NAMED = 4;

/**
 * The pages, layouts and components styled for the desktop alone in what breaks on a phone — one suggestion each, naming
 * the classes and what of each to set again for a phone.
 */
export const suggestResponsive = (schema: Schema, style: Style): Suggestion[] => {
  if (style.mode === 'mobile-first') {
    return [];
  }

  const roots: { kind: string; id: string; flat: Schema['flat']; root: string }[] = [
    ...schema.pages.map(id => ({ kind: 'Page', id, flat: schema.flat, root: id })),
    ...[...new Set(schema.pages.flatMap(page => pageLayouts(schema.flat, page)))].map(id => ({
      kind: 'Layout',
      id,
      flat: schema.flat,
      root: id
    })),
    ...Object.values(schema.components).map(component => ({
      kind: 'Component',
      id: component.id,
      flat: component.flat,
      root: component.rootId
    }))
  ];

  return roots.flatMap(({ kind, id, flat, root }) => {
    const findings = findingsUnder(flat, root, style);
    if (findings.length === 0) {
      return [];
    }

    const named = findings
      .slice(0, NAMED)
      .map(
        finding =>
          `class "${finding.className}" ${finding.says} (${finding.elements.length === 1 ? `"${finding.elements[0]}"` : `${String(finding.elements.length)} elements`})`
      );
    const more = findings.length > NAMED ? `, and ${String(findings.length - NAMED)} more` : '';

    return [
      {
        code: 'desktop-only' as const,
        message:
          `${kind} "${id}" is styled for the desktop alone where a phone (${String(PHONE_PX)} px) breaks: ${named.join('; ')}${more}. ` +
          'No `mobile` rule sets them again, so a phone draws the desktop’s — a `tablet` rule does not reach it.',
        elementIds: [root, ...findings.slice(0, NAMED).map(finding => finding.elements[0])],
        saves: 0,
        subjects: findings.map(finding => finding.className)
      }
    ];
  });
};
