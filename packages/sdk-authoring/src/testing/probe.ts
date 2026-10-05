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
  illegible: { text: string; elementId?: string }[];
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
   * Whether any of a node is where it can be seen: its box cut by every ancestor that clips what spills (a carousel's
   * track, a scrolling row) and then by the viewport — the test the browser runs before it fetches a lazy image.
   */
  const inSight = (node: Element): boolean => {
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

    return (
      Math.min(right, window.innerWidth) > Math.max(left, 0) && Math.min(bottom, window.innerHeight) > Math.max(top, 0)
    );
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

  const illegible: { text: string; elementId?: string }[] = [];
  if (input.legibility) {
    const parse = (value: string): number[] | null => {
      const parts = value.match(/[\d.]+/g);

      return parts && parts.length >= 3
        ? [...parts.slice(0, 3).map(Number), parts.length > 3 ? Number(parts[3]) : 1]
        : null;
    };

    /**
     * What is PAINTED under a point of the text, composited — or `null` when that cannot be known.
     *
     * Read from the elements stacked at the point rather than from the text's ancestors, because what shows through a
     * translucent button is often not its parent: a photograph positioned behind the hero is a sibling. Translucent
     * layers are blended down to the first opaque one; a picture, a gradient or a video on the way means the colour
     * there is not a colour, and the check says nothing rather than something false. Below the fold the stack cannot
     * be read, so the ancestors stand in for it, with the same rules.
     */
    const behind = (node: Element): number[] | null => {
      const box = node.getBoundingClientRect();
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      const inView = x >= 0 && y >= 0 && x < window.innerWidth && y < window.innerHeight;
      const stack: Element[] = [];
      if (inView) {
        stack.push(...document.elementsFromPoint(x, y));
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

    for (const node of document.querySelectorAll('[data-plitzi-el]')) {
      const text = node.textContent.trim();
      if (!text || node.children.length > 0 || !isVisible(node)) {
        continue;
      }

      const ink = parse(getComputedStyle(node).color);
      const paper = ink ? behind(node) : null;
      if (!ink || !paper) {
        continue;
      }

      const distance = Math.abs(ink[0] - paper[0]) + Math.abs(ink[1] - paper[1]) + Math.abs(ink[2] - paper[2]);
      if (ink[3] === 0 || distance < 24) {
        const elementId = elementIdOf(node);
        illegible.push({
          text: `${nameOf(node)}: "${text.slice(0, 40)}"`,
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
    illegible
  };
}
