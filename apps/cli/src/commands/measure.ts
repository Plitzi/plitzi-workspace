import chalk from 'chalk';
import { InvalidArgumentError } from 'commander';

import { openPage } from '@plitzi/sdk-authoring';

import { launchBrowser, openProjectPage } from '../browser';
import { projectHere } from './existingProject';
import { originHere } from '../runs/copyServer';
import { targetOn } from './shot/capture';
import { pictureAnswered } from './shot/remote';
import { fail } from './terminal';

import type { Browser, BrowserPage, Scheme } from '../browser';

/**
 * `plitzi page measure`: an element's computed styles — what a designer sizes a copy by — and, with `--compare`, the
 * same of an element of another page, beside them. velada-polish's designers wrote Playwright scripts of their own and
 * read the original's CSS by curl for each value they asked a developer for (a size, a weight, a tracking, a border);
 * the comparison of pictures says what differs, never by how much.
 */

/** What is read of each element: its type, its colours, its box's dress and its size — what a review asks in values. */
export const MEASURED = [
  'font-family',
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
  'text-transform',
  'color',
  'background-color',
  'background-image',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'border-radius',
  'box-shadow',
  'text-shadow',
  'opacity',
  'padding',
  'margin',
  'gap',
  'display',
  'width',
  'height'
] as const;

export interface Measured {
  /** Where it was found: the selector the name resolved to. */
  selector: string;
  tag: string;
  /** Its first words, to tell it is the one meant. */
  text: string;
  styles: Record<string, string>;
}

export interface MeasureOptions {
  url?: string;
  width?: number;
  scheme?: Scheme;
  timezone?: string;
  /** Another page — another site's, a reference — whose element is measured beside this one. */
  compare?: string;
  /** That page's element, by any selector: the element's own name when left out. */
  there?: string;
  /**
   * The properties that must be the same as the other page's — `font-size,border` — or the command fails: what an
   * acceptance proves a value by, measured, never typed from a guess (velada-polish's VS sizes were the lead's guess).
   */
  same?: string[];
  json?: boolean;
}

/** One element of an open page, measured — or why it could not be. */
export const measureOn = async (page: BrowserPage, target: string): Promise<Measured | { problem: string }> => {
  const found = await targetOn(page, target);
  if ('problem' in found) {
    return found;
  }

  if (!found.found) {
    return { problem: `${target} is not on ${page.url()}` };
  }

  return {
    selector: found.selector,
    ...(await page
      .locator(found.selector)
      .first()
      .evaluate(
        (node, properties: readonly string[]) => {
          const computed = getComputedStyle(node);

          return {
            tag: node.tagName.toLowerCase(),
            text: node.textContent.replace(/\s+/g, ' ').trim().slice(0, 60),
            styles: Object.fromEntries(properties.map(property => [property, computed.getPropertyValue(property)]))
          };
        },
        [...MEASURED]
      ))
  };
};

/** A colour written as CSS Color 4 writes it — `color(srgb 0.78 0.66 0.42 / 0.5)` — as `rgb()`: one colour, one way. */
const SRGB = /color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)/g;

const channel = (value: string): string => String(Math.round(Number(value) * 255));

/** `oklab(L a b / alpha)` — what Tailwind writes a colour as — the same colour in sRGB channels (Björn Ottosson's). */
const OKLAB = /oklab\(([-\d.]+) ([-\d.]+) ([-\d.]+)(?: \/ ([\d.]+))?\)/g;

const fromOklab = (lightness: number, a: number, b: number): [number, number, number] => {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const gamma = (linear: number): number =>
    Math.round(
      Math.min(1, Math.max(0, linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055)) * 255
    );

  return [
    gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
  ];
};

const rgbText = ([r, g, b]: [number, number, number], alpha?: string): string =>
  alpha === undefined || Number(alpha) === 1
    ? `rgb(${String(r)}, ${String(g)}, ${String(b)})`
    : `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${String(Math.round(Number(alpha) * 100) / 100)})`;

/**
 * A computed value as it is compared: its colours in one notation, its numbers to two decimals — what a browser writes
 * two ways for one look (velada's gold read `rgb(199, 168, 107)` on one page and `color(srgb 0.78 0.66 0.42)` on the
 * other) is no difference to ask a developer for.
 */
