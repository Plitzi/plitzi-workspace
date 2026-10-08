/**
 * What the browser half of `inspectPage` is asked, and what it answers.
 *
 * Plain data both ways, because it crosses into the page as a serialized argument and comes back the same way.
 */
export interface ProbeInput {
  /** `list`: a list, whose box is only its rows — none drawn is a list with nothing in it, not one hidden. */
  expected: { id: string; selector: string; list?: true }[];
  images: boolean;
  overflow: boolean;
  legibility: boolean;
}

export interface ProbeFindings {
  /** Whether anything on the page carries `data-plitzi-el` at all — no means nothing checked below can be found. */
  marked: boolean;
  missing: string[];
  hidden: { id: string; reason: string }[];
  /** Owed, and hidden at this width by a breakpoint on purpose — checked at the width it shows at, not a problem. */
  byWidth: string[];
  /** Each with the element it is in, by id, when one of the space's holds it. */
  brokenImages: { source: string; elementId?: string }[];
  /** `elementIds`: the widest ones the space named, for a tool to point at. */
  overflow: { pixels: number; widest: string[]; elementIds: string[] } | null;
  /** A link, a control or words of the space's cut at the screen's edge — by how many pixels fall outside it. */
  cutOff: { id: string; pixels: number }[];
  /** Words that cannot be told from what is behind them, with their contrast against it (WCAG's ratio, 1 to 21). */
  illegible: { text: string; contrast: number; elementId?: string }[];
}

/**
 * Runs INSIDE the page, so it is self-contained on purpose: no import, no helper from this module, nothing it closes
 * over. A driver serializes the function's source and evaluates it there — a reference to anything outside it would be
 * `undefined` in the browser, however well it typechecked here.
 */
