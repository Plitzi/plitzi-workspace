import { comparePictures } from '@plitzi/sdk-authoring';

import { capture, HIDDEN_FOR_SHOT, hidePinned, showPinned, targetOn } from './capture';
import { cropped } from './crop';
import { dataUrl } from '../../../browser';
import { momentChanges, pageMomentInPage } from '../check/moments';

import type { ScreenBox } from './crop';
import type { Framing, Moment } from './types';
import type { BrowserPage } from '../../../browser';
import type { PageMoment } from '../check/types';

/**
 * The pictures of a `--steps` script, taken as the steps reach them and read after: a picture takes the moment and
 * nothing more — the screen once, and where the part pictured is on it — and what changed between them is worked out
 * once the steps are played. A run's designer wrote shots 300 ms apart around a reticle over a globe and got them 8 s
 * apart: each waited for the reticle's box to be still (it followed the globe turning), and took the screen twice more to
 * compare it, every one seconds at `--scale 3`.
 */

/** One picture of a script, as it was taken. */
export interface ScriptShot {
  label: string;
  /** The screen, or the page whole when the page is what is pictured. */
  png: Uint8Array;
  /** Where the part pictured was on the screen: cut out of it after. */
  box?: ScreenBox;
  /** The screen's width in CSS pixels, which `box` is said in. */
  width?: number;
  /** What the page showed, when a part is pictured: what changed outside it is read from it. */
  moment?: PageMoment;
}

/** The selector of the part pictured, when it is on the page and shown now. */
const partShown = async (page: BrowserPage, how: Framing): Promise<string | undefined> => {
  if (how.kind === 'element') {
    return how.selector;
  }

  if (how.kind !== 'element-later') {
    return undefined;
  }

  const read = await targetOn(page, how.target);

  return !('problem' in read) && read.found && (await page.locator(read.selector).first().isVisible())
    ? read.selector
    : undefined;
};

/** The page now, as a script's picture: the screen and the part's place on it — or the page as `capture` takes it. */
export const shotNow = async (page: BrowserPage, how: Framing, label: string): Promise<ScriptShot> => {
  if (how.kind !== 'element' && how.kind !== 'element-later') {
    return { label, png: await capture(page, how) };
  }

  const width = await page.evaluate(() => window.innerWidth, undefined);
  const selector = await partShown(page, how);
  if (selector === undefined) {
    const target = how.kind === 'element-later' ? how.target : '';

    return {
      label: `${label} — ${target} not shown, the screen pictured`,
      png: await page.screenshot({ fullPage: false }),
      width,
      moment: await page.evaluate(pageMomentInPage, undefined)
    };
  }

  const element = page.locator(selector).first();
  await element.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => undefined);
  await element.evaluate(hidePinned, HIDDEN_FOR_SHOT);
  try {
    const box = await element.boundingBox();
    const png = await page.screenshot({ fullPage: false });

    return {
      label,
      png,
      width,
      ...(box ? { box } : {}),
      moment: await page.evaluate(pageMomentInPage, undefined)
    };
  } finally {
    await page.evaluate(showPinned, HIDDEN_FOR_SHOT);
  }
};

/** A script's picture as it is shown: its part cut out of the screen, or the screen. */
const pictureOf = (shot: ScriptShot): Uint8Array =>
  shot.box && shot.width !== undefined ? cropped(shot.png, shot.box, shot.width) : shot.png;

/**
 * Each picture of a script set beside the one before it, the first beside `first` (the page before the steps): how much
 * of it changed, and — where its part did not — what changed on the screen around it, a picker a click opened beside
 * the part pictured.
 */
export const shotsCompared = async (
  page: BrowserPage,
  first: { png: Uint8Array; screen?: ScriptShot },
  shots: readonly ScriptShot[]
): Promise<{ moments: Moment[]; changes: { label: string; changed: number; outside?: string[] }[] }> => {
  const moments: Moment[] = [{ label: 'before', png: first.png }];
  const changes: { label: string; changed: number; outside?: string[] }[] = [];
  let before = { png: first.png, screen: first.screen && screenOf(first.screen) };
  for (const shot of shots) {
    const png = pictureOf(shot);
    moments.push({ label: shot.label, png });
    const { changed } = await comparePictures(page, dataUrl(before.png), dataUrl(png));
    const screen = screenOf(shot);
    const outside = changed === 0 && before.screen && screen ? await screenChanges(page, before.screen, screen) : [];
    changes.push({ label: shot.label, changed, ...(outside.length > 0 ? { outside } : {}) });
    before = { png, screen };
  }

  return { moments, changes };
};

/** The screen — a picture of a part is cut from it, or set beside it — and what the page showed. */
interface Screen {
  png: Uint8Array;
  moment: PageMoment;
}

const screenOfPage = async (page: BrowserPage): Promise<Screen> => ({
  moment: await page.evaluate(pageMomentInPage, undefined),
  png: await page.screenshot({ fullPage: false })
});

/** The screen now, when a part is what is pictured: what changed around it is read from it. */
export const screenNow = async (page: BrowserPage, how: Framing): Promise<Screen | undefined> =>
  how.kind === 'element' || how.kind === 'element-later' ? screenOfPage(page) : undefined;

/**
 * What changed on the page since `before` while a clipped picture stayed the same — the screen, and what it shows: a
 * click opened a plugin's picker beside the part pictured, and its shot said "nothing changed — the click did nothing to
 * see" (a run's tester and designer). Whatever draws it — a marked element or a plugin's own — the screen says it.
 */
export const outsideClip = async (page: BrowserPage, before: Screen | undefined): Promise<string[]> => {
  return before ? screenChanges(page, before, await screenOfPage(page)) : [];
};

const screenOf = (shot: ScriptShot): Screen | undefined =>
  shot.moment === undefined ? undefined : { png: shot.png, moment: shot.moment };

const screenChanges = async (page: BrowserPage, before: Screen, now: Screen): Promise<string[]> => {
  const { changed } = await comparePictures(page, dataUrl(before.png), dataUrl(now.png));

  return [
    ...(changed > 0 ? [`${String(changed)}% of the screen`] : []),
    ...momentChanges(before.moment, now.moment, { before: undefined, after: undefined })
  ];
};
