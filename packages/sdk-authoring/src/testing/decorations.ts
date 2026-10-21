/**
 * What a page is dressed in besides its words and pictures — the gradients behind a section, the glows around a card, the
 * ornaments drawn by `::before`/`::after`, the images a background carries — read on two pages and compared by section.
 * A comparison of pixels says a soft glow as a few percent spread over a section, and one of texts never sees it:
 * la-velada's artist page lost the original's warm light, its portrait's corners and its card's halo, and three reviews
 * passed it.
 */

import type { PictureRegion } from './pictures';

export type DecorationKind = 'gradient' | 'glow' | 'ornament' | 'image' | 'filter';

/** One layer of dress on the page. */
export interface PageDecoration {
  kind: DecorationKind;
  /** Where it is drawn: its element's box, on the whole page. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** The layer in a few words: `radial-gradient rgba(199, 168, 107, 0.18)`, `box-shadow 60px rgb(199, 168, 107)`. */
  detail: string;
  /** On the element itself, or one of its pseudo-elements. */
  on: 'element' | 'before' | 'after';
}

/**
 * Runs in the page: every gradient, glow (a shadow blurred 12px or more), filter, background image and ornament (a
 * pseudo-element drawn with a border or a background) of what is drawn, its element's box beside it. Skips the dev
 * tools' own chrome and what a visitor cannot see. Self-contained — it is serialised.
 */
