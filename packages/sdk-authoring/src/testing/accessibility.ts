/**
 * What a reader who cannot see the page meets first, checked in the page: its headings go in order — one `h1` to start,
 * no level skipped — and every link, button and field has a name to be read by. What `inspectPage` adds to "it rendered
 * whole", beside legibility: a page can look right and be a maze to a screen reader.
 *
 * Plain data both ways, as the probe's: it crosses into the page as a serialized function.
 */
export interface AccessibilityFindings {
  /** A heading that starts the page below `h1`, or comes more than one level below the one before it. */
  skippedHeadings: { text: string; level: number; after: number; elementId?: string }[];
  /** A link, a button or a field with no name a screen reader can read — what it is, and the element it is in. */
  unnamed: { what: string; elementId?: string }[];
}

/**
 * Runs INSIDE the page, so it is self-contained on purpose: no import, nothing it closes over — a driver serializes its
 * source and evaluates it there.
 */
export function accessibilityInPage(): AccessibilityFindings {
  const elementIdOf = (node: Element): string | undefined =>
    node.closest('[data-plitzi-el]')?.getAttribute('data-plitzi-el') ?? undefined;

  /** On screen for anybody: a box, not hidden, and not taken out of what assistive technology reads. */
  const shown = (node: Element): boolean => {
    if (node.getClientRects().length === 0 || node.closest('[aria-hidden="true"], [inert]')) {
      return false;
    }

    const style = getComputedStyle(node);

    return style.visibility !== 'hidden' && style.display !== 'none';
  };

  /** The words a node gives a reader: its text, and the names of the images in it, without what is hidden from it. */
  const textOf = (node: Element): string => {
    const parts: string[] = [];
    const walk = (at: Node): void => {
      if (at.nodeType === Node.TEXT_NODE) {
        parts.push(at.textContent ?? '');

        return;
      }

      if (!(at instanceof Element) || at.getAttribute('aria-hidden') === 'true') {
        return;
      }

      const named = at.getAttribute('aria-label') ?? (at.tagName === 'IMG' ? at.getAttribute('alt') : null);
      if (named !== null && at !== node) {
        parts.push(named);

        return;
      }

      if (at.tagName.toLowerCase() === 'svg') {
        parts.push(at.querySelector('title')?.textContent ?? '');

        return;
      }

      at.childNodes.forEach(walk);
    };
    walk(node);

    return parts.join(' ').replace(/\s+/g, ' ').trim();
  };

  const nameOf = (node: Element): string => {
    const label = node.getAttribute('aria-label')?.trim();
    if (label) {
      return label;
    }

    const by = node.getAttribute('aria-labelledby');
    if (by) {
      const text = by
        .split(/\s+/)
        .map(id => document.getElementById(id))
        .map(each => (each ? textOf(each) : ''))
        .join(' ')
        .trim();
      if (text) {
        return text;
      }
    }

    if (node instanceof HTMLInputElement || node instanceof HTMLSelectElement || node instanceof HTMLTextAreaElement) {
      const labels = Array.from(node.labels ?? [])
        .map(textOf)
        .join(' ')
        .trim();
      if (labels) {
        return labels;
      }

      if (node instanceof HTMLInputElement && ['submit', 'button', 'reset'].includes(node.type) && node.value) {
        return node.value;
      }

      const placeholder = node.getAttribute('placeholder')?.trim();
      if (placeholder) {
        return placeholder;
      }
    } else {
      const text = textOf(node);
      if (text) {
        return text;
      }
    }

    return node.getAttribute('title')?.trim() ?? '';
  };

  const describe = (node: Element): string => {
    const tag = node.tagName.toLowerCase();
    const type = node.getAttribute('type');
    const role = node.getAttribute('role');
    const href = node.getAttribute('href');

    return `${role ? `${tag}[role=${role}]` : tag}${type ? `[type=${type}]` : ''}${href ? ` to ${href}` : ''}`;
  };

  const skippedHeadings: AccessibilityFindings['skippedHeadings'] = [];
  let before = 0;
  for (const heading of Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]'))) {
    if (!shown(heading)) {
      continue;
    }

    const level = Number(heading.getAttribute('aria-level') ?? /^H([1-6])$/.exec(heading.tagName)?.[1] ?? '2');
    if (level > before + 1) {
      const elementId = elementIdOf(heading);
      skippedHeadings.push({
        text: textOf(heading).slice(0, 80),
        level,
        after: before,
        ...(elementId === undefined ? {} : { elementId })
      });
    }

    before = level;
  }

  const unnamed: AccessibilityFindings['unnamed'] = [];
  const controls = Array.from(
    document.querySelectorAll(
      'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="switch"], [role="tab"], [role="menuitem"]'
    )
  );
  for (const control of controls) {
    if (shown(control) && nameOf(control) === '') {
      const elementId = elementIdOf(control);
      unnamed.push({ what: describe(control), ...(elementId === undefined ? {} : { elementId }) });
    }
  }

  return { skippedHeadings, unnamed };
}
