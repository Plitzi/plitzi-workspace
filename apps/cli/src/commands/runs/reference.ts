import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { PAGE_TEXT_LIMIT, pageTexts } from '@plitzi/sdk-authoring';

import { act, runOf } from './shell';
import { launchBrowser, SCHEMES } from '../../browser';
import { requireLead } from '../../runs/leads';
import { keptName, REFERENCE_WIDTHS, referencePages } from '../../runs/reference';
import { RunRefusal } from '../../runs/refusal';
import { loadRun, logRun } from '../../runs/run';
import { pictureOf } from '../shot/capture';

import type { RunCommandOptions } from './shell';
import type { KeptPage } from '../../runs/reference';

export interface ReferenceOptions extends RunCommandOptions {
  /** The pages to keep, by path: the plan's inventory's when left out. */
  pages?: string[];
}

interface Kept {
  reference: string;
  kept: string[];
  failed: string[];
  dir: string;
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
      try {
        for (const page of options.pages ?? referencePages(loaded.plan)) {
          const url = new URL(page, reference).href;
          for (const width of REFERENCE_WIDTHS) {
            for (const scheme of SCHEMES) {
              const taken = await pictureOf(browser, url, {
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

              const name = keptName(new URL(url).pathname, width, scheme);
              const record: KeptPage = {
                url,
                width,
                scheme,
                at: ctx.now().toISOString(),
                texts: await taken.page.evaluate(pageTexts, PAGE_TEXT_LIMIT),
                unloaded: taken.unloaded
              };
              await writeFile(path.join(dir, `${name}.png`), taken.png);
              await writeFile(path.join(dir, `${name}.json`), JSON.stringify(record));
              await taken.page.close();
              kept.push(name);
            }
          }
        }
      } finally {
        await browser.close();
      }

      await logRun(ctx, loaded.paths, { action: 'reference', reference, kept: kept.length, failed: failed.length });

      return { reference, kept, failed, dir };
    },
    kept =>
      [
        `${kept.reference} kept as it is now: ${String(kept.kept.length)} pictures, each page at ${REFERENCE_WIDTHS.join(' and ')} px in both schemes — page shot --compare ${kept.reference} measures against them for the whole run (--live asks the site now); the run finishing removes them`,
        ...kept.failed.map(each => `  ✗ ${each}`)
      ].join('\n'),
    kept => (kept.failed.length > 0 ? 1 : 0)
  );
