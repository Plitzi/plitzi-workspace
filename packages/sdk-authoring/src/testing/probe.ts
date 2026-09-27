/**
 * What the browser half of `inspectPage` is asked, and what it answers.
 *
 * Plain data both ways, because it crosses into the page as a serialized argument and comes back the same way.
 */
export interface ProbeInput {
  expected: { id: string; selector: string }[];
  images: boolean;
  overflow: boolean;
  legibility: boolean;
}

export interface ProbeFindings {
  /** Whether anything on the page carries `data-plitzi-el` at all — no means nothing checked below can be found. */
  marked: boolean;
  missing: string[];
  hidden: { id: string; reason: string }[];
  brokenImages: string[];
  overflow: { pixels: number; widest: string[] } | null;
  illegible: string[];
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

  /** Why an element has no box, named by the node that takes it away — which is rarely the element itself. */
  const whyHidden = (node: Element): string => {
    for (let at: Element | null = node; at; at = at.parentElement) {
      const style = getComputedStyle(at);
      if (style.display === 'none') {
        return `display:none on ${at === node ? 'itself' : nameOf(at)}`;
      }

      if (style.visibility === 'hidden' || style.visibility === 'collapse') {
        return `visibility:${style.visibility} on ${at === node ? 'itself' : nameOf(at)}`;
      }
    }

    const box = node.getBoundingClientRect();

    return `it has no size (${Math.round(box.width)}×${Math.round(box.height)})`;
  };

  const isVisible = (node: Element): boolean => {
    const box = node.getBoundingClientRect();

    return box.width > 0 && box.height > 0 && getComputedStyle(node).visibility === 'visible';
  };

  const missing: string[] = [];
  const hidden: { id: string; reason: string }[] = [];
  for (const { id, selector } of input.expected) {
    const nodes = [...document.querySelectorAll(selector)];
    if (nodes.length === 0) {
      missing.push(id);
    } else if (!nodes.some(isVisible)) {
      hidden.push({ id, reason: whyHidden(nodes[0]) });
    }
  }

  /**
   * An image element that failed draws a fallback that loads fine, so the browser alone would call it loaded: it says
   * which source failed in `data-plitzi-failed`. Any other `img` is asked the browser's way — except a lazy one below the
   * fold, which has not been asked for yet, which is it working, not failing.
   */
  const brokenImages = input.images
    ? [...document.querySelectorAll('img')].flatMap(image => {
        const failed = image.getAttribute('data-plitzi-failed');
        if (failed !== null) {
          return [`${failed} (${nameOf(image)})`];
        }

        const pending = image.loading === 'lazy' && image.getBoundingClientRect().top >= window.innerHeight;

        return !pending && (!image.complete || image.naturalWidth === 0)
          ? [image.currentSrc || image.src || nameOf(image)]
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
    const visibleRight = (node: Element): number => {
      let right = node.getBoundingClientRect().right;
      for (let ancestor = node.parentElement; ancestor; ancestor = ancestor.parentElement) {
        const { overflowX } = getComputedStyle(ancestor);
        if (overflowX === 'hidden' || overflowX === 'clip') {
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
        widest: wide.slice(0, 3).map(entry => nameOf(entry.node))
      };
    }
  }

  const illegible: string[] = [];
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
        illegible.push(`${nameOf(node)}: "${text.slice(0, 40)}"`);
      }
    }
  }

  return {
    marked: document.querySelector('[data-plitzi-el]') !== null,
    missing,
    hidden,
    brokenImages,
    overflow,
    illegible
  };
}