export const pageDecorations = (limit: number): PageDecoration[] => {
  const found: PageDecoration[] = [];
  const COLOUR = /(rgba?\([^)]*\)|color\([^)]*\)|oklab\([^)]*\)|oklch\([^)]*\)|#[0-9a-f]{3,8}\b)/gi;
  const alphaOf = (colour: string): number => {
    const alpha = /\/\s*([\d.]+)(%?)\s*\)$/.exec(colour) ?? /^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)(%?)\)$/.exec(colour);

    return alpha ? Number.parseFloat(alpha[1]) / (alpha[2] === '%' ? 100 : 1) : 1;
  };
  const rgbText = (channels: number[], alpha: string | undefined): string => {
    const bytes = channels.map(each => String(Math.round(Math.min(1, Math.max(0, each)) * 255)));

    return alpha === undefined || Number.parseFloat(alpha) === 1
      ? `rgb(${bytes.join(', ')})`
      : `rgba(${bytes.join(', ')}, ${String(Math.round(Number.parseFloat(alpha) * 100) / 100)})`;
  };
  // As a person reads one, and as the other page may write it: `color(srgb 0.78 0.66 0.42 / 0.18)` and
  // `oklab(0.75 0.01 0.09 / 0.45)` are `rgba(199, 168, 107, 0.18)` and `rgba(…, 0.45)`.
  const readable = (colour: string): string => {
    const parts = /^(color\(srgb|oklab\()\s*(-?[\d.e-]+)\s+(-?[\d.e-]+)\s+(-?[\d.e-]+)(?:\s*\/\s*([\d.]+))?\)$/.exec(
      colour
    );
    if (!parts) {
      return colour;
    }

    const a = Number.parseFloat(parts[2]);
    const b = Number.parseFloat(parts[3]);
    const c = Number.parseFloat(parts[4]);
    // The alpha is optional: the group is absent without it, whatever its type says.
    const alpha: string | undefined = parts.at(5);
    if (parts[1] === 'color(srgb') {
      return rgbText([a, b, c], alpha);
    }

    // OKLab to linear sRGB (Björn Ottosson's matrices), then the sRGB curve.
    const l = (a + 0.3963377774 * b + 0.2158037573 * c) ** 3;
    const m = (a - 0.1055613458 * b - 0.0638541728 * c) ** 3;
    const s = (a - 0.0894841775 * b - 1.291485548 * c) ** 3;
    const linear = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
    ];

    return rgbText(
      linear.map(each => (each <= 0.0031308 ? 12.92 * each : 1.055 * each ** (1 / 2.4) - 0.055)),
      alpha
    );
  };
  // The first colour in a value one sees: a layer that is all transparent is no dress — a hover's glow at rest.
  const shownColour = (value: string): string | undefined => {
    const colours = value.match(COLOUR) ?? [];
    const shown = colours.find(colour => alphaOf(colour) > 0);

    return colours.length === 0 ? '' : shown === undefined ? undefined : readable(shown);
  };
  const blurOf = (shadow: string): number => {
    // A shadow's lengths after its colour is taken out: x, y, then the blur.
    const lengths = shadow
      .replace(/(rgba?|color|oklab|oklch)\([^)]*\)/gi, '')
      .split(',')
      .map(part =>
        part
          .trim()
          .split(/\s+/)
          .filter(word => /^-?[\d.]+(px)?$/.test(word))
      );

    return Math.max(0, ...lengths.map(each => Number.parseFloat(each[2] ?? '0')));
  };
  const layersOf = (
    style: CSSStyleDeclaration,
    on: PageDecoration['on']
  ): { kind: DecorationKind; detail: string }[] => {
    const layers: { kind: DecorationKind; detail: string }[] = [];
    const image = style.backgroundImage;
    const gradients = [...image.matchAll(/(repeating-)?(linear|radial|conic)-gradient/g)];
    gradients.forEach((gradient, index) => {
      const colour = shownColour(
        image.slice(gradient.index, index + 1 < gradients.length ? gradients[index + 1].index : image.length)
      );
      if (colour !== undefined) {
        layers.push({ kind: 'gradient', detail: `${gradient[0]} ${colour}`.trim() });
      }
    });

    // A computed `url()` is written in double quotes; an SVG written in the style carries single ones, and parentheses.
    for (const url of image.matchAll(/url\("((?:[^"\\]|\\.)*)"\)|url\(([^)"']*)\)/g)) {
      // One of the two groups matched: the other is absent, whatever its type says.
      const address = url.at(1) ?? url.at(2) ?? '';
      // An image written in the style itself is named by its type — an SVG's grain, a pattern — not by its markup.
      const name = address.startsWith('data:')
        ? `${/^data:([^;,]+)/.exec(address)?.[1] ?? 'data'} in the style`
        : (address.split('/').at(-1)?.split('?')[0] ?? '');
      layers.push({ kind: 'image', detail: `background ${name.slice(0, 60)}` });
    }

    for (const [property, value] of [
      ['box-shadow', style.boxShadow],
      ['text-shadow', style.textShadow]
    ] as const) {
      const colour = value === 'none' ? undefined : shownColour(value);
      if (colour !== undefined && blurOf(value) >= 12) {
        layers.push({ kind: 'glow', detail: `${property} ${String(blurOf(value))}px ${colour}`.trim() });
      }
    }

    if (style.filter !== 'none' && /blur|drop-shadow/.test(style.filter)) {
      layers.push({ kind: 'filter', detail: `filter ${style.filter.slice(0, 60)}` });
    }

    // A pseudo-element with a border or a fill of its own is drawn: a corner bracket, a divider's rule, a badge's dot.
    if (on !== 'element' && layers.length === 0) {
      const bordered = ['Top', 'Right', 'Bottom', 'Left'].some(
        side => Number.parseFloat(style.getPropertyValue(`border-${side.toLowerCase()}-width`)) > 0
      );
      const colour = shownColour(bordered ? style.borderTopColor : style.backgroundColor);
      if ((bordered || colour) && colour !== undefined) {
        layers.push({
          kind: 'ornament',
          detail: `${on === 'before' ? '::before' : '::after'} ${bordered ? 'border' : 'fill'} ${colour}`.trim()
        });
      }
    }

    return layers;
  };

  for (const element of Array.from(document.body.querySelectorAll('*'))) {
    if (found.length >= limit) {
      break;
    }

    if (element.closest('script, style, noscript, template, [data-plitzi-devtools]')) {
      continue;
    }

    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    if (box.width === 0 || box.height === 0 || style.visibility === 'hidden' || Number(style.opacity) === 0) {
      continue;
    }

    const place = {
      x: Math.round(box.left + window.scrollX),
      y: Math.round(box.top + window.scrollY),
      width: Math.round(box.width),
      height: Math.round(box.height)
    };
    const own = layersOf(style, 'element').map(layer => ({ ...layer, on: 'element' as const }));
    const pseudo = (['before', 'after'] as const).flatMap(on => {
      const drawn = getComputedStyle(element, `::${on}`);
      if (drawn.content === 'none' || drawn.content === 'normal' || drawn.display === 'none') {
        return [];
      }

      return layersOf(drawn, on).map(layer => ({ ...layer, on }));
    });
    found.push(...[...own, ...pseudo].map(layer => ({ ...layer, ...place })));
  }

  return found.slice(0, limit);
};

/** How many layers a page is read for: enough for a long, dressed page, few enough to stay quick. */
export const PAGE_DECORATION_LIMIT = 3000;

/** A section's dress on each page, kind by kind, and a few of what the other has. */
export interface SectionDecorations {
  /** The section, by the name the picture comparison gives it (`section#artist-page`). */
  section: string;
  here: Partial<Record<DecorationKind, number>>;
  there: Partial<Record<DecorationKind, number>>;
  /** Layers there of a kind this page has fewer of, in a few words each — what to add. */
  missing: string[];
  /** Layers here of a kind the other page has fewer of — what this page adds. */
  extra: string[];
  /**
   * Each look the other page dresses the section in and this one has none of: a layer's sort (`radial-gradient`,
   * `text-shadow`, `::before`) and whether it spans the section — a warm light across a page is not the gradient of
   * one card in it. With one of each, in a few words. What a look's absence is, by sort: counts differ between two
   * ways of drawing it, a sort and a span missing do not.
   */
  absent: string[];
}

