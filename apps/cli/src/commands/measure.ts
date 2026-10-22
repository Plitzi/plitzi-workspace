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

/** The properties that differ — here, there — and those the two share: what is read first, and what is said in a line. */
export const differences = (
  here: Measured,
  there: Measured
): { differ: { property: string; here: string; there: string }[]; same: string[] } => ({
  differ: MEASURED.filter(property => here.styles[property] !== there.styles[property]).map(property => ({
    property,
    here: here.styles[property] ?? '',
    there: there.styles[property] ?? ''
  })),
  same: MEASURED.filter(property => here.styles[property] === there.styles[property])
});

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
