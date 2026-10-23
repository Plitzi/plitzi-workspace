import { comparePictures } from '@plitzi/sdk-authoring';

import { awaited, capture, targetOn } from './capture';
import { dataUrl } from '../../browser';

import type { BrowserPage } from '../../browser';
import type { ShotStep } from '../shotSteps';
import type { Framing, Moment, Taken } from './types';

/**
 * An interaction pictured step by step: clicks, waits, frames and shots, as `--steps` writes them.
 */

/** A PNG's width and height, read off its header: two pictures of different framing are not compared share by share. */
const sizeOf = (png: Uint8Array): string =>
  png.length < 24
    ? ''
    : `${String(new DataView(png.buffer, png.byteOffset).getUint32(16))}x${String(new DataView(png.buffer, png.byteOffset).getUint32(20))}`;

/**
 * Each element clicked in turn, and the page pictured after it — `frames` pictures `every` ms apart, or one. What a
 * click changed is measured against the picture before it: nothing at all is said, as a click that did nothing.
 */
export const clickThrough = async (
  taken: Taken,
  how: Framing,
  clicks: readonly string[],
  { frames, every }: { frames: number; every: number }
): Promise<
  { moments: Moment[]; clicked: { target: string; changed: number; opened?: true }[] } | { problem: string }
> => {
  const moments: Moment[] = [{ label: 'before', png: taken.png }];
  const clicked: { target: string; changed: number; opened?: true }[] = [];
  for (const target of clicks) {
    const read = await targetOn(taken.page, target);
    if ('problem' in read) {
      return read;
    }

    if (!read.found) {
      return { problem: `${target} is not on the page: --click takes an element's name, a tag or a selector.` };
    }

    const element = taken.page.locator(read.selector).filter({ visible: true }).first();

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
    // A clip the click opened is pictured alone after it, the page before it: no share of one picture to say — opened.
    clicked.push(
      sizeOf(before) === sizeOf(after)
        ? { target, changed: (await comparePictures(taken.page, dataUrl(before), dataUrl(after))).changed }
        : { target, changed: 100, opened: true }
    );
  }

  return { moments, clicked };
};

/** What a step is, as its label says it. */
const stepText = (step: ShotStep): string => {
  switch (step.kind) {
    case 'click':
    case 'hover':
    case 'scroll':
    case 'wait-for':
      return `${step.kind} ${step.target}`;
    case 'type':
      return `type ${step.target}`;
    case 'drag':
      return `drag ${step.target} ${String(step.dx)} ${String(step.dy)}`;
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

/** A step that acts on the page — every one but a picture: a press, a hover, a key, a wait. */
export type ActingStep = Exclude<ShotStep, { kind: 'shot' } | { kind: 'frames' }>;

/**
 * One step played on a page — what `--steps` does between its pictures, and `page play` on each page it plays on — or
 * what kept it from happening, said by its step.
 */
export const actStep = async (
  page: BrowserPage,
  step: ActingStep,
  index: number
): Promise<{ problem: string } | undefined> => {
  // The one shown: a page drawing a control per width hides the other — a field of a phone's drawer, the first in the
  // document, timed out at 1440 where the column's own was there to type into (lx-controls).
  const shown = (selector: string) => page.locator(selector).filter({ visible: true }).first();
  if (
    step.kind === 'click' ||
    step.kind === 'hover' ||
    step.kind === 'scroll' ||
    step.kind === 'type' ||
    step.kind === 'drag'
  ) {
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
        return undefined;
      }
    }

    if (step.kind === 'hover') {
      await shown(read.selector).hover({ timeout: 3000 });
      return undefined;
    }

    // Brought into view as a reader scrolling to it would: a hover was how design-1 reached the footer.
    if (step.kind === 'scroll') {
      await shown(read.selector).scrollIntoViewIfNeeded({ timeout: 3000 });
      return undefined;
    }

    // Pressed at its middle, moved in steps a hand would make, let go: a range's handle, a slider, a card dragged.
    if (step.kind === 'drag') {
      const box = await shown(read.selector).boundingBox({ timeout: 3000 });
      if (box === null) {
        return { problem: `Step ${String(index + 1)}: ${step.target} is not shown — nothing to drag` };
      }

      // A range is pressed at its thumb, where its value puts it — at its middle, the handle on top of it moved
      // instead (lx-controls' two-handle price range).
      const along = await shown(read.selector).evaluate(node => {
        if (!(node instanceof HTMLInputElement) || node.type !== 'range') {
          return 0.5;
        }

        const [min, max] = [Number(node.min || 0), Number(node.max || 100)];

        return max > min ? (Number(node.value) - min) / (max - min) : 0.5;
      }, undefined);
      // The thumb travels the track less its own width, about the input's height: at its end it sits inside it.
      const thumb = Math.min(box.height, box.width);
      const [x, y] = [box.x + thumb / 2 + (box.width - thumb) * along, box.y + box.height / 2];
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + step.dx, y + step.dy, { steps: 12 });
      await page.mouse.up();
      return undefined;
    }

    await shown(read.selector).click({ timeout: 3000 });
    // Typed into what has the focus: a click that left it on no field sent the text to the page's own shortcuts.
    if (step.kind === 'type') {
      const editable = await page.evaluate(() => {
        const focused = document.activeElement;

        return (
          focused instanceof HTMLElement && (focused.isContentEditable || focused.matches('input, textarea, select'))
        );
      }, undefined);
      if (!editable) {
        return {
          problem: `Step ${String(index + 1)}: clicking ${step.target} leaves no field focused, so the text would go to the page itself — name the field: type ".panel textarea" hola`
        };
      }

      // In place of what it held, as a person selecting it first: typed after it, a price field kept its old amount too
      // (lx-controls).
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.type(step.text);
    }
  } else if (step.kind === 'press') {
    await page.keyboard.press(step.key);
  } else if (step.kind === 'wait') {
    await page.waitForTimeout(step.ms);
  } else {
    await page.waitForSelector(awaited(step.target), { timeout: 10_000 });
  }

  return undefined;
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
      if (step.kind !== 'shot' && step.kind !== 'frames') {
        const problem = await actStep(page, step, index);
        if (problem) {
          return problem;
        }
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
