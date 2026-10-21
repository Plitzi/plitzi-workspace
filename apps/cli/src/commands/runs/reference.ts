import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { PAGE_DECORATION_LIMIT, PAGE_TEXT_LIMIT, pageDecorations, pageTexts } from '@plitzi/sdk-authoring';

import { act, runOf } from './shell';
import { launchBrowser, SCHEMES } from '../../browser';
import { requireLead } from '../../runs/leads';
import { keptName, REFERENCE_WIDTHS, referencePages, unnamedSections } from '../../runs/reference';
import { RunRefusal } from '../../runs/refusal';
import { loadRun, logRun } from '../../runs/run';
import { pictureOf } from '../shot/capture';

import type { RunCommandOptions } from './shell';
import type { Browser } from '../../browser';
import type { KeptPage } from '../../runs/reference';
import type { Taken, View } from '../shot/types';

/** How long to wait between the pages of the site kept, and before each try again of one it turned away. */
const BETWEEN_PAGES_MS = 1500;
const RETRY_AFTER_MS = [10_000, 30_000];

/** The status the page's own document came with: what tells a page from an error a site answered in its place. */
const documentStatus = (): number => {
  const navigation = performance.getEntriesByType('navigation').at(0);
  const status: unknown = navigation ? Reflect.get(navigation, 'responseStatus') : undefined;

  return typeof status === 'number' ? status : 0;
};

/**
 * A page of the reference pictured once its site answers it — never its error page kept as the page: la-velada's
 * original answered its fighters' list with "You are being rate limited". A site that says it is busy (429, 503) is
 * asked again, later; any other error is said.
 */
const keptOnce = async (
  browser: Browser,
  url: string,
  view: View
): Promise<(Taken & { notFound?: true }) | { problem: string }> => {
  for (let attempt = 0; ; attempt += 1) {
    // A picture the browser gave up on (a font that never loaded, a page still busy) is this page's failure, asked
    // once more — never the end of every page after it: la-velada's original timed one out, and the command crashed.
    const taken = await pictureOf(browser, url, view).catch(
      (error: unknown) =>
        ({
          problem: `the picture was not taken: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`
        }) as const
    );
    if ('problem' in taken) {
      if (attempt === 0 && taken.problem.startsWith('the picture was not taken')) {
        continue;
      }

      return taken;
    }

    const status = await taken.page.evaluate(documentStatus, undefined);
    if (status < 400) {
      return taken;
    }

    // An address nothing answers is a page of its own — the site's 404, which a copy makes too (la-velada's "Elige a
    // tu boxeador"): kept, and said so, never refused as an error page.
    if (status === 404) {
      return { ...taken, notFound: true };
    }

    await taken.page.close();
    const wait = RETRY_AFTER_MS.at(attempt);
    if ((status !== 429 && status !== 503) || wait === undefined) {
      return {
        problem: `the site answered ${String(status)}${status === 429 ? ' (asked too often) — keep it again later' : ''}`
      };
    }

    await new Promise(resolve => setTimeout(resolve, wait));
  }
};

export interface ReferenceOptions extends RunCommandOptions {
  /** The pages to keep, by path: the plan's inventory's when left out. */
  pages?: string[];
}

interface Kept {
  reference: string;
  kept: string[];
  failed: string[];
  dir: string;
  /** Each page's headings no piece of the inventory names: what the plan may have missed. */
  unnamed: { page: string; headings: string[] }[];
  /** Pages the site answered 404, kept as its page for an address nothing answers. */
  notFound: string[];
}

/**
 * `plitzi run reference`: the plan's `reference` site kept as it is now, each page at the widths a review looks at and
 * in both schemes — its picture and its words measured — for `page shot --compare` to measure against while the run
 * works. Kept in the run's folder, so the run finishing removes it.
 */
export const runReference = (options: ReferenceOptions): Promise<void> =>
  act(
    options,
    async (ctx): Promise<Kept> => {
      const loaded = await loadRun(ctx, await runOf(ctx, options));
      await requireLead(ctx, loaded, 'keep the reference');
      const { reference } = loaded.plan;
      if (reference === undefined) {
        throw new RunRefusal(
          'invalid',
          'The plan names no reference: "reference": "https://www.example.com" in it says the site the run copies — then run this again'
        );
      }

      const browser = await launchBrowser(ctx.root);
      if ('problem' in browser) {
        throw new RunRefusal('invalid', browser.problem);
      }

      const dir = loaded.paths.reference;
      await mkdir(dir, { recursive: true });
      const kept: string[] = [];
      const failed: string[] = [];
      const notFound: string[] = [];
      // Each page once, as a desktop reader sees it: what its sections are compared with the inventory by.
      const read: KeptPage[] = [];
      try {
        for (const [index, page] of (options.pages ?? referencePages(loaded.plan)).entries()) {
          const url = new URL(page, reference).href;
          // A moment between pages: a site that limits how often it is asked answered the second one with its limit.
          if (index > 0) {
            await new Promise(resolve => setTimeout(resolve, BETWEEN_PAGES_MS));
          }

          for (const width of REFERENCE_WIDTHS) {
            for (const scheme of SCHEMES) {
              const taken = await keptOnce(browser, url, {
                width,
                height: 800,
                scheme,
                reducedMotion: false,
                still: true
              });
              if ('problem' in taken) {
                failed.push(`${page} at ${String(width)} ${scheme}: ${taken.problem}`);
                continue;
              }

              if (taken.notFound && width === REFERENCE_WIDTHS[0] && scheme === 'light') {
                notFound.push(page);
              }

              const name = keptName(new URL(url).pathname, width, scheme);
              const record: KeptPage = {
                url,
                width,
                scheme,
                at: ctx.now().toISOString(),
                texts: await taken.page.evaluate(pageTexts, PAGE_TEXT_LIMIT),
                unloaded: taken.unloaded,
                decorations: await taken.page.evaluate(pageDecorations, PAGE_DECORATION_LIMIT)
              };
              await writeFile(path.join(dir, `${name}.png`), taken.png);
              await writeFile(path.join(dir, `${name}.json`), JSON.stringify(record));
              await taken.page.close();
              kept.push(name);
              if (width === REFERENCE_WIDTHS[0] && scheme === 'light') {
                read.push(record);
              }
            }
          }
        }
      } finally {
        await browser.close();
      }

      const unnamed = loaded.plan.inventory ? unnamedSections(read, loaded.plan.inventory) : [];
      await logRun(ctx, loaded.paths, {
        action: 'reference',
        reference,
        kept: kept.length,
        failed: failed.length,
        unnamed: unnamed.reduce((sum, page) => sum + page.headings.length, 0)
      });

      return { reference, kept, failed, dir, unnamed, notFound };
    },
    kept =>
      [
        `${kept.reference} kept as it is now: ${String(kept.kept.length)} pictures, each page at ${REFERENCE_WIDTHS.join(' and ')} px in both schemes — page shot --compare ${kept.reference} measures against them for the whole run (--live asks the site now); the run finishing removes them`,
        ...kept.failed.map(each => `  ✗ ${each}`),
        ...kept.notFound.map(
          each => `  · ${each}: the site answered 404 — kept as its page for an address nothing answers`
        ),
        ...(kept.unnamed.length > 0
          ? [
              'Sections of the reference no piece of the inventory names — a piece each, covered or left out with its reason (plitzi run amend), or a stage of its own:',
              ...kept.unnamed.map(page => `  ${page.page}: ${page.headings.map(heading => `"${heading}"`).join(', ')}`)
            ]
          : [])
      ].join('\n'),
    kept => (kept.failed.length > 0 ? 1 : 0)
  );
