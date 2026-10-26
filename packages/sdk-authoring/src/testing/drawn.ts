/**
 * Whether a page draws anything of its own, checked in the page: a word, a picture, a control — anything its own
 * elements show, the layout around it apart. A run's 404 drew its layout and nothing else, every part of it hidden on
 * a record not found, and every check passed: nothing owed was missing, since nothing was owed.
 *
 * Plain data both ways, as the probe's: it crosses into the page as a serialized function.
 */
export interface DrawnRegion {
  /** The page's own element, by its selector. */
  page: string;
  /** The ids of the layouts it renders inside, every element of them: not the page's own. */
  notOwn: string[];
}

/**
 * Runs INSIDE the page, so it is self-contained on purpose: no import, nothing it closes over. True when the page
 * draws something of its own, or is not there to be read (no `region`, or its element missing) — not this check's to
 * say then.
 */
export function drawnInPage(input: { region?: DrawnRegion }): boolean {
  const region = input.region;
  const root = region ? document.querySelector(region.page) : null;
  if (!region || !root) {
    return true;
  }

  const notOwn = new Set(region.notOwn);
  const own = (node: Element): boolean => {
    // The refusal of a page withheld from its visitor, drawn unmarked in the layout's slot: the page's own words.
    if (node.closest('[data-withheld]')) {
      return true;
    }

    const id = node.closest('[data-plitzi-el]')?.getAttribute('data-plitzi-el');

    return id !== null && id !== undefined && !notOwn.has(id);
  };
  const shown = (node: Element): boolean => {
    const box = node.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) {
      return false;
    }

    for (let at: Element | null = node; at; at = at.parentElement) {
      const style = getComputedStyle(at);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
      }
    }

    return true;
  };

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (parent && (node.textContent ?? '').trim() !== '' && own(parent) && shown(parent)) {
      return true;
    }
  }

  return [...root.querySelectorAll('img, svg, video, canvas, iframe, input, textarea, select, button')].some(
    node => own(node) && shown(node)
  );
}