const KINDS: readonly DecorationKind[] = ['gradient', 'glow', 'ornament', 'image', 'filter'];

/** The smallest section whose box holds the middle of `layer`: where a layer is dressing. */
const sectionOf = (layer: PageDecoration, regions: readonly PictureRegion[]): string | undefined => {
  const x = layer.x + layer.width / 2;
  const y = layer.y + layer.height / 2;

  return regions
    .filter(region => x >= region.x && x <= region.x + region.width && y >= region.y && y <= region.y + region.height)
    .sort((a, b) => a.width * a.height - b.width * b.height)
    .at(0)?.name;
};

const countsOf = (layers: readonly PageDecoration[]): Partial<Record<DecorationKind, number>> => {
  const counts: Partial<Record<DecorationKind, number>> = {};
  for (const layer of layers) {
    counts[layer.kind] = (counts[layer.kind] ?? 0) + 1;
  }

  return counts;
};

/** The distinct details of `layers` of `kind`, each with how many times it is there: `box-shadow 60px rgb(…) ×4`. */
const detailsOf = (layers: readonly PageDecoration[], kind: DecorationKind): string[] => {
  const times = new Map<string, number>();
  for (const layer of layers.filter(each => each.kind === kind)) {
    times.set(layer.detail, (times.get(layer.detail) ?? 0) + 1);
  }

  return [...times].map(([detail, count]) => (count > 1 ? `${detail} ×${String(count)}` : detail));
};

/** A layer's look: its sort, and `wide` when it spans most of its section — what one look is matched by. */
const lookOf = (layer: PageDecoration, section: PictureRegion | undefined): string => {
  const sort =
    layer.kind === 'gradient' || layer.kind === 'glow' || layer.kind === 'ornament'
      ? (layer.detail.split(' ')[0] ?? layer.kind)
      : layer.kind === 'filter'
        ? `filter ${/blur|drop-shadow/.exec(layer.detail)?.[0] ?? ''}`.trim()
        : 'background image';
  const wide = section !== undefined && layer.width >= section.width * WIDE;

  return wide ? `${sort} across the section` : sort;
};

/** How much of its section's width a layer spans to be one across it. */
const WIDE = 0.6;

/** How many details a section's difference names: the rest is its counts. */
const DETAILS = 3;

/**
 * The two pages' dress, section by section — each page's layers placed in its own sections, which share their names:
 * every section where a kind of layer is there more than here, or here more than there, with what it is.
 */
export const compareDecorations = (
  here: { layers: readonly PageDecoration[]; regions: readonly PictureRegion[] },
  there: { layers: readonly PageDecoration[]; regions: readonly PictureRegion[] }
): SectionDecorations[] => {
  const bySection = (page: typeof here) => {
    const sections = new Map<string, PageDecoration[]>();
    for (const layer of page.layers) {
      const section = sectionOf(layer, page.regions) ?? 'page';
      sections.set(section, [...(sections.get(section) ?? []), layer]);
    }

    return sections;
  };
  const looksOf = (layers: readonly PageDecoration[], regions: readonly PictureRegion[], section: string) => {
    const box = regions.find(region => region.name === section);
    const looks = new Map<string, string>();
    for (const layer of layers) {
      const look = lookOf(layer, box);
      if (!looks.has(look)) {
        looks.set(look, layer.detail);
      }
    }

    return looks;
  };
  const ours = bySection(here);
  const theirs = bySection(there);
  const names = [...new Set([...ours.keys(), ...theirs.keys()])];

  return names.flatMap(section => {
    const a = ours.get(section) ?? [];
    const b = theirs.get(section) ?? [];
    const countA = countsOf(a);
    const countB = countsOf(b);
    const missing = KINDS.filter(kind => (countB[kind] ?? 0) > (countA[kind] ?? 0)).flatMap(kind =>
      detailsOf(b, kind).slice(0, DETAILS)
    );
    const extra = KINDS.filter(kind => (countA[kind] ?? 0) > (countB[kind] ?? 0)).flatMap(kind =>
      detailsOf(a, kind).slice(0, DETAILS)
    );

    const ourLooks = looksOf(a, here.regions, section);
    const absent = [...looksOf(b, there.regions, section)]
      .filter(([look]) => !ourLooks.has(look))
      .map(([look, detail]) => `${look} (${detail})`);

    return missing.length > 0 || extra.length > 0 || absent.length > 0
      ? [{ section, here: countA, there: countB, missing, extra, absent }]
      : [];
  });
};
