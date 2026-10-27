import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  comparePictures,
  PAGE_DECORATION_LIMIT,
  PAGE_TEXT_LIMIT,
  pageDecorations,
  pageTexts
} from '@plitzi/sdk-authoring';

import { dataUrl, launchBrowser, SCHEMES } from '../../../browser';
import { requireLead } from '../../../runs/agents/leads';
import { RunRefusal } from '../../../runs/core/refusal';
import { keptName, REFERENCE_WIDTHS, referencePages, unnamedSections } from '../../../runs/plan/reference';
import { loadRun, logRun } from '../../../runs/run';
import { projectSpace } from '../../page/check/space';
import { pictureAnswered } from '../../page/shot/remote';
import { act, runOf } from '../shell';

import type { KeptPage } from '../../../runs/plan/reference';
import type { RunCommandOptions } from '../shell';

/** How long to wait between the pages of the site kept, and before each try again of one it turned away. */
const BETWEEN_PAGES_MS = 1500;
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
  /** The site paints the same in both schemes: each picture taken once, kept under both. */
  oneScheme?: true;
  /** The schemes kept: the space's declared ones. */
  schemes: ('light' | 'dark')[];
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
      await requireLead(ctx, 'keep the reference');
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
      // A site that paints the same in both schemes has one: once its first page says so, each picture is taken once and
      // kept under both names — a run's original has no light scheme, and a quarter of 111 s went to it.
      let oneScheme: boolean | undefined;
      const pages = options.pages ?? referencePages(loaded.plan);
      // The schemes the space declares, as `task look` pictures it: a dark picture of the original is compared with no page
      // of a light space (a run kept 28 pictures, 14 of them never read).
      const space = await projectSpace(ctx.root);
      const declared = 'problem' in space ? [] : space.schemes;
      const schemes = SCHEMES.filter(scheme => declared.length === 0 || declared.includes(scheme));
      const total = pages.length * REFERENCE_WIDTHS.length * schemes.length;
      try {
        for (const [index, page] of pages.entries()) {
          const url = new URL(page, reference).href;
          // A moment between pages: a site that limits how often it is asked answered the second one with its limit.
          if (index > 0) {
            await new Promise(resolve => setTimeout(resolve, BETWEEN_PAGES_MS));
          }

          for (const width of REFERENCE_WIDTHS) {
            let first: { png: Uint8Array; record: KeptPage } | undefined;
            for (const scheme of schemes) {
              const name = keptName(new URL(url).pathname, width, scheme);
              if (first && oneScheme === true) {
                await writeFile(path.join(dir, `${name}.png`), first.png);
                await writeFile(path.join(dir, `${name}.json`), JSON.stringify({ ...first.record, scheme }));
                kept.push(name);
                ctx.say?.(
                  `kept ${page} at ${String(width)} ${scheme} — the same as ${first.record.scheme} (${String(kept.length)}/${String(total)})`
                );
                continue;
              }

              const taken = await pictureAnswered(browser, url, {
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

              if (taken.notFound && width === REFERENCE_WIDTHS[0] && scheme === schemes[0]) {
                notFound.push(page);
              }

              const record: KeptPage = {
                url,
                width,
                scheme,
                at: ctx.now().toISOString(),
                texts: await taken.page.evaluate(pageTexts, PAGE_TEXT_LIMIT),
                unloaded: taken.unloaded,
                decorations: await taken.page.evaluate(pageDecorations, PAGE_DECORATION_LIMIT)
              };
              // The first page's two schemes, set side by side: alike, the site has one, and the rest is taken once.
              if (first && oneScheme === undefined) {
                oneScheme = (await comparePictures(taken.page, dataUrl(first.png), dataUrl(taken.png))).changed < 0.5;
              }

              await writeFile(path.join(dir, `${name}.png`), taken.png);
              await writeFile(path.join(dir, `${name}.json`), JSON.stringify(record));
              await taken.page.close();
              kept.push(name);
              first ??= { png: taken.png, record };
              ctx.say?.(`kept ${page} at ${String(width)} ${scheme} (${String(kept.length)}/${String(total)})`);
              if (width === REFERENCE_WIDTHS[0] && scheme === schemes[0]) {
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

      return {
        reference,
        kept,
        failed,
        dir,
        unnamed,
        notFound,
        schemes,
        ...(oneScheme === true ? { oneScheme } : {})
      };
    },
    kept =>
      [
        `${kept.reference} kept as it is now: ${String(kept.kept.length)} pictures, each page at ${REFERENCE_WIDTHS.join(' and ')} px in ${kept.schemes.length === 1 ? `its ${kept.schemes[0]} scheme, the one the space declares` : 'both schemes'}${kept.oneScheme ? ' — it paints one scheme alike in both, so each was taken once' : ''} — page shot --compare ${kept.reference} measures against them for the whole run (--live asks the site now); the run finishing removes them`,
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