const comparable = (property: string, value: string): string => {
  const colours = value
    .replace(SRGB, (_match, r: string, g: string, b: string, alpha?: string) =>
      rgbText([Number(channel(r)), Number(channel(g)), Number(channel(b))], alpha)
    )
    .replace(OKLAB, (_match, lightness: string, a: string, b: string, alpha?: string) =>
      rgbText(fromOklab(Number(lightness), Number(a), Number(b)), alpha)
    )
    .replace(/rgba\((\d+), (\d+), (\d+), 1\)/g, 'rgb($1, $2, $3)');
  const numbers = colours.replace(/(\d+\.\d+)/g, number => String(Math.round(Number(number) * 100) / 100));
  // A font is the one it asks for first: the fallbacks after it are what a machine without it shows.
  if (property === 'font-family') {
    return (numbers.split(',')[0] ?? '').replace(/["']/g, '').trim().toLowerCase();
  }

  // A side with no width draws nothing, whatever its style and colour (its colour follows the text's).
  if (property.startsWith('border-') && /^0px\b/.test(numbers)) {
    return 'none';
  }

  return numbers;
};

/** The properties that differ — here, there — and those the two share: what is read first, and what is said in a line. */
export const differences = (
  here: Measured,
  there: Measured
): { differ: { property: string; here: string; there: string }[]; same: string[] } => {
  const alike = (property: string): boolean =>
    comparable(property, here.styles[property] ?? '') === comparable(property, there.styles[property] ?? '');

  return {
    differ: MEASURED.filter(property => !alike(property)).map(property => ({
      property,
      here: here.styles[property] ?? '',
      there: there.styles[property] ?? ''
    })),
    same: MEASURED.filter(alike)
  };
};

const named = (each: Measured): string => `${each.tag}${each.text ? ` "${each.text}"` : ''}`;

export const measuredText = (here: Measured, there?: Measured, url?: string): string => {
  if (!there) {
    return [
      chalk.bold(`${named(here)} (${here.selector})`),
      ...MEASURED.map(property => `  ${property.padEnd(16)} ${here.styles[property] ?? ''}`)
    ].join('\n');
  }

  const { differ, same } = differences(here, there);

  return [
    chalk.bold(`${named(here)} here → ${named(there)} on ${url ?? 'the other page'}`),
    ...(differ.length === 0
      ? ['  every property measured is the same']
      : differ.map(each => `  ${chalk.yellow('≠')} ${each.property.padEnd(16)} ${each.here}  →  ${each.there}`)),
    ...(same.length > 0 ? [chalk.dim(`  the same: ${same.join(', ')}`)] : [])
  ].join('\n');
};

/** Shorthands `--same` takes for the properties they stand for: a border is its four sides, a type its six. */
const GROUPS: Record<string, readonly string[]> = {
  border: ['border-top', 'border-right', 'border-bottom', 'border-left'],
  font: ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-transform'],
  size: ['width', 'height']
};

/** `--same`'s list, each a property measured or a shorthand of them — refused, naming the rest, when one is neither. */
export const sameProperties = (value: string): string[] => {
  const asked = value
    .split(',')
    .map(each => each.trim())
    .filter(Boolean);
  const unknown = asked.filter(each => !Object.hasOwn(GROUPS, each) && !MEASURED.some(property => property === each));
  if (unknown.length > 0 || asked.length === 0) {
    throw new InvalidArgumentError(
      `--same takes what is measured — ${MEASURED.join(', ')} — or ${Object.keys(GROUPS).join(', ')}${unknown.length > 0 ? `: not ${unknown.join(', ')}` : ''}`
    );
  }

  return [...new Set(asked.flatMap(each => GROUPS[each] ?? [each]))];
};

/** The other page, asked as a site is — again, a moment later, when it says it is busy (429, 503) — and open. */
const otherPage = async (
  browser: Browser,
  url: string,
  options: MeasureOptions
): Promise<BrowserPage | { problem: string }> => {
  const taken = await pictureAnswered(browser, url, {
    width: options.width ?? 1440,
    height: 900,
    ...(options.scheme ? { scheme: options.scheme } : {}),
    reducedMotion: true,
    still: true,
    ...(options.timezone ? { timezone: options.timezone } : {})
  });

  return 'problem' in taken ? taken : taken.page;
};

export const measure = async (route: string, element: string, options: MeasureOptions): Promise<void> => {
  const project = await projectHere('whose page to measure');
  if (!project) {
    return;
  }

  const plitzi = project.plitzi?.kind === 'project' ? project.plitzi : undefined;
  // In a task's copy nobody serves, the copy served — as `page shot` serves it — never a second server beside one.
  const where = await originHere(project.root, plitzi, options.url);
  if ('problem' in where) {
    fail(where.problem);

    return;
  }

  const browser = await launchBrowser(project.root);
  if ('problem' in browser) {
    fail(browser.problem);

    return;
  }

  try {
    const page = await openProjectPage(browser, where.origin, {
      width: options.width ?? 1440,
      height: 900,
      reducedMotion: true,
      ...(options.scheme ? { scheme: options.scheme } : {}),
      ...(options.timezone ? { timezone: options.timezone } : {})
    });
    await openPage(page, `${where.origin}${route}`);
    const here = await measureOn(page, element);
    if ('problem' in here) {
      fail(here.problem);

      return;
    }

    const target = options.compare
      ? new URL(options.compare).pathname === '/'
        ? new URL(route, options.compare).href
        : options.compare
      : undefined;
    if (options.same && !target) {
      fail('--same holds properties to another page: give it --compare <that page>');

      return;
    }

    const other = target ? await otherPage(browser, target, options) : undefined;
    if (other && 'problem' in other) {
      fail(other.problem);

      return;
    }

    const there = other ? await measureOn(other, options.there ?? element) : undefined;
    if (there && 'problem' in there) {
      fail(`${there.problem}${options.there ? '' : ' — name its element there by a selector: --there "<selector>"'}`);

      return;
    }

    // `--same`: each property asked that differs fails the command — an acceptance's line, said by what differs.
    const unlike =
      there && options.same
        ? differences(here, there).differ.filter(each => options.same?.includes(each.property))
        : [];
    console.log(
      options.json
        ? JSON.stringify({
            here,
            ...(there ? { there, url: target, ...differences(here, there) } : {}),
            ...(options.same ? { same: options.same, unlike } : {})
          })
        : [
            measuredText(here, there, target),
            ...(options.same
              ? [
                  unlike.length > 0
                    ? chalk.red(
                        `✗ --same: ${unlike.map(each => `${each.property} ${each.here} → ${each.there}`).join('; ')}`
                      )
                    : chalk.green(`✓ --same: ${options.same.join(', ')} as the other page's`)
                ]
              : [])
          ].join('\n')
    );
    if (unlike.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
    where.stop?.();
  }
};
