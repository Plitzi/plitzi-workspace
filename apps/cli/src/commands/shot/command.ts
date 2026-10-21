import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';

import { comparePictures, pageRegions } from '@plitzi/sdk-authoring';

import { dataUrl, launchBrowser, projectOrigin } from '../../browser';
import { copyOf, runPaths } from '../../runs/paths';
import { PROJECT_TMP } from '../../scaffold/paths';
import { checkAccount, CHECK_PASSWORD_ENV } from '../check';
import { projectHere } from '../existingProject';
import { parseSteps } from '../shotSteps';
import { fail } from '../terminal';
import { capture, pictureOf } from './capture';
import { compareText, compareWith, contactSheet, framesMoved, regionsText } from './compare';
import { clickThrough, playSteps } from './steps';
import { MOVING_PERCENT } from './types';

import type { Moment, ShotOptions, ShotReport, View } from './types';
import type { PictureDiff, PictureRegion } from '@plitzi/sdk-authoring';

/**
 * `plitzi page shot`: a picture of each path at each width.
 */

/**
 * `plitzi page shot --width 1440,390`: a picture at each width, one after another — each named by its width, `--out`
 * too (`home.png` becomes `home-1440.png`, `home-390.png`) so one never writes over another.
 */
export const shotEach = async (
  route: string | undefined,
  options: Omit<ShotOptions, 'width'> & { width: number[] }
): Promise<void> => {
  const { width: all, ...rest } = options;
  for (const each of all) {
    const out = rest.out && all.length > 1 ? rest.out.replace(/(\.png)?$/, `-${String(each)}.png`) : rest.out;
    await shot(route, { ...rest, width: each, ...(out ? { out } : {}) });
    if (process.exitCode !== undefined && process.exitCode !== 0) {
      return;
    }
  }
};

