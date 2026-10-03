/**
 * A page measured for import: what it is built from — its tokens, the outline of its landmarks with their real
 * measures, the lists it repeats, its pictures — read in the browser that rendered it. Not its words: an import is a
 * place to start writing from, and the structure is what takes longest to work out by hand.
 */

/** One block of the page's outline, by where it is in the document. */
export interface ImportNode {
  /** Its place among its parent's elements, from the body down: `0/2/1`. The same element at another width. */
  path: string;
  tag: string;
  /** The text of its first heading, which names it. */
  heading?: string;
  /** The `id` the page gave it. */
  id?: string;
  width: number;
  height: number;
  /** Its layout, as the page computes it: only what differs from a plain block. */
  style: Record<string, string>;
  /** How many siblings like it there are, when it stands for a repeated item. */
  repeats?: number;
  children: ImportNode[];
}

/** A run of siblings with the same shape — cards, rows, links — and the fields each one shows. */
export interface ImportList {
  /** The heading of the block it is in, as written — the file it is saved as is named after it — or `''` with none. */
  name: string;
  path: string;
  items: Record<string, string>[];
}

export interface ImportAsset {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface ImportProbe {
  url: string;
  title: string;
  /** The viewport width it was measured at. */
  width: number;
  /** The custom properties `:root` (or `html`) declares, resolved. */
  customProperties: Record<string, string>;
  /**
   * The colours that cover most of the page: its background, its text, and the next few — each with where it was seen,
   * so the same place can be read again in the dark scheme.
   */
  colors: {
    background?: string;
    foreground?: string;
    accents: string[];
    samples: Record<string, ImportColourSample>;
  };
  fonts: { body?: string; heading?: string; google: { family: string; weights: number[] }[]; loaded: string[] };
  /** Corner radii and shadows used three times or more, most used first. */
  radii: string[];
  shadows: string[];
  outline: ImportNode[];
  lists: ImportList[];
  assets: ImportAsset[];
  /** The colours at {@link ImportProbeInput.read}, in its order: `''` where nothing is there any more. */
  read: string[];
}

/** Where a colour was seen: an element by its path, and which of its colours. */
export interface ImportColourSample {
  path: string;
  property: 'color' | 'background-color';
}

export interface ImportProbeInput {
  /** At most this many blocks deep below the body. */
  depth: number;
  /** Places to read a colour at — another probe's samples, read again in another scheme. */
  read?: ImportColourSample[];
}

/** Runs in the page. Self-contained — it is serialised. */
export const importProbe = ({ depth, read = [] }: ImportProbeInput): ImportProbe => {
  const viewport = window.innerWidth;
  const visible = (element: Element): boolean => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);

