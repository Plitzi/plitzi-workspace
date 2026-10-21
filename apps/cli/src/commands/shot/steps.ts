import { comparePictures } from '@plitzi/sdk-authoring';

import { awaited, capture, targetOn } from './capture';
import { dataUrl } from '../../browser';

import type { ShotStep } from '../shotSteps';
import type { Framing, Moment, Taken } from './types';

/**
 * An interaction pictured step by step: clicks, waits, frames and shots, as `--steps` writes them.
 */

/**
 * Each element clicked in turn, and the page pictured after it — `frames` pictures `every` ms apart, or one. What a
 * click changed is measured against the picture before it: nothing at all is said, as a click that did nothing.
 */
export const clickThrough = async (
  taken: Taken,
  how: Framing,
  clicks: readonly string[],
  { frames, every }: { frames: number; every: number }
): Promise<{ moments: Moment[]; clicked: { target: string; changed: number }[] } | { problem: string }> => {
  const moments: Moment[] = [{ label: 'before', png: taken.png }];
  const clicked: { target: string; changed: number }[] = [];
  for (const target of clicks) {
    const read = await targetOn(taken.page, target);
    if ('problem' in read) {
      return read;
    }

    if (!read.found) {
      return { problem: `${target} is not on the page: --click takes an element's name, a tag or a selector.` };
    }

    const element = taken.page.locator(read.selector).first();

    const before = moments[moments.length - 1].png;
    try {
      await element.click({ timeout: 3000 });
    } catch (error) {
      return {
        problem: `${target} could not be clicked — hidden, covered or disabled: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`
      };
    }

    for (let frame = 1; frame <= Math.max(1, frames); frame += 1) {
      await taken.page.waitForTimeout(every);
      moments.push({ label: `${target} +${String(frame * every)} ms`, png: await capture(taken.page, how) });
    }

    const after = moments[moments.length - 1].png;
    clicked.push({ target, changed: (await comparePictures(taken.page, dataUrl(before), dataUrl(after))).changed });
  }

  return { moments, clicked };
};

/** What a step is, as its label says it. */
const stepText = (step: ShotStep): string => {
  switch (step.kind) {
    case 'click':
    case 'hover':
    case 'wait-for':
      return `${step.kind} ${step.target}`;
    case 'type':
      return `type ${step.target}`;
    case 'press':
      return `press ${step.key}`;
    case 'wait':
      return `wait ${String(step.ms)} ms`;
    case 'shot':
      return step.label ?? 'shot';
    case 'frames':
      return `frames ${String(step.count)}`;
  }
};

/**
 * A `--steps` script played on the page: what each step does, and every picture the script asks for — each labelled with
 * its step and the time since the first, and measured against the one before it, so "nothing changed" is said.
 */
export const playSteps = async (
  taken: Taken,
  how: Framing,
  steps: readonly ShotStep[]
): Promise<{ moments: Moment[]; changes: { label: string; changed: number }[] } | { problem: string }> => {
  const { page } = taken;
  const started = Date.now();
  const moments: Moment[] = [{ label: 'before', png: taken.png }];
  const changes: { label: string; changed: number }[] = [];
  const picture = async (label: string): Promise<void> => {
    const before = moments[moments.length - 1].png;
    const png = await capture(page, how);
    const at = `${label} · +${String(Date.now() - started)} ms`;
    moments.push({ label: at, png });
    changes.push({ label: at, changed: (await comparePictures(page, dataUrl(before), dataUrl(png))).changed });
  };

  for (const [index, step] of steps.entries()) {
    try {
      if (step.kind === 'click' || step.kind === 'hover' || step.kind === 'type') {
        const read = await targetOn(page, step.target);
        if ('problem' in read || !read.found) {
          return {
            problem: `Step ${String(index + 1)}: ${'problem' in read ? read.problem : `${step.target} is not on the page — its name, a tag or a selector; one with spaces in quotes: type ".panel textarea" hola`}.`
          };
        }

        // A select is chosen, not typed into — the element named, or the one select inside it (a `formControl` wraps it).
        if (step.kind === 'type') {
          const select = await page.evaluate((selector: string) => {
            const node = document.querySelector(selector);

            return node === null
              ? undefined
              : node.matches('select')
                ? selector
                : node.querySelectorAll('select').length === 1
                  ? `${selector} select`
                  : undefined;
          }, read.selector);
          if (select !== undefined) {
            await page.locator(select).first().selectOption(step.text, { timeout: 3000 });
            continue;
          }
        }

        if (step.kind === 'hover') {
          await page.locator(read.selector).first().hover({ timeout: 3000 });
          continue;
        }

        await page.locator(read.selector).first().click({ timeout: 3000 });
        // Typed into what has the focus: a click that left it on no field sent the text to the page's own shortcuts.
        if (step.kind === 'type') {
          const editable = await page.evaluate(() => {
            const focused = document.activeElement;

            return (
              focused instanceof HTMLElement &&
              (focused.isContentEditable || focused.matches('input, textarea, select'))
            );
          }, undefined);
          if (!editable) {
            return {
              problem: `Step ${String(index + 1)}: clicking ${step.target} leaves no field focused, so the text would go to the page itself — name the field: type ".panel textarea" hola`
            };
          }

          await page.keyboard.type(step.text);
        }
      } else if (step.kind === 'press') {
        await page.keyboard.press(step.key);
      } else if (step.kind === 'wait') {
        await page.waitForTimeout(step.ms);
      } else if (step.kind === 'wait-for') {
        await page.waitForSelector(awaited(step.target), { timeout: 10_000 });
      } else if (step.kind === 'shot') {
        await picture(step.label ?? `step ${String(index + 1)}`);
      } else {
        for (let frame = 1; frame <= step.count; frame += 1) {
          if (frame > 1) {
            await page.waitForTimeout(step.every);
          }

          await picture(`frame ${String(frame)}/${String(step.count)}`);
        }
      }
    } catch (error) {
      return {
        problem: `Step ${String(index + 1)} (${stepText(step)}) did not happen: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`
      };
    }
  }

  return { moments, changes };
};
