/**
 * What a page is dressed in besides its words and pictures — the gradients behind a section, the glows around a card, the
 * ornaments drawn by `::before`/`::after`, the images a background carries — read on two pages and compared by section.
 * A comparison of pixels says a soft glow as a few percent spread over a section, and one of texts never sees it:
 * A run's artist page lost the original's warm light, its portrait's corners and its card's halo, and three reviews
 * passed it. Each layer over a picture says whether it is painted over or under it: a fighter's spotlight is the
 * original's behind the cut-out, and over the face it is another look (t-predictions, approved so).
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
  /** The element it dresses, as a person finds it: `div.card#stats` — a lead's spike reads the original by it. */
  element: string;
  /** The layer as its CSS says it, whole (cut at 400 characters): what a copy writes to wear it. */
  css: string;
  /** Over half of a picture of the page's own (a photo, a video): whether it is painted over that picture or under it. */
  stack?: 'over' | 'under';
}

/**
 * Runs in the page: every gradient, glow (a shadow blurred 12px or more), filter, background image — in the CSS, or a
 * decorative picture laid behind or over a section (`alt=""` or hidden, absolutely placed: a run's footer photo
 * was nobody's dress, and went) — and ornament (a pseudo-element drawn with a border or a background) of what is drawn,
 * its element's box beside it, and whether it is over or under the picture it covers. Skips the dev tools' own chrome
 * and what a visitor cannot see. Self-contained — it is serialised.
 */