    return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  };
  const textOf = (element: Element | null | undefined, limit: number): string =>
    (element?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);

  const hex = (value: string): string => {
    const match = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(value);
    if (!match) {
      return value;
    }

    // An absent group is undefined at runtime though the array is typed `string[]`: the default covers it.
    const [, red, green, blue, opacity = '1'] = match;
    const channel = (text: string): string => Number(text).toString(16).padStart(2, '0');
    const alpha = channel(String(Math.round(Number(opacity) * 255)));

    return `#${channel(red)}${channel(green)}${channel(blue)}${alpha === 'ff' ? '' : alpha}`;
  };
  const transparent = (value: string): boolean => value === 'transparent' || /,\s*0\)$/.test(value);

  /** An element's place among its parent's elements, from the body down: `0/2/1`. The body is `''`. */
  const pathOf = (element: Element): string => {
    const steps: number[] = [];
    let current: Element | null = element;
    while (current && current !== document.body) {
      const parent: Element | null = current.parentElement;
      steps.unshift(parent ? Array.from(parent.children).indexOf(current) : 0);
      current = parent;
    }

    return steps.join('/');
  };
  const elementAt = (path: string): Element | undefined => {
    let current: Element | null = document.body;
    for (const step of path ? path.split('/') : []) {
      current = current?.children.item(Number(step)) ?? null;
    }

    return current ?? undefined;
  };

  // --- Tokens -------------------------------------------------------------------------------------------------
  const customProperties: Record<string, string> = {};
  const rootStyle = getComputedStyle(document.documentElement);
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      // Another origin's stylesheet: the browser does not let a page read it.
      continue;
    }

    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSStyleRule) || !/(^|,)\s*(:root|html)\s*(,|$)/.test(rule.selectorText)) {
        continue;
      }

      for (const name of Array.from(rule.style)) {
        if (name.startsWith('--')) {
          customProperties[name.slice(2)] = rootStyle.getPropertyValue(name).trim();
        }
      }
    }
  }

  const backgrounds = new Map<string, number>();
  const texts = new Map<string, number>();
  const radii = new Map<string, number>();
  const shadows = new Map<string, number>();
  const samples = new Map<string, ImportColourSample & { weight: number }>();
  const tally = (map: Map<string, number>, key: string, weight: number) => map.set(key, (map.get(key) ?? 0) + weight);
  /** Keeps, for each colour, the element that shows the most of it: the place least likely to be an exception. */
  const sample = (colour: string, element: Element, property: ImportColourSample['property'], weight: number) => {
    if ((samples.get(colour)?.weight ?? -1) < weight) {
      samples.set(colour, { path: pathOf(element), property, weight });
    }
  };
  const elements = Array.from(document.body.querySelectorAll('*')).slice(0, 4000);
  for (const element of elements) {
    if (!visible(element)) {
      continue;
    }

    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    if (!transparent(style.backgroundColor)) {
      tally(backgrounds, hex(style.backgroundColor), box.width * box.height);
      sample(hex(style.backgroundColor), element, 'background-color', box.width * box.height);
    }

    const ownText = Array.from(element.childNodes)
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent ?? '')
      .join('')
      .trim().length;
    if (ownText > 0) {
      tally(texts, hex(style.color), ownText);
      sample(hex(style.color), element, 'color', ownText);
    }

    if (style.borderRadius !== '0px') {
      tally(radii, style.borderRadius, 1);
    }

    if (style.boxShadow !== 'none') {
      tally(shadows, style.boxShadow, 1);
    }
  }

  const ranked = (map: Map<string, number>, least = 0): string[] =>
    [...map.entries()]
      .filter(([, count]) => count >= least)
      .toSorted((a, b) => b[1] - a[1])
      .map(([key]) => key);
  const pageBackground = getComputedStyle(document.body).backgroundColor;
  const background = transparent(pageBackground) ? ranked(backgrounds).at(0) : hex(pageBackground);
  if (!transparent(pageBackground)) {
    samples.set(hex(pageBackground), { path: '', property: 'background-color', weight: Infinity });
  }

  const foreground = ranked(texts).at(0);
  const accents = [...new Set([...ranked(backgrounds), ...ranked(texts)])]
    .filter(color => color !== background && color !== foreground)
    .slice(0, 6);

  const familyOf = (element: Element | null): string | undefined =>
    element ? getComputedStyle(element).fontFamily.split(',')[0]?.replace(/["']/g, '').trim() : undefined;
  const google = Array.from(document.querySelectorAll('link[href*="fonts.googleapis.com"]')).flatMap(link => {
    const href = link.getAttribute('href') ?? '';
    let url: URL;
    try {
      url = new URL(href, location.href);
    } catch {
      return [];
    }

    return url.searchParams.getAll('family').map(entry => {
      const [family, axes = ''] = entry.split(':');
      const weights = (/wght@([\d;.,]+)/.exec(axes)?.[1] ?? '400')
        .split(/[;,]/)
        .map(weight => Number(weight.split('..')[0]))
        .filter(weight => Number.isFinite(weight) && weight > 0);

      return { family: family.replace(/\+/g, ' '), weights: [...new Set(weights)] };
    });
  });
  const loaded = [
    ...new Set(
      Array.from(document.fonts)
        .filter(face => face.status === 'loaded')
        .map(face => face.family.replace(/["']/g, ''))
    )
  ];

  // --- Outline ------------------------------------------------------------------------------------------------
  const LANDMARKS = new Set(['header', 'nav', 'main', 'section', 'footer', 'aside', 'article', 'form']);
  const signature = (element: Element): string =>
    `${element.tagName}.${[...element.classList].toSorted().join('.')}>${Array.from(element.children)
      .slice(0, 5)
      .map(child => child.tagName)
      .join(',')}`;
  const siblingSignatures = new WeakMap<Element, Map<string, number>>();
  /** One of three or more siblings with the same shape: a card, a row — a block however narrow it is. */
  const isRepeated = (element: Element): boolean => {
    const parent = element.parentElement;
    if (!parent) {
      return false;
    }

    let counts = siblingSignatures.get(parent);
    if (!counts) {
      counts = new Map();
      for (const sibling of Array.from(parent.children)) {
        counts.set(signature(sibling), (counts.get(signature(sibling)) ?? 0) + 1);
      }

      siblingSignatures.set(parent, counts);
    }

    return (counts.get(signature(element)) ?? 0) >= 3;
  };
  const isBlock = (element: Element): boolean => {
    if (!visible(element)) {
      return false;
    }

    const box = element.getBoundingClientRect();
    const display = getComputedStyle(element).display;

    return (
      LANDMARKS.has(element.tagName.toLowerCase()) ||
      (!display.startsWith('inline') &&
        element.children.length > 0 &&
        ((box.width >= viewport * 0.25 && box.height >= 40) || (box.height >= 24 && isRepeated(element))))
    );
  };
  /** The block's own heading: the first one that is not inside a block of its own below it. */
  const headingOf = (block: Element): string | undefined => {
    for (const heading of Array.from(block.querySelectorAll('h1, h2, h3'))) {
      let owner = heading.parentElement;
      while (owner && owner !== block && !isBlock(owner)) {
        owner = owner.parentElement;
      }

      if (owner === block) {
        return textOf(heading, 80) || undefined;
      }
    }

    return undefined;
  };
  const px = (value: string): number => Number.parseFloat(value) || 0;
  const layoutOf = (element: Element): Record<string, string> => {
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    const layout: Record<string, string> = {};
    if (style.display === 'flex' || style.display === 'grid') {
      layout.display = style.display;
    }

    if (style.display === 'flex') {
      if (style.flexDirection !== 'row') {
        layout.flexDirection = style.flexDirection;
      }

      if (style.flexWrap !== 'nowrap') {
        layout.flexWrap = style.flexWrap;
      }
    }

    if (style.display === 'grid') {
      // The browser resolves the tracks to pixels: equal ones that fill the row were fractions of it.
      const tracks = style.gridTemplateColumns.split(' ').filter(Boolean);
      const sizes = tracks.map(px);
      const inner =
        box.width -
        px(style.paddingLeft) -
        px(style.paddingRight) -
        px(style.borderLeftWidth) -
        px(style.borderRightWidth);
      const filled =
        Math.abs(sizes.reduce((sum, size) => sum + size, 0) + px(style.columnGap) * (tracks.length - 1) - inner) < 2;
      const equal = tracks.every(track => track.endsWith('px')) && Math.max(...sizes) - Math.min(...sizes) < 1;
      layout.gridTemplateColumns =
        equal && filled
          ? tracks.length === 1
            ? 'minmax(0, 1fr)'
            : `repeat(${String(tracks.length)}, minmax(0, 1fr))`
          : style.gridTemplateColumns;
    }

    if (style.display === 'flex' || style.display === 'grid') {
      for (const [key, value] of [
        ['rowGap', style.rowGap],
        ['columnGap', style.columnGap],
        ['alignItems', style.alignItems],
        ['justifyContent', style.justifyContent]
      ] as const) {
        if (value !== 'normal' && value !== '0px') {
          layout[key] = value;
        }
      }
    }

    if (style.maxWidth !== 'none') {
      layout.maxWidth = style.maxWidth;
    }

    for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) {
      const value = style.getPropertyValue(`padding-${side.toLowerCase()}`);
      if (px(value) > 0) {
        layout[`padding${side}`] = value;
      }
    }

    // Equal room on both sides in a plain block: a column of a fixed width, which is `margin: 0 auto` — still so where
    // its max-width fills the row and the room is none. A flex or grid parent that centres it is the parent's rule.
    const parentDisplay = element.parentElement ? getComputedStyle(element.parentElement).display : 'block';
    const marginLeft = px(style.marginLeft);
    if (
      parentDisplay === 'block' &&
      (marginLeft > 1 || (style.maxWidth !== 'none' && marginLeft === 0)) &&
      Math.abs(marginLeft - px(style.marginRight)) < 1
    ) {
      layout.marginLeft = 'auto';
      layout.marginRight = 'auto';
    }

    if (!transparent(style.backgroundColor)) {
      layout.backgroundColor = hex(style.backgroundColor);
    }

    if (style.borderRadius !== '0px') {
      layout.borderRadius = style.borderRadius;
    }

    return layout;
  };

  const lists: ImportList[] = [];
  const fieldsOf = (item: Element): Record<string, string> => {
    const fields: Record<string, string> = {};
    const heading = item.querySelector('h1, h2, h3, h4, h5, h6, strong, b');
    const title = textOf(heading, 120);
    if (title) {
      fields.title = title;
    }

    const paragraph = textOf(item.querySelector('p'), 300);
    if (paragraph && paragraph !== title) {
      fields.text = paragraph;
    }

    const image = item.querySelector('img');
    if (image instanceof HTMLImageElement && (image.currentSrc || image.src)) {
      fields.image = image.currentSrc || image.src;
      if (image.alt) {
        fields.imageAlt = image.alt;
      }
    }

    const anchor = item instanceof HTMLAnchorElement ? item : item.querySelector('a');
    if (anchor instanceof HTMLAnchorElement && anchor.href) {
      fields.href = anchor.href;
      if (!fields.title) {
        const label = textOf(anchor, 120);
        if (label) {
          fields.title = label;
        }
      }
    }

    const price = /(?:[$€£]\s?\d[\d.,]*|\d[\d.,]*\s?(?:€|\$|USD|EUR))/.exec(textOf(item, 600))?.[0];
    if (price) {
      fields.price = price;
    }

    return fields;
  };
  const outlineOf = (parent: Element, level: number, around: string): ImportNode[] => {
    // A wrapper that only holds one block the same size is the same block: its child is what is read.
    const blocks: Element[] = [];
    for (const child of Array.from(parent.children)) {
      let current = child;
      for (;;) {
        const only = Array.from(current.children).filter(isBlock);
        const box = current.getBoundingClientRect();
        const inner = only.at(0)?.getBoundingClientRect();
        if (
          only.length === 1 &&
          inner &&
          Math.abs(inner.width - box.width) < 2 &&
          Math.abs(inner.height - box.height) < 2
        ) {
          current = only[0];
          continue;
        }

        break;
      }

      if (isBlock(current)) {
        blocks.push(current);
      }
    }

    const groups = new Map<string, Element[]>();
    for (const block of blocks) {
      const key = signature(block);
      groups.set(key, [...(groups.get(key) ?? []), block]);
    }

    const nodes: ImportNode[] = [];
    const seen = new Set<string>();
    for (const block of blocks.slice(0, 24)) {
      const key = signature(block);
      const twins = groups.get(key) ?? [block];
      if (seen.has(key)) {
        continue;
      }

      const heading = headingOf(block);
      const repeated = twins.length >= 3;
      if (repeated) {
        seen.add(key);
        const items = twins.map(fieldsOf);
        const common = Object.keys(items[0] ?? {}).filter(
          field => items.filter(item => field in item).length >= items.length / 2
        );
        if (common.length > 0) {
          lists.push({
            name: around || heading || '',
            path: pathOf(block),
            items: items.map(item =>
              Object.fromEntries(common.filter(field => field in item).map(field => [field, item[field]]))
            )
          });
        }
      }

      const box = block.getBoundingClientRect();
      nodes.push({
        path: pathOf(block),
        tag: block.tagName.toLowerCase(),
        ...(heading ? { heading } : {}),
        ...(block.id ? { id: block.id } : {}),
        width: Math.round(box.width),
        height: Math.round(box.height),
        style: layoutOf(block),
        ...(repeated ? { repeats: twins.length } : {}),
        children: level < depth ? outlineOf(block, level + 1, heading ?? around) : []
      });
    }

    return nodes;
  };

  const blocks = outlineOf(document.body, 1, '');
  const bodyBox = document.body.getBoundingClientRect();
  // A page whose body holds its text directly has no block below it: the body is the one block there is.
  const outline: ImportNode[] =
    blocks.length > 0
      ? blocks
      : [
          {
            path: '',
            tag: 'div',
            ...(headingOf(document.body) ? { heading: headingOf(document.body) } : {}),
            width: Math.round(bodyBox.width),
            height: Math.round(bodyBox.height),
            style: layoutOf(document.body),
            children: []
          }
        ];

  const assets = [
    ...new Map(
      Array.from(document.images)
        .filter(image => (image.currentSrc || image.src) && image.naturalWidth > 0)
        .map(image => [
          image.currentSrc || image.src,
          { src: image.currentSrc || image.src, alt: image.alt, width: image.naturalWidth, height: image.naturalHeight }
        ])
    ).values()
  ].slice(0, 300);

  return {
    url: location.href,
    title: document.title,
    width: viewport,
    customProperties,
    colors: {
      ...(background ? { background } : {}),
      ...(foreground ? { foreground } : {}),
      accents,
      samples: Object.fromEntries(
        [background, foreground, ...accents].flatMap(colour => {
          const found = colour === undefined ? undefined : samples.get(colour);

          return colour !== undefined && found ? [[colour, { path: found.path, property: found.property }]] : [];
        })
      )
    },
    fonts: {
      ...(familyOf(document.body) ? { body: familyOf(document.body) } : {}),
      ...(familyOf(document.querySelector('h1, h2')) ? { heading: familyOf(document.querySelector('h1, h2')) } : {}),
      google,
      loaded
    },
    radii: ranked(radii, 3).slice(0, 4),
    shadows: ranked(shadows, 3).slice(0, 4),
    outline,
    lists: lists.slice(0, 10),
    assets,
    read: read.map(({ path, property }) => {
      const element = elementAt(path);

      return element ? hex(getComputedStyle(element).getPropertyValue(property)) : '';
    })
  };
};