export function probePage(input: ProbeInput): ProbeFindings {
  const nameOf = (node: Element): string => {
    const id = node.getAttribute('data-plitzi-el');
    if (id) {
      return `"${id}"`;
    }

    const firstClass = typeof node.className === 'string' ? node.className.split(' ')[0] : '';

    return `<${node.tagName.toLowerCase()}${firstClass ? `.${firstClass}` : ''}>`;
  };

  /** The space's element a node belongs to: itself when it is one, or the nearest that holds it. */
  const elementIdOf = (node: Element): string | undefined =>
    node.closest('[data-plitzi-el]')?.getAttribute('data-plitzi-el') ?? undefined;

  /** The node that takes an element's box away — which is rarely the element itself — and what it does. */
  const hiderOf = (node: Element): { at: Element; how: string } | undefined => {
    for (let at: Element | null = node; at; at = at.parentElement) {
      const style = getComputedStyle(at);
      if (style.display === 'none') {
        return { at, how: 'display:none' };
      }

      if (style.visibility === 'hidden' || style.visibility === 'collapse') {
        return { at, how: `visibility:${style.visibility}` };
      }
    }

    return undefined;
  };

  /** The style rules of the page's own sheets that sit under a condition on the viewport (`@media`, `@container`). */
  const conditionalRules = (): CSSStyleRule[] => {
    const found: CSSStyleRule[] = [];
    const walk = (rules: CSSRuleList, conditional: boolean): void => {
      for (const rule of rules) {
        if (rule instanceof CSSStyleRule) {
          if (conditional) {
            found.push(rule);
          }

          walk(rule.cssRules, conditional);
        } else if (
          rule instanceof CSSMediaRule ||
          (typeof CSSContainerRule !== 'undefined' && rule instanceof CSSContainerRule)
        ) {
          walk(rule.cssRules, true);
        } else if (rule instanceof CSSGroupingRule) {
          walk(rule.cssRules, conditional);
        }
      }
    };
    for (const sheet of document.styleSheets) {
      try {
        walk(sheet.cssRules, false);
      } catch {
        // A stylesheet from another origin keeps its rules to itself.
      }
    }

    return found;
  };

  let widthRules: CSSStyleRule[] | undefined;
  /**
   * Whether a node is shown or hidden by the width it is drawn at: a rule under a breakpoint sets its `display` or its
   * `visibility` — whether that rule applies now or not. The desktop navigation a phone hides, the bottom bar only a
   * phone shows: hidden at this width on purpose, and checked at the width it shows at.
   */
  const laidOutByWidth = (node: Element): boolean => {
    widthRules ??= conditionalRules();

    return widthRules.some(rule => {
      if (!rule.style.display && !rule.style.visibility) {
        return false;
      }

      try {
        return node.matches(rule.selectorText);
      } catch {
        // A nested rule's relative selector (`&:hover`), or one this engine cannot read: not one that names the node.
        return false;
      }
    });
  };

  /** Why an element has no box, named by the node that takes it away — which is rarely the element itself. */
  const whyHidden = (node: Element, list: boolean): string => {
    const hider = hiderOf(node);
    if (hider) {
      return `${hider.how} on ${hider.at === node ? 'itself' : nameOf(hider.at)}`;
    }

    if (list && node.childElementCount === 0) {
      return 'it is a list with no rows — its items are empty, or have not arrived. Show an empty state in its place, or make it `visible` only while it has rows';
    }

    if (getComputedStyle(node).display === 'contents') {
      return 'it has no box of its own (display:contents) and nothing inside it shows';
    }

    const box = node.getBoundingClientRect();

    return `it has no size (${Math.round(box.width)}×${Math.round(box.height)})`;
  };

  const isVisible = (node: Element): boolean => {
    // No box of its own — a layout's slot that leaves the page's sections to the layout around it: it shows what its
    // children show. Its own rectangle is always 0×0, which is not it being hidden.
    if (getComputedStyle(node).display === 'contents') {
      return [...node.children].some(isVisible);
    }

    const box = node.getBoundingClientRect();

    return box.width > 0 && box.height > 0 && getComputedStyle(node).visibility === 'visible';
  };

  const missing: string[] = [];
  const hidden: { id: string; reason: string }[] = [];
  const byWidth: string[] = [];
  for (const { id, selector, list } of input.expected) {
    const nodes = [...document.querySelectorAll(selector)];
    if (nodes.length === 0) {
      missing.push(id);
    } else if (!nodes.some(isVisible)) {
      const hider = hiderOf(nodes[0]);
      if (hider && laidOutByWidth(hider.at)) {
        byWidth.push(id);
      } else {
        hidden.push({ id, reason: whyHidden(nodes[0], list === true) });
      }
    }
  }

  /**
   * The part of a node that can be seen: its box cut by every ancestor that clips what spills (a carousel's track, a
   * scrolling row, the pane a page scrolls in) and then by the viewport. Empty when nothing of it is in sight.
   */
  const seenBox = (node: Element): { left: number; top: number; right: number; bottom: number } => {
    let { left, top, right, bottom } = node.getBoundingClientRect();
    for (let at = node.parentElement; at; at = at.parentElement) {
      const style = getComputedStyle(at);
      if (style.display === 'contents') {
        continue;
      }

      const box = at.getBoundingClientRect();
      if (style.overflowX !== 'visible') {
        left = Math.max(left, box.left);
        right = Math.min(right, box.right);
      }

      if (style.overflowY !== 'visible') {
        top = Math.max(top, box.top);
        bottom = Math.min(bottom, box.bottom);
      }
    }

    return {
      left: Math.max(left, 0),
      top: Math.max(top, 0),
      right: Math.min(right, window.innerWidth),
      bottom: Math.min(bottom, window.innerHeight)
    };
  };

  /** Whether any of a node is where it can be seen — the test the browser runs before it fetches a lazy image. */
  const inSight = (node: Element): boolean => {
    const { left, top, right, bottom } = seenBox(node);

    return right > left && bottom > top;
  };

  /**
   * An image element that failed draws a fallback that loads fine, so the browser alone would call it loaded: it says
   * which source failed in `data-plitzi-failed`. Any other `img` is asked the browser's way — except a lazy one out of
   * sight (below the fold, or beside it in a carousel's track), which has not been asked for yet: it working, not
   * failing. An image nobody can see — hidden itself or under something hidden (`visible: false`) — is not asked at
   * all: a browser may never fetch it, and it is not on the page as far as a visitor can tell.
   */
  const brokenImages = input.images
    ? [...document.querySelectorAll('img')].flatMap(image => {
        if (hiderOf(image)) {
          return [];
        }

        const failed = image.getAttribute('data-plitzi-failed');
        const elementId = elementIdOf(image);
        const at = elementId === undefined ? {} : { elementId };
        if (failed !== null) {
          return [{ source: `${failed} (${nameOf(image)})`, ...at }];
        }

        const pending = image.loading === 'lazy' && !inSight(image);

        return !pending && (!image.complete || image.naturalWidth === 0)
          ? [{ source: image.currentSrc || image.src || nameOf(image), ...at }]
          : [];
      })
    : [];

  /**
   * As far as it can be SEEN: an ancestor that clips its overflow cuts an element there, so a photograph scaled inside
   * a hero that hides what spills scrolls nothing. The document's own scroll width is not asked, because the SDK can
   * scroll an inner pane and the document would then report no overflow whatever the page contained.
   */
  let overflow: ProbeFindings['overflow'] = null;
  const cutOff: ProbeFindings['cutOff'] = [];
  if (input.overflow) {
    const viewport = document.documentElement.clientWidth;
    /**
     * Whether an ancestor keeps what spills inside it. One that hides or clips it does; so does one that scrolls it —
     * a carousel's row, a table's wrapper — which is somewhere a person scrolls on purpose, not the page doing it. Not
     * the page's own scroller: the document, or the pane the SDK scrolls a page in (`.plitzi-sdk`), whose sideways
     * scroll IS the page scrolling sideways.
     */
    const keepsOverflow = (ancestor: Element): boolean => {
      const { overflowX } = getComputedStyle(ancestor);
      if (overflowX === 'hidden' || overflowX === 'clip') {
        return true;
      }

      const pageScroller =
        ancestor === document.documentElement || ancestor === document.body || ancestor.matches('.plitzi-sdk');

      return (overflowX === 'auto' || overflowX === 'scroll') && !pageScroller;
    };
    const visibleRight = (node: Element): number => {
      let right = node.getBoundingClientRect().right;
      for (let ancestor = node.parentElement; ancestor; ancestor = ancestor.parentElement) {
        if (keepsOverflow(ancestor)) {
          right = Math.min(right, ancestor.getBoundingClientRect().right);
        }
      }

      return right;
    };
    const visibleLeft = (node: Element): number => {
      let left = node.getBoundingClientRect().left;
      for (let ancestor = node.parentElement; ancestor; ancestor = ancestor.parentElement) {
        if (keepsOverflow(ancestor)) {
          left = Math.max(left, ancestor.getBoundingClientRect().left);
        }
      }

      return left;
    };

    /**
     * What is CUT at the screen's edge rather than scrolled to: a link, a control or words of the space's whose box runs
     * past the viewport while an ancestor hides the part that spills — a header whose last links fell off a phone, with
     * no sideways scroll to show for it, which read as a page with nothing wrong. Not inside a row a person scrolls on
     * purpose, nor anything a transform moves (a marquee, a carousel's track), nor what is not drawn.
     */
    const scrolledOnPurpose = (node: Element): boolean => {
      for (let ancestor = node.parentElement; ancestor; ancestor = ancestor.parentElement) {
        const { overflowX } = getComputedStyle(ancestor);
        const pageScroller =
          ancestor === document.documentElement || ancestor === document.body || ancestor.matches('.plitzi-sdk');
        if ((overflowX === 'auto' || overflowX === 'scroll') && !pageScroller) {
          return true;
        }
      }

      return false;
    };
    const moved = (node: Element): boolean => {
      for (let at: Element | null = node; at; at = at.parentElement) {
        const { transform } = getComputedStyle(at);
        if (transform !== 'none' && transform !== '') {
          return true;
        }
      }

      return false;
    };
    const saysSomething = (node: Element): boolean =>
      node.matches('a, button, input, select, textarea, label') ||
      [...node.childNodes].some(child => child.nodeType === Node.TEXT_NODE && (child.textContent ?? '').trim() !== '');
    for (const node of document.querySelectorAll('[data-plitzi-el]')) {
      const box = node.getBoundingClientRect();
      if (box.width === 0 || box.height === 0 || !saysSomething(node)) {
        continue;
      }

      const outside = Math.max(box.right - viewport, -box.left);
      // Hidden by an ancestor, not shown past the edge — that much is the sideways scroll's, said above.
      const hiddenPart = Math.max(box.right - visibleRight(node), visibleLeft(node) - box.left);
      if (
        outside <= 1 ||
        hiddenPart <= 1 ||
        !node.checkVisibility({ opacityProperty: true, visibilityProperty: true }) ||
        scrolledOnPurpose(node) ||
        moved(node)
      ) {
        continue;
      }

      const id = node.getAttribute('data-plitzi-el');
      if (id) {
        cutOff.push({ id, pixels: Math.round(Math.min(outside, hiddenPart)) });
      }
    }
    const wide = [...document.querySelectorAll('body *')]
      .map(node => ({ node, right: visibleRight(node) }))
      .filter(entry => entry.right > viewport + 1)
      .sort((a, b) => b.right - a.right);
    if (wide.length > 0) {
      overflow = {
        pixels: Math.round(wide[0].right - viewport),
        widest: wide.slice(0, 3).map(entry => nameOf(entry.node)),
        elementIds: [
          ...new Set(
            wide
              .slice(0, 3)
              .map(entry => elementIdOf(entry.node))
              .filter((id): id is string => id !== undefined)
          )
        ]
      };
    }
  }

  const illegible: ProbeFindings['illegible'] = [];
  if (input.legibility) {
    /**
     * A computed colour as `[r, g, b, alpha]`, 0–255 and 0–1 — or `null` for one this cannot read, which is then not
     * judged rather than judged wrong. The browser answers in the space the colour was written in: `rgb()` for a hex or
     * a name, `color(srgb …)` for a `color-mix()`, `oklch()`/`oklab()` as written. Read as `rgb()`, the last two came out
     * near black, and a page every visitor could read was said to be unreadable.
     */
    const parse = (value: string): number[] | null => {
      const numbers = (value.match(/-?[\d.]+(?:e-?\d+)?%?/g) ?? []).map(part =>
        part.endsWith('%') ? Number(part.slice(0, -1)) / 100 : Number(part)
      );
      const alpha = (at: number): number => (numbers.length > at ? numbers[at] : 1);
      const gamma = (linear: number): number =>
        255 * Math.min(1, Math.max(0, linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055));
      const fromOklab = (l: number, a: number, b: number, opacity: number): number[] => {
        const [lc, mc, sc] = [
          (l + 0.3963377774 * a + 0.2158037573 * b) ** 3,
          (l - 0.1055613458 * a - 0.0638541728 * b) ** 3,
          (l - 0.0894841775 * a - 1.291485548 * b) ** 3
        ];

        return [
          gamma(4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc),
          gamma(-1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc),
          gamma(-0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc),
          opacity
        ];
      };

      if (numbers.length < 3) {
        return null;
      }

      if (value.startsWith('rgb')) {
        return [numbers[0], numbers[1], numbers[2], alpha(3)];
      }

      if (value.startsWith('color(srgb ')) {
        return [numbers[0] * 255, numbers[1] * 255, numbers[2] * 255, alpha(3)];
      }

      if (value.startsWith('oklab(')) {
        return fromOklab(numbers[0], numbers[1], numbers[2], alpha(3));
      }

      if (value.startsWith('oklch(')) {
        const hue = (numbers[2] * Math.PI) / 180;

        return fromOklab(numbers[0], numbers[1] * Math.cos(hue), numbers[1] * Math.sin(hue), alpha(3));
      }

      return null;
    };

    /**
     * What is PAINTED under a point of the text, composited — or `null` when that cannot be known.
     *
     * Read from the elements stacked at the point rather than from the text's ancestors, because what shows through a
     * translucent button is often not its parent: a photograph positioned behind the hero is a sibling. Only the layers
     * from the text down count: a bar fixed over it, or an overlay, is in front of it, not behind it. Translucent
     * layers are blended down to the first opaque one; a picture, a gradient or a video on the way means the colour
     * there is not a colour, and the check says nothing rather than something false. Where the point is not the text's
     * to read — below the fold, cut off by the pane it scrolls in, or the text not what the browser hits there — the
     * ancestors stand in for the stack, with the same rules.
     */
    const behind = (node: Element): number[] | null => {
      const box = node.getBoundingClientRect();
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      const seen = seenBox(node);
      const atPoint =
        x >= seen.left && y >= seen.top && x < seen.right && y < seen.bottom ? document.elementsFromPoint(x, y) : [];
      const from = atPoint.indexOf(node);
      const stack: Element[] = [];
      if (from !== -1) {
        stack.push(...atPoint.slice(from));
      } else {
        for (let at: Element | null = node; at; at = at.parentElement) {
          stack.push(at);
        }
      }

      const layers: number[][] = [];
      for (const layer of stack) {
        if (['IMG', 'VIDEO', 'CANVAS', 'PICTURE', 'IFRAME'].includes(layer.tagName)) {
          return null;
        }

        const style = getComputedStyle(layer);
        if (style.backgroundImage !== 'none') {
          return null;
        }

        const colour = parse(style.backgroundColor);
        if (colour && colour[3] > 0) {
          layers.push(colour);
          if (colour[3] >= 1) {
            break;
          }
        }
      }

      return layers.reduceRight<number[]>(
        (under, [r, g, b, a]) => [r * a + under[0] * (1 - a), g * a + under[1] * (1 - a), b * a + under[2] * (1 - a)],
        [255, 255, 255]
      );
    };

    /** WCAG's relative luminance of a colour, and the contrast between two: 1 is the same colour, 21 black on white. */
    const luminance = (colour: number[]): number => {
      const [r, g, b] = colour.slice(0, 3).map(value => {
        const channel = value / 255;

        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });

      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrastOf = (one: number[], other: number[]): number => {
      const [light, dark] = [luminance(one), luminance(other)].sort((a, b) => b - a);

      return (light + 0.05) / (dark + 0.05);
    };

    /**
     * Below this nobody reads it — far under what WCAG asks of body text (4.5:1), so a muted caption is not a finding;
     * text this close to what is behind it is a colour that was meant for the other theme.
     */
    const MIN_CONTRAST = 2;

    /**
     * Every element that draws words of its own on the space's page: the space's elements, and whatever a plugin draws
     * inside one of them — the part of a page that is often the most read, with colours of its own. Words hidden from a
     * screen reader (`aria-hidden`) are a decoration, and an SVG's are painted with `fill`, not `color`.
     */
    const writers = new Set<Element>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      const parent = text.parentElement;
      if (
        parent &&
        text.textContent?.trim() &&
        parent.closest('[data-plitzi-el]') &&
        !parent.closest('svg, script, style, noscript, [aria-hidden="true"]')
      ) {
        writers.add(parent);
      }
    }

    for (const node of writers) {
      if (!isVisible(node)) {
        continue;
      }

      const words = [...node.childNodes]
        .filter(child => child.nodeType === Node.TEXT_NODE)
        .map(child => child.textContent ?? '')
        .join(' ')
        .trim();
      const ink = parse(getComputedStyle(node).color);
      const paper = ink ? behind(node) : null;
      if (!ink || !paper) {
        continue;
      }

      // A translucent colour is what it leaves over what is behind it.
      const seen = [0, 1, 2].map(channel => ink[channel] * ink[3] + paper[channel] * (1 - ink[3]));
      const contrast = contrastOf(seen, paper);
      if (contrast < MIN_CONTRAST) {
        const elementId = elementIdOf(node);
        const host = node.closest('[data-plitzi-el]');
        const name = node.hasAttribute('data-plitzi-el') || !host ? nameOf(node) : `${nameOf(host)} › ${nameOf(node)}`;
        illegible.push({
          text: `${name}: "${words.slice(0, 40)}"`,
          contrast: Math.round(contrast * 100) / 100,
          ...(elementId === undefined ? {} : { elementId })
        });
      }
    }
  }

  return {
    marked: document.querySelector('[data-plitzi-el]') !== null,
    missing,
    hidden,
    byWidth,
    brokenImages,
    overflow,
    cutOff,
    illegible
  };
}