export const pageDecorations = (limit: number): PageDecoration[] => {
  const found: PageDecoration[] = [];
  // Every function of the filter a blur of nothing: no effect at all.
  const isInert = (filter: string): boolean =>
    filter
      .replace(/(rgba?|color|oklab|oklch)\([^)]*\)/gi, '')
      .split(/\)\s*/)
      .filter(part => part.trim() !== '')
      .every(part => /^\s*blur\(\s*0(px)?\s*$/.test(part));
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
  ): { kind: DecorationKind; detail: string; css: string }[] => {
    const layers: { kind: DecorationKind; detail: string; css: string }[] = [];
    const cut = (text: string): string => (text.length > 400 ? `${text.slice(0, 399)}…` : text);
    const image = style.backgroundImage;
    const gradients = [...image.matchAll(/(repeating-)?(linear|radial|conic)-gradient/g)];
    gradients.forEach((gradient, index) => {
      const colour = shownColour(
        image.slice(gradient.index, index + 1 < gradients.length ? gradients[index + 1].index : image.length)
      );
      if (colour !== undefined) {
        layers.push({
          kind: 'gradient',
          detail: `${gradient[0]} ${colour}`.trim(),
          css: cut(`background-image: ${image}`)
        });
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
      layers.push({
        kind: 'image',
        detail: `background ${name.slice(0, 60)}`,
        css: cut(
          `background-image: ${address.startsWith('data:') ? `url(<${name}>)` : `url(${address})`}; background-size: ${style.backgroundSize}; background-position: ${style.backgroundPosition}`
        )
      });
    }

    for (const [property, value] of [
      ['box-shadow', style.boxShadow],
      ['text-shadow', style.textShadow]
    ] as const) {
      const colour = value === 'none' ? undefined : shownColour(value);
      if (colour !== undefined && blurOf(value) >= 12) {
        layers.push({
          kind: 'glow',
          detail: `${property} ${String(blurOf(value))}px ${colour}`.trim(),
          css: cut(`${property}: ${value}`)
        });
      }
    }

    // A filter that does nothing is no dress: `blur(0px)` is an arrival's blurred fade at rest (a check
    // asked a page for it).
    if (style.filter !== 'none' && /blur|drop-shadow/.test(style.filter) && !isInert(style.filter)) {
      layers.push({
        kind: 'filter',
        detail: `filter ${style.filter.slice(0, 60)}`,
        css: cut(`filter: ${style.filter}`)
      });
    }

    // A pseudo-element with a border or a fill of its own is drawn: a corner bracket, a divider's rule, a badge's dot —
    // unless it has no size: a hover's underline at rest (width 0) is not dress (a run's socials read as four dots).
    const sized = !/^0(px)?$/.test(style.width) && !/^0(px)?$/.test(style.height);
    if (on !== 'element' && layers.length === 0 && sized) {
      const bordered = ['Top', 'Right', 'Bottom', 'Left'].some(
        side => Number.parseFloat(style.getPropertyValue(`border-${side.toLowerCase()}-width`)) > 0
      );
      const colour = shownColour(bordered ? style.borderTopColor : style.backgroundColor);
      if ((bordered || colour) && colour !== undefined) {
        layers.push({
          kind: 'ornament',
          detail: `${on === 'before' ? '::before' : '::after'} ${bordered ? 'border' : 'fill'} ${colour}`.trim(),
          css: cut(
            `content: ${style.content}; position: ${style.position}; inset: ${style.top} ${style.right} ${style.bottom} ${style.left}; width: ${style.width}; height: ${style.height}; border: ${style.borderTopWidth} ${style.borderTopStyle} ${style.borderTopColor}; border-width: ${style.borderWidth}; background: ${style.backgroundColor}`
          )
        });
      }
    }

    return layers;
  };

  // A picture laid as a backdrop — said nothing of (`alt=""`, hidden) and placed out of the flow, itself or its
  // <picture> — is dress; one with words, or in the flow, is a picture of the page's own.
  const placed = (element: Element): boolean => ['absolute', 'fixed'].includes(getComputedStyle(element).position);
  // …or in the flow with the words laid over it, placed: the same backdrop drawn the other way (our banners'
  // pictures, under their title and button, were "lacks background image" beside the original's placed one).
  const overlaid = (element: Element): boolean => {
    const holder = element.parentElement?.tagName === 'PICTURE' ? element.parentElement : element;

    return Array.from(holder.parentElement?.children ?? []).some(other => other !== holder && placed(other));
  };
  const isBackdrop = (element: Element): boolean =>
    element.tagName === 'IMG' &&
    (element.getAttribute('alt') === '' || element.closest('[aria-hidden="true"], [role="presentation"]') !== null) &&
    (placed(element) ||
      (element.parentElement?.tagName === 'PICTURE' && placed(element.parentElement)) ||
      overlaid(element));
  // What a layer is painted over or under: any photo or video drawn — a backdrop's too, as a copy may mark a fighter's
  // cut-out decorative where the original names it.
  const pictures = Array.from(document.body.querySelectorAll('img, video'))
    .map(element => ({ element, box: element.getBoundingClientRect() }))
    .filter(({ element, box }) => box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== 'hidden');
  // Where an element stands in its parent's painting, as CSS orders it: its z-index when it sets one — placed, or an item
  // of a flex or grid — 0 when placed without one, below those when in the flow.
  const levelOf = (element: Element, style: CSSStyleDeclaration = getComputedStyle(element)): number => {
    const parent = element.parentElement ? getComputedStyle(element.parentElement).display : '';
    const item = /flex|grid/.test(parent);
    const z = Number.parseInt(style.zIndex, 10);
    if (!Number.isNaN(z) && (style.position !== 'static' || item)) {
      return z;
    }

    return style.position !== 'static' ? 0 : -0.5;
  };
  // The level an element paints at within `top`'s children: the outermost level set on its way up to that child.
  const levelUnder = (element: Element, top: Element): number => {
    let level = levelOf(element);
    for (let at = element.parentElement; at && at !== top; at = at.parentElement) {
      const style = getComputedStyle(at);
      const forms =
        (style.position !== 'static' && style.zIndex !== 'auto') ||
        Number(style.opacity) < 1 ||
        style.transform !== 'none' ||
        style.filter !== 'none' ||
        style.isolation === 'isolate' ||
        style.mixBlendMode !== 'normal';
      // Inside a stacking context its own level counts no more: the context's does.
      level = forms ? levelOf(at, style) : Math.max(level, levelOf(at, style));
    }

    return level;
  };
  // Whether the layer `on` an element is painted over `picture`: by the levels where their ways part, then the order.
  const over = (element: Element, on: PageDecoration['on'], picture: Element): boolean => {
    if (element.contains(picture)) {
      // Its own background and shadow are under what it holds; a pseudo-element by its level, ::after after the rest.
      if (on === 'element') {
        return false;
      }

      const level = levelOf(element, getComputedStyle(element, `::${on}`));
      const theirs = levelUnder(picture, element);

      return level === theirs ? on === 'after' : level > theirs;
    }

    let common: Element | null = element.parentElement;
    while (common && !common.contains(picture)) {
      common = common.parentElement;
    }

    if (!common) {
      return false;
    }

    const childOf = (node: Element): Element => {
      let at = node;
      while (at.parentElement && at.parentElement !== common) {
        at = at.parentElement;
      }

      return at;
    };
    const mine =
      on === 'element'
        ? levelUnder(element, common)
        : Math.max(levelUnder(element, common), levelOf(element, getComputedStyle(element, `::${on}`)));
    const theirs = levelUnder(picture, common);
    if (mine !== theirs) {
      return mine > theirs;
    }

    // At one level, what comes later in the page is painted later.
    return Boolean(childOf(picture).compareDocumentPosition(childOf(element)) & Node.DOCUMENT_POSITION_FOLLOWING);
  };
  // The picture a layer covers most — over half of it — and whether the layer is painted over it.
  const stackOf = (element: Element, on: PageDecoration['on'], box: DOMRect): 'over' | 'under' | undefined => {
    const covered = pictures
      // Its own background is always under what it holds: said of nothing — only a pseudo-element's order tells.
      .filter(picture => picture.element !== element && (on !== 'element' || !element.contains(picture.element)))
      .map(picture => {
        const width = Math.min(box.right, picture.box.right) - Math.max(box.left, picture.box.left);
        const height = Math.min(box.bottom, picture.box.bottom) - Math.max(box.top, picture.box.top);

        return {
          picture,
          share: width > 0 && height > 0 ? (width * height) / (picture.box.width * picture.box.height) : 0
        };
      })
      .filter(each => each.share > 0.5)
      .sort((a, b) => b.share - a.share)
      .at(0);

    return covered ? (over(element, on, covered.picture.element) ? 'over' : 'under') : undefined;
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

    const own = element.getAttribute('data-plitzi-el');
    const firstClass = element.classList.item(0);
    const place = {
      x: Math.round(box.left + window.scrollX),
      y: Math.round(box.top + window.scrollY),
      width: Math.round(box.width),
      height: Math.round(box.height),
      element: `${element.tagName.toLowerCase()}${firstClass ? `.${firstClass}` : ''}${element.id ? `#${element.id}` : own ? `#${own}` : ''}`
    };
    const backdrop = isBackdrop(element)
      ? [
          {
            kind: 'image' as const,
            detail: `backdrop ${(element.getAttribute('src') ?? '').split('/').at(-1)?.split('?')[0]?.slice(0, 60) ?? ''}`,
            css: `<img src="${element.getAttribute('src') ?? ''}">; object-fit: ${style.objectFit}; object-position: ${style.objectPosition}; opacity: ${style.opacity}`
          }
        ]
      : [];
    const itself = [...backdrop, ...layersOf(style, 'element')].map(layer => ({ ...layer, on: 'element' as const }));
    const pseudo = (['before', 'after'] as const).flatMap(on => {
      const drawn = getComputedStyle(element, `::${on}`);
      if (drawn.content === 'none' || drawn.content === 'normal' || drawn.display === 'none') {
        return [];
      }

      return layersOf(drawn, on).map(layer => ({ ...layer, on }));
    });
    found.push(
      ...[...itself, ...pseudo].map(layer => {
        // A light, a veil, a frame: what is drawn over a photo or behind it — a shadow or a filter is the element's own.
        const stack =
          layer.kind === 'gradient' || layer.kind === 'ornament' ? stackOf(element, layer.on, box) : undefined;

        return { ...layer, ...place, ...(stack ? { stack } : {}) };
      })
    );
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
  /** The other page's layers of each absent look, whole — their element and their CSS: what a spike reads. */
  absentLayers: PageDecoration[];
  /**
   * Of each absent look, the element of this page where the other page wears it — by its name, found at the same place
   * of the section: the one to dress ("lacks radial-gradient" said what, never on which element).
   */
  absentOn?: Record<string, string>;
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

const timesOf = (layers: readonly PageDecoration[], kind: DecorationKind): Map<string, number> => {
  const times = new Map<string, number>();
  for (const layer of layers.filter(each => each.kind === kind)) {
    times.set(layer.detail, (times.get(layer.detail) ?? 0) + 1);
  }

  return times;
};

/**
 * The details of `kind` that `fewer` has fewer of than `more`, each with how many fewer: `box-shadow 60px rgb(…) ×4`.
 * Each detail on its own — a kind counted whole listed every detail of it, kept ones too: one VS medal's shadow gone,
 * and the cards' text-shadows ×20, all there, read as lost (a run's design-2).
 */
const fewerOf = (fewer: readonly PageDecoration[], more: readonly PageDecoration[], kind: DecorationKind): string[] => {
  const had = timesOf(fewer, kind);

  return [...timesOf(more, kind)].flatMap(([detail, count]) => {
    const gone = count - (had.get(detail) ?? 0);

    return gone <= 0 ? [] : [gone > 1 ? `${detail} ×${String(gone)}` : detail];
  });
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
  const stacked = layer.stack ? ` ${layer.stack} a picture` : '';

  return `${sort}${wide ? ' across the section' : ''}${stacked}`;
};

/** How many of the other page's absent layers a section keeps whole: enough for a spike, few enough to read. */
const ABSENT_LAYERS = 12;

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
    // A filter that does nothing, as a page read before it was left out says it: no dress.
    for (const layer of page.layers.filter(each => !/^filter blur\(0(px)?\)$/.test(each.detail))) {
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
    const missing = KINDS.flatMap(kind => fewerOf(a, b, kind).slice(0, DETAILS));
    const extra = KINDS.flatMap(kind => fewerOf(b, a, kind).slice(0, DETAILS));

    const ourLooks = looksOf(a, here.regions, section);
    const theirLooks = looksOf(b, there.regions, section);
    const absentLooks = [...theirLooks.keys()].filter(look => !ourLooks.has(look));
    const absent = absentLooks.map(look => `${look} (${theirLooks.get(look) ?? ''})`);
    const box = there.regions.find(region => region.name === section);
    const absentLayers = b.filter(layer => absentLooks.includes(lookOf(layer, box))).slice(0, ABSENT_LAYERS);

    return missing.length > 0 || extra.length > 0 || absent.length > 0
      ? [{ section, here: countA, there: countB, missing, extra, absent, absentLayers }]
      : [];
  });
};