export const shot = async (route: string | undefined, options: ShotOptions): Promise<void> => {
  const project = await projectHere('whose page to picture');
  if (!project) {
    return;
  }

  // Another site, named whole — the original a copy is made after: pictured as any visitor sees it, no server of ours.
  const external = route !== undefined && /^https?:\/\//.test(route);
  if (external && (options.as !== undefined || options.compare)) {
    fail(
      `${route} is another site: pictured as anyone sees it — leave out --as and --compare (compare from your page).`
    );

    return;
  }

  const where = external
    ? { origin: undefined }
    : await projectOrigin(project.root, project.plitzi?.kind === 'project' ? project.plitzi : undefined, options.url);
  if ('problem' in where) {
    fail(where.problem);

    return;
  }

  // Signed in only when asked: a page pictured as nobody is what a visitor who has not signed in sees.
  const account = options.as === undefined ? undefined : await checkAccount(project.root, options.as);
  if (account && 'problem' in account) {
    fail(`--as ${account.problem}.`);

    return;
  }

  const browser = await launchBrowser(project.root);
  if ('problem' in browser) {
    fail(browser.problem);

    return;
  }

  if (options.fill && options.steps !== undefined) {
    await browser.close();
    fail('`--steps` is the whole interaction: write the fields in it (type <element> <text>) rather than --fill.');

    return;
  }

  const split = options.fill?.find(field => /[;\n]/.test(field.value));
  if (split) {
    await browser.close();
    fail(
      `--fill ${split.element}: a value with ";" or a new line is written in --steps instead (type <element> <text>).`
    );

    return;
  }

  // `--fill` is said as page check says it, and played as the steps it is: each field typed into, then each click —
  // or, with none, a picture of what the typing changed.
  const filled = options.fill?.map(field => `type ${JSON.stringify(field.element)} ${field.value}`);
  const asSteps = filled
    ? [
        'shot before',
        ...filled,
        ...((options.click ?? []).length > 0
          ? (options.click ?? []).flatMap(click => [
              `click ${JSON.stringify(click)}`,
              'wait 600',
              `shot after ${click}`
            ])
          : ['wait 600', 'shot filled'])
      ].join('; ')
    : undefined;
  const clicks = asSteps === undefined ? (options.click ?? []) : [];
  const script =
    asSteps ??
    (options.steps?.startsWith('@')
      ? await readFile(path.resolve(options.steps.slice(1)), 'utf-8').catch(() => undefined)
      : options.steps);
  if (options.steps !== undefined && script === undefined) {
    await browser.close();
    fail(`${options.steps.slice(1)} cannot be read: --steps @<file> names a file of steps.`);

    return;
  }

  const steps = script === undefined ? undefined : parseSteps(script, options.every ?? 500);
  if (steps && 'problem' in steps) {
    await browser.close();
    fail(`--steps: ${steps.problem}.`);

    return;
  }

  if (steps && (clicks.length > 0 || options.compare || (options.frames ?? 0) > 1)) {
    await browser.close();
    fail('`--steps` is the whole interaction — its own clicks and frames: leave out --click, --frames and --compare.');

    return;
  }
  if (options.compare && clicks.length > 0) {
    await browser.close();
    fail(
      '`--compare` sets the page beside another site as it loads: leave out --click, or picture the click on its own.'
    );

    return;
  }

  if (options.sheet && clicks.length === 0 && (options.frames ?? 0) <= 1 && options.steps === undefined) {
    await browser.close();
    fail(
      '`--sheet` lays out the pictures a --click, --frames or --steps takes: with none of them, there is one picture and no sheet.'
    );

    return;
  }

  const fromLoad = options.from === 'load';
  if (fromLoad && ((options.frames ?? 0) <= 1 || clicks.length > 0 || options.compare)) {
    await browser.close();
    fail(
      '`--from load` starts --frames as the HTML arrives, for what plays while the page loads: give it --frames, and leave out --click and --compare.'
    );

    return;
  }

  if (fromLoad && !options.clip && !options.scrollTo && !options.viewport) {
    await browser.close();
    fail(
      '`--from load` pictures the screen as the page arrives, never the whole page — unrolling it waits for it to settle: add --viewport or --clip.'
    );

    return;
  }

  if (options.compare && (options.scrollTo || options.viewport)) {
    await browser.close();
    fail(
      '`--compare` sets the whole page beside the other site, section by section: leave out --scroll-to and --viewport (--clip <section> keeps one section of the report).'
    );

    return;
  }

  // Beside another site, a clip is the section of the report kept: both pages are compared whole, section by section —
  // the other site has none of this page's names to be clipped to.
  const section = options.compare ? options.clip : undefined;
  const clip = options.compare ? undefined : options.clip;

  try {
    const pathname = route ?? '/';
    const view: View = {
      width: options.width ?? 1280,
      height: options.height ?? 800,
      ...(options.scheme ? { scheme: options.scheme } : {}),
      reducedMotion: options.reducedMotion === true,
      ...(options.waitFor ? { waitFor: options.waitFor } : {}),
      ...(clip ? { clip } : {}),
      ...(options.scrollTo ? { scrollTo: options.scrollTo } : {}),
      ...(options.viewport ? { viewport: true } : {}),
      ...(options.presence ? { presence: true } : {}),
      ...(account ? { account } : {}),
      ...(fromLoad ? { fromLoad } : {}),
      // Frames are about what moves, so they are taken as the page plays.
      still: !clip && !options.scrollTo && !options.viewport && (options.frames ?? 0) <= 1 && clicks.length === 0
    };
    const taken =
      where.origin === undefined
        ? await pictureOf(browser, pathname, view)
        : await pictureOf(browser, `${where.origin}${pathname}`, view, where.origin);
    if ('problem' in taken) {
      fail(taken.problem);

      return;
    }

    const { how } = taken;

    // Named by the theme the page was painted in, which is the space's default when none was asked for.
    const name = pathname === '/' ? 'home' : pathname.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
    // Taken in a task's copy, a picture is the run's, by task: where the lead reads what the agent points at, outside
    // the copy (rebuilt when the task is taken again) and gone with the run — never left in the project's tmp/.
    const copy = copyOf(project.root);
    const file = `${name}-${String(view.width)}-${taken.scheme}.png`;
    const out = options.out
      ? path.resolve(project.root, options.out)
      : copy
        ? path.join(runPaths(copy.root, copy.run).shots, copy.task, file)
        : path.resolve(project.root, `${PROJECT_TMP}/shots/${file}`);
    const base = out.replace(/\.png$/, '');
    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(out, taken.png);
    // The sections a diff is told by are the page's: a picture of part of it is one region, named for what it shows.
    const regions: PictureRegion[] = how.kind === 'page' ? await taken.page.evaluate(pageRegions, undefined) : [];
    const report: ShotReport = {
      path: pathname,
      width: view.width,
      scheme: taken.scheme,
      out,
      ...(taken.settled > 0 ? { settled: taken.settled } : {}),
      ...(taken.unloaded > 0 ? { unloaded: taken.unloaded } : {}),
      ...(taken.sentTo ? { sentTo: taken.sentTo } : {})
    };

    if (options.compare) {
      const other = new URL(options.compare);
      const target = other.pathname === '/' ? new URL(pathname, other).href : other.href;
      const compared = await compareWith(browser, taken, target, view, regions, base);
      if ('problem' in compared) {
        fail(compared.problem);

        return;
      }

      if (section === undefined) {
        report.compare = compared;
      } else {
        const kept = compared.regions.filter(
          each => each.name === section || each.name.endsWith(`#${section}`) || each.element === section
        );
        if (kept.length === 0) {
          fail(
            `--clip ${section} is none of the sections compared: ${compared.regions.map(each => (each.element ? `${each.name} (${each.element})` : each.name)).join(', ') || 'the page has no named section'} — name one of them, by its id or its element's`
          );

          return;
        }

        report.compare = { ...compared, regions: kept, section };
      }
    }

    const frames = options.frames ?? 0;
    const every = options.every ?? 500;
    let moments: Moment[] = [];
    if (steps) {
      const played = await playSteps(taken, how, steps);
      if ('problem' in played) {
        fail(played.problem);

        return;
      }

      moments = played.moments;
      report.steps = played.changes;
    } else if (clicks.length > 0) {
      const played = await clickThrough(taken, how, clicks, { frames, every });
      if ('problem' in played) {
        fail(played.problem);

        return;
      }

      moments = played.moments;
      report.clicked = played.clicked;
    } else if (frames > 1) {
      const pictures = [taken.png];
      for (let frame = 1; frame < frames; frame += 1) {
        await taken.page.waitForTimeout(every);
        pictures.push(await capture(taken.page, how));
      }

      moments = pictures.map((png, frame) => ({
        label: frame === 0 ? (fromLoad ? 'HTML in' : 'before') : `+${String(frame * every)} ms`,
        png
      }));

      const diffs: PictureDiff[] = [];
      for (let frame = 1; frame < pictures.length; frame += 1) {
        diffs.push(
          await comparePictures(taken.page, dataUrl(pictures[frame - 1]), dataUrl(pictures[frame]), { regions })
        );
      }

      const whole = how.kind === 'element' ? (clip ?? 'element') : 'viewport';
      const moved =
        how.kind === 'page'
          ? framesMoved(diffs)
          : [{ name: whole, changed: Math.max(0, ...diffs.map(diff => diff.changed)) }];
      report.frames = {
        count: frames,
        every,
        moving: moved.filter(region => region.changed > MOVING_PERCENT),
        still: moved.filter(region => region.changed <= MOVING_PERCENT).map(region => region.name)
      };
    }

    // The pictures taken after the first: on one sheet, or each in a file of its own beside it.
    if (moments.length > 1 && options.sheet) {
      const sheet = await taken.page.evaluate(
        contactSheet,
        moments.map(moment => ({ label: moment.label, src: dataUrl(moment.png) }))
      );
      report.sheet = `${base}-sheet.png`;
      await writeFile(report.sheet, Buffer.from(sheet.replace(/^data:image\/png;base64,/, ''), 'base64'));
    } else if (moments.length > 1 && (clicks.length > 0 || steps)) {
      report.pictures = [];
      for (const [index, moment] of moments.slice(1).entries()) {
        const file = `${base}-${String(index + 1)}.png`;
        await writeFile(file, moment.png);
        report.pictures.push({ label: moment.label, out: file });
      }
    }

    if (options.json) {
      console.log(JSON.stringify(report));

      return;
    }

    console.log(out);
    if (report.sentTo) {
      console.log(
        chalk.yellow(
          account
            ? `${pathname} sent the browser to ${report.sentTo}, signed in as ${account.username}: the picture is of ${report.sentTo} — that account may not see ${pathname}`
            : `${pathname} sent the browser to ${report.sentTo}: the picture is of ${report.sentTo}. A page for signed-in visitors? \`--as <username>\` signs in first, the password in ${CHECK_PASSWORD_ENV} in .env`
        )
      );
    }

    if (report.settled) {
      console.log(
        chalk.dim(
          `${String(report.settled)} arrival${report.settled === 1 ? '' : 's'} waiting for the scroll shown as they end — --scroll-to <id> --viewport --frames 4 shows one arriving`
        )
      );
    }

    if (report.unloaded) {
      console.log(chalk.yellow(`${String(report.unloaded)} picture(s) had not loaded when the page was taken`));
    }

    if (report.compare) {
      console.log(compareText(report.compare).join('\n'));
    }

    for (const { label, changed } of report.steps ?? []) {
      console.log(
        changed > 0
          ? `${label}: ${String(changed)}% of the picture changed`
          : chalk.yellow(`${label}: nothing changed since the picture before`)
      );
    }

    for (const { target, changed } of report.clicked ?? []) {
      console.log(
        changed > 0
          ? `clicked ${target}: ${String(changed)}% of the picture changed`
          : chalk.yellow(`clicked ${target}: nothing changed — the click did nothing to see`)
      );
    }

    if (report.sheet) {
      console.log(`sheet: ${report.sheet}`);
    }

    for (const picture of report.pictures ?? []) {
      console.log(`${picture.label}: ${picture.out}`);
    }

    if (report.frames) {
      console.log(
        report.frames.moving.length > 0
          ? `moving over ${String(report.frames.count)} frames: ${regionsText(report.frames.moving)}`
          : `nothing moved over ${String(report.frames.count)} frames, ${String(report.frames.every)} ms apart`
      );
    }
  } finally {
    await browser.close();
  }
};
