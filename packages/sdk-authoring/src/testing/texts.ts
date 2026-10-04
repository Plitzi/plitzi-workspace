/**
 * The words of two pages paired — the same text on both — and what each pair does differently: its size, its weight,
 * its colour, the box around it, where it sits. What a picture comparison says as a percentage, said as the property
 * that makes it, so a page being matched to another is changed where it differs instead of measured by hand.
 */

/** One run of words on a page, with what decides how it looks. */
export interface PageText {
  /** The words, with their spaces collapsed, cut at 120 characters: past them, the start is enough to tell two apart. */
  text: string;
  tag: string;
  /** Its box, on the whole page. */
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontWeight: string;
  lineHeight: string;
  letterSpacing: string;
  /** The first family the page names. */
  fontFamily: string;
  color: string;
  background: string;
  padding: string;
  radius: string;
}

/**
 * Runs in the page: every element that holds words of its own and is drawn, with what decides how they look. Skips the
 * dev tools' own chrome, and what a visitor cannot see. Self-contained — it is serialised.
 */
export const pageTexts = (limit: number): PageText[] => {
  const texts: PageText[] = [];
  const seen = new Set<Element>();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node && texts.length < limit; node = walker.nextNode()) {
    const element = node.parentElement;
    if (!element || seen.has(element) || !node.textContent?.trim()) {
      continue;
    }

    seen.add(element);
    if (element.closest('script, style, noscript, template, [data-plitzi-devtools]')) {
      continue;
    }

    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    if (box.width === 0 || box.height === 0 || style.visibility === 'hidden' || Number(style.opacity) === 0) {
      continue;
    }

    const text = element.textContent.replace(/\s+/g, ' ').trim().slice(0, 120);
    texts.push({
      text,
      tag: element.tagName.toLowerCase(),
      x: Math.round(box.left + window.scrollX),
      y: Math.round(box.top + window.scrollY),
      width: Math.round(box.width),
      height: Math.round(box.height),
      fontSize: Number.parseFloat(style.fontSize),
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
      letterSpacing: style.letterSpacing,
      fontFamily: (style.fontFamily.split(',')[0] ?? '').replace(/["']/g, '').trim().toLowerCase(),
      color: style.color,
      background: style.backgroundColor,
      padding: style.padding,
      radius: style.borderRadius
    });
  }

  return texts;
};

/** How many texts a page is read for: enough for a long page, few enough to stay quick. */
export const PAGE_TEXT_LIMIT = 2000;

/** A text on both pages, and what it does differently on the second: `font-size 68px → 60px`. */
export interface TextDifference {
  tag: string;
  text: string;
  /** Where it is on the first page. */
  y: number;
  differences: string[];
}

export interface TextComparison {
  /** The texts found on both pages that look the same. */
  same: number;
  /** Those that do not, top to bottom on the first page. */
  differ: TextDifference[];
  /** Words only one of the two pages has. */
  onlyHere: string[];
  onlyThere: string[];
}

/** Below these, two measures are the same: half a pixel of type is rounding, a few pixels of box is a border. */
const TYPE_PX = 0.5;

const BOX_PX = 4;

const px = (value: number): string => `${String(Math.round(value * 10) / 10)}px`;

const signed = (value: number): string => `${value > 0 ? '+' : ''}${String(Math.round(value))}px`;

const MEASURE = /^(-?[\d.]+)([a-z%]*)$/;

/**
 * Two values of a property as the browser computed them. One measure in one unit each (`24px`, `0.5px`) compares by
 * the half pixel; anything else — `normal`, a colour, `8px 16px` — as written.
 */
const changed = (a: string, b: string): boolean => {
  const [one, two] = [MEASURE.exec(a), MEASURE.exec(b)];
  if (!one || !two || one[2] !== two[2]) {
    return a !== b;
  }

  return Math.abs(Number(one[1]) - Number(two[1])) >= TYPE_PX;
};

/**
 * What a text does differently on the second page. A position is said after taking off how far the whole section around
 * it moved (`shiftAt`, from `alignPictures`): a page 400 px longer above it is not a heading out of place.
 */
const differencesOf = (here: PageText, there: PageText, shiftAt: (y: number) => number): string[] => {
  const differences: string[] = [];
  if (Math.abs(here.fontSize - there.fontSize) >= TYPE_PX) {
    differences.push(`font-size ${px(here.fontSize)} → ${px(there.fontSize)}`);
  }

  const properties: [string, keyof PageText][] = [
    ['font-weight', 'fontWeight'],
    ['line-height', 'lineHeight'],
    ['letter-spacing', 'letterSpacing'],
    ['font-family', 'fontFamily'],
    ['color', 'color'],
    ['background', 'background'],
    ['padding', 'padding'],
    ['border-radius', 'radius']
  ];
  for (const [name, key] of properties) {
    const [a, b] = [String(here[key]), String(there[key])];
    if (changed(a, b)) {
      differences.push(`${name} ${a} → ${b}`);
    }
  }

  for (const [name, a, b] of [
    ['width', here.width, there.width],
    ['height', here.height, there.height]
  ] as const) {
    if (Math.abs(a - b) >= BOX_PX) {
      differences.push(`${name} ${px(a)} → ${px(b)}`);
    }
  }

  const across = there.x - here.x;
  const down = there.y - here.y - shiftAt(here.y);
  if (Math.abs(across) >= BOX_PX) {
    differences.push(`x ${signed(across)}`);
  }

  if (Math.abs(down) >= BOX_PX) {
    differences.push(`y ${signed(down)}`);
  }

  return differences;
};

/**
 * The texts of two pages paired by their words — the second "Pricing" with the second "Pricing" — and what each pair
 * does differently on the second page. `shiftAt` says how far down the second page the rows around a point of the first
 * are, when the two were aligned; left out, nothing moved.
 */
export const compareTexts = (
  here: PageText[],
  there: PageText[],
  shiftAt: (y: number) => number = () => 0
): TextComparison => {
  const waiting = new Map<string, PageText[]>();
  for (const text of there) {
    waiting.set(text.text, [...(waiting.get(text.text) ?? []), text]);
  }

  const differ: TextDifference[] = [];
  const onlyHere: string[] = [];
  let same = 0;
  for (const text of [...here].sort((one, two) => one.y - two.y)) {
    const match = waiting.get(text.text)?.shift();
    if (!match) {
      onlyHere.push(text.text);
      continue;
    }

    const differences = differencesOf(text, match, shiftAt);
    if (differences.length === 0) {
      same += 1;
    } else {
      differ.push({ tag: text.tag, text: text.text, y: text.y, differences });
    }
  }

  return { same, differ, onlyHere, onlyThere: [...waiting.values()].flat().map(text => text.text) };
};
