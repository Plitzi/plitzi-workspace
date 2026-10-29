/**
 * What a visitor sees of an element: whether any of it is in sight, scrolling where the page lets them — or what keeps
 * it out of sight. A box on the page is not one seen: a run's panel was "visible" at y=614 inside a column of 495 px that
 * clipped it under the legend, and every check of the run passed on what no visitor saw.
 */
export type Sight =
  /** `scrolled`: the scrolling box a visitor scrolls to bring it into sight — none when it is in sight as it is. */
  | { seen: true; scrolled?: string }
  | {
      seen: false;
      /**
       * `clipped`: a box that hides what spills past it, and does not scroll (`overflow: hidden`, `clip`); `outside`: past
       * the edge of a screen that does not scroll to it (a page whose document is locked); `covered`: under something
       * drawn over every part of it in sight; `taken`: a control whose press another control over it takes — seen
       * through a clear button, and never pressed; `no-size`: nothing of it drawn.
       */
      why: 'clipped' | 'outside' | 'covered' | 'taken' | 'no-size';
      by?: string;
    };

/**
 * The sight of `node`, read from the page as it is — nothing scrolled, nothing changed. Self-contained, as a function a
 * browser is handed whole (`page.evaluate`) must be: no name of this module is read inside it.
 */
export const sightOf = (node: Element): Sight => {
  const nameOf = (element: Element): string =>
    element.closest('[data-plitzi-el]')?.getAttribute('data-plitzi-el') ??
    `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}`;
  const own = node.getBoundingClientRect();
  if (own.width <= 0 || own.height <= 0) {
    return { seen: false, why: 'no-size' };
  }

  const view = node.ownerDocument.defaultView;
  const width = view?.innerWidth ?? 0;
  const height = view?.innerHeight ?? 0;
  const root = node.ownerDocument.documentElement;
  const body = node.ownerDocument.body;
  let { left, top, right, bottom } = own;
  /** What is in sight now, as the page is — the part whose cover is read; undefined once a scroll is needed. */
  let now: { left: number; top: number; right: number; bottom: number } | undefined = { left, top, right, bottom };
  let scrolled: string | undefined;
  const scrolls = (value: string): boolean => value === 'auto' || value === 'scroll';
  for (let at = node.parentElement; at && at !== body && at !== root; at = at.parentElement) {
    const style = getComputedStyle(at);
    if (style.display === 'contents' || (style.overflowX === 'visible' && style.overflowY === 'visible')) {
      continue;
    }

    // Its padding box: what it shows of what is inside it, its borders and scrollbars left out.
    const box = at.getBoundingClientRect();
    const area = {
      left: box.left + at.clientLeft,
      top: box.top + at.clientTop,
      right: box.left + at.clientLeft + (at.clientWidth || box.width),
      bottom: box.top + at.clientTop + (at.clientHeight || box.height)
    };
    const axes = [
      { overflow: style.overflowX, start: 'left', end: 'right', room: at.scrollWidth > at.clientWidth },
      { overflow: style.overflowY, start: 'top', end: 'bottom', room: at.scrollHeight > at.clientHeight }
    ] as const;
    for (const axis of axes) {
      if (axis.overflow === 'visible') {
        continue;
      }

      const from = axis.start === 'left' ? left : top;
      const to = axis.end === 'right' ? right : bottom;
      const edge = { from: area[axis.start], to: area[axis.end] };
      if (from < edge.to && to > edge.from) {
        const seenFrom = Math.max(from, edge.from);
        const seenTo = Math.min(to, edge.to);
        if (axis.start === 'left') {
          left = seenFrom;
          right = seenTo;
        } else {
          top = seenFrom;
          bottom = seenTo;
        }

        continue;
      }

      // Out of its sight: a visitor scrolls it into view when it scrolls, and never sees it when it does not.
      if (!scrolls(axis.overflow) || !axis.room) {
        return { seen: false, why: 'clipped', by: nameOf(at) };
      }

      scrolled ??= nameOf(at);
      now = undefined;
      const size = Math.min(to - from, edge.to - edge.from);
      if (axis.start === 'left') {
        left = edge.from;
        right = edge.from + size;
      } else {
        top = edge.from;
        bottom = edge.from + size;
      }
    }
  }

  // The screen: a document that scrolls brings any of its part into sight; one that does not (its overflow hidden — a
  // page drawn as a screen of its own) shows only what is on it.
  const locked = [root, body].some(each => {
    const style = getComputedStyle(each);

    return style.overflowY === 'hidden' || style.overflowY === 'clip';
  });
  if (locked && width > 0 && height > 0 && (bottom <= 0 || top >= height || right <= 0 || left >= width)) {
    return { seen: false, why: 'outside', by: 'the screen' };
  }

  if (now === undefined || typeof node.ownerDocument.elementFromPoint !== 'function' || width <= 0 || height <= 0) {
    return scrolled === undefined ? { seen: true } : { seen: true, scrolled };
  }

  // Under something drawn over it: each point of it in sight is read — a part is enough to be seen.
  const inView = {
    left: Math.max(left, 0),
    top: Math.max(top, 0),
    right: Math.min(right, width),
    bottom: Math.min(bottom, height)
  };
  if (inView.right <= inView.left || inView.bottom <= inView.top || getComputedStyle(node).pointerEvents === 'none') {
    return { seen: true };
  }

  // A control is seen to be pressed: one under another control — a clear button placed over a header's filters — shows
  // through it and takes no press. A run's chip sat under the fullscreen button at 2560 and read "in sight".
  const pressable = (element: Element): boolean =>
    element.matches(
      'a[href], button, input, select, textarea, summary, [role="button"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], [role="option"]'
    ) || getComputedStyle(element).cursor === 'pointer';
  if (pressable(node)) {
    const middle = node.ownerDocument.elementFromPoint(
      (inView.left + inView.right) / 2,
      (inView.top + inView.bottom) / 2
    );
    let taker: Element | null = middle;
    while (taker && !node.contains(taker) && !taker.contains(node) && !pressable(taker)) {
      taker = taker.parentElement;
    }

    if (taker && !node.contains(taker) && !taker.contains(node)) {
      return { seen: false, why: 'taken', by: nameOf(taker) };
    }
  }

  /** Whether an element draws over what is under it: a ground, a picture, a border, words of its own. */
  const draws = (element: Element): boolean => {
    const style = getComputedStyle(element);
    const ground = /rgba?\(([^)]+)\)/.exec(style.backgroundColor)?.[1]?.split(',');
    const alpha = ground && ground.length === 4 ? Number.parseFloat(ground[3] ?? '1') : ground ? 1 : 0;

    return (
      alpha > 0 ||
      (style.backgroundImage !== '' && style.backgroundImage !== 'none') ||
      ['IMG', 'CANVAS', 'VIDEO', 'SVG', 'svg', 'IFRAME'].includes(element.tagName) ||
      Array.from(element.childNodes).some(child => child.nodeType === 3 && (child.textContent ?? '').trim() !== '')
    );
  };
  const points = [
    [0.5, 0.5],
    [0.25, 0.25],
    [0.75, 0.25],
    [0.25, 0.75],
    [0.75, 0.75]
  ].map(([x = 0, y = 0]) => [
    inView.left + (inView.right - inView.left) * x,
    inView.top + (inView.bottom - inView.top) * y
  ]);
  let cover: Element | undefined;
  for (const [x = 0, y = 0] of points) {
    const hit = node.ownerDocument.elementFromPoint(x, y);
    if (!hit || node.contains(hit) || hit.contains(node)) {
      return { seen: true };
    }

    // What lies over it, up to the box both are in: drawn, it hides this point; clear (a layer that only places), not.
    let drawn: Element | undefined;
    for (let at: Element | null = hit; at && !at.contains(node); at = at.parentElement) {
      if (draws(at)) {
        drawn = at;
        break;
      }
    }

    if (!drawn) {
      return { seen: true };
    }

    cover ??= drawn;
  }

  return cover ? { seen: false, why: 'covered', by: nameOf(cover) } : { seen: true };
};

/** A sight said in words, as a check says why an element it was asked about is not seen — or where it is. */
export const sightText = (sight: Sight): string => {
  if (sight.seen) {
    return sight.scrolled === undefined ? 'in sight' : `out of sight until ${sight.scrolled} is scrolled`;
  }

  switch (sight.why) {
    case 'clipped':
      return `clipped by ${sight.by ?? 'a box'}, which hides what spills past it and does not scroll: nothing a visitor does brings it into sight`;
    case 'outside':
      return 'past the edge of the screen, and the page does not scroll to it (its document is locked)';
    case 'covered':
      return `under ${sight.by ?? 'another element'}, drawn over every part of it in sight`;
    case 'taken':
      return `under ${sight.by ?? 'another control'}, which takes its press: a visitor sees it through it and cannot press it`;
    case 'no-size':
      return 'nothing of it is drawn (no size)';
  }
};
