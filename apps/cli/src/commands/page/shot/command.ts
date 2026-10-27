import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';

import { comparePictures, pageRegions } from '@plitzi/sdk-authoring';

import { capture, pictureOf, readPage } from './capture';
import {
  compareAfterClicks,
  compareText,
  compareLocalParts,
  compareWith,
  contactSheet,
  cropToSection,
  framesMoved,
  missingDress,
  regionsText
} from './compare';
import { framesOf } from './frames';
import { matchesSection, shotFile, smallPicture, tilesOf } from './output';
import { otherPageAt } from './remote';
import { clickThrough, interactionSteps, playSteps } from './steps';
import { MOVING_PERCENT } from './types';
import { visitorsOn } from './visitors';
import { dataUrl, projectOrigin } from '../../../browser';
import { copyOf, runPaths } from '../../../runs/core/paths';
import { keptPage } from '../../../runs/plan/reference';
import { PROJECT_TMP } from '../../../scaffold/paths';
import { projectHere } from '../../project/existingProject';
import { fail } from '../../shared/terminal';
import { CHECK_PASSWORD_ENV } from '../check';
import { pairOf } from '../measure';
import { parseSteps } from '../shotSteps';
import { visitorBrowser, visitViewOf } from '../visit';

import type { Moment, ShotOptions, ShotReport, Taken, View } from './types';
import type { PictureDiff, PictureRegion } from '@plitzi/sdk-authoring';

/**
 * `plitzi page shot`: a picture of each path at each width.
 */

/** How much of a clipped section differs before it is said to be lined up with something else: a section redone stays under. */
const MISALIGNED_PERCENT = 90;

/**
 * The element `--clip` names, as a region of the page — none when it is one of the page's sections already, a problem
 * when the page has no such element.
 */
const clipRegion = async (
  page: Taken['page'],
  regions: readonly PictureRegion[],
  section: string
): Promise<{ region: PictureRegion } | { problem: string } | undefined> => {
  if (regions.some(region => matchesSection(region, section))) {
    return undefined;
  }

  const box = await page.evaluate((id: string) => {
    const element = document.getElementById(id) ?? document.querySelector(`[data-plitzi-el="${CSS.escape(id)}"]`);
    const rect = element?.getBoundingClientRect();

    return element && rect && rect.width > 0 && rect.height > 0
      ? {
          tag: element.tagName.toLowerCase(),
          x: rect.left + window.scrollX,
          y: rect.top + window.scrollY,
          width: rect.width,
          height: rect.height
        }
      : undefined;
  }, section);

  return box
    ? {
        region: {
          name: `${box.tag}#${section}`,
          element: section,
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height
        }
      }
    : {
        problem: `--clip ${section}: the page has no element of that id drawn (an id, or an element's name), nor a section: ${regions.map(each => each.name).join(', ') || 'none'}`
      };
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

  const ready = await visitorBrowser(project.root, options, { own: !external });
  if (!ready) {
    return;
  }

  const { visitor, browser } = ready;

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
  // A hover after the clicks is played as the steps it is: a menu opened, then an item of it hovered, pictured so —
  // A run's design-1 asked `--click site-avatar --hover <item>` and was refused an option shot did not have.
  const { hover } = options;
  if (hover !== undefined && (options.steps !== undefined || options.compare)) {
    await browser.close();
    fail('`--hover` is played as steps: leave out --steps (write `hover <element>` in them) and --compare.');

    return;
  }

  const asSteps = interactionSteps(filled, options.click ?? [], hover);
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
  // Clicked beside another site: the screens of both once clicked, side by side — no sections, frames or clip of them.
  if (options.compare && clicks.length > 0 && (options.clip || (options.frames ?? 0) > 1 || options.sheet)) {
    await browser.close();
    fail(
      '`--click` with `--compare` sets the screens of both side by side once clicked: leave out --clip, --frames and --sheet.'
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

  // A clip names this page's element alone: the other site's is found by lining the pages up (a run's design-1 wrote
  // `--clip "product-about => #about-product"`, and was told the page had no element of that id).
  if (options.clip?.includes('=>')) {
    await browser.close();
    fail(
      `--clip names this page's element alone — ${options.clip.split('=>')[0]?.trim() ?? ''} — the other site's is found by lining the pages up. To set one element beside its counterpart by name, measure it: page measure <path> "${options.clip}" --compare <url>.`
    );

    return;
  }

  // Beside another site, a clip is the section of the report kept: both pages are compared whole, section by section —
  // the other site has none of this page's names to be clipped to.
  const besideLocal =
    options.compare !== undefined && /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(options.compare);
  // Beside the project's own other server, a part is the same element on both: pictured alone each side — several,
  // `--clip a,b`, each on the pages loaded once (`compareLocalParts`).
  const localPart = besideLocal && options.clip !== undefined;
  const parts = localPart
    ? (options.clip ?? '')
        .split(',')
        .map(each => each.trim())
        .filter(Boolean)
    : [];
  const section = options.compare && !localPart ? options.clip : undefined;
  const clip = options.compare && !localPart ? undefined : localPart ? parts[0] : options.clip;

  try {
    const pathname = route ?? '/';
    const view: View = {
      width: options.width ?? 1280,
      height: options.height ?? 800,
      ...(options.scale ? { scale: options.scale } : {}),
      ...(options.scheme ? { scheme: options.scheme } : {}),
      // Beside a page of this machine — the run before a task — both sides held to what the project changed: motion
      // reduced and another site's pictures stood in for, on each (the same look 7%, then 0%).
      reducedMotion: options.reducedMotion === true || besideLocal,
      ...(besideLocal ? { standIns: true } : {}),
      ...(options.waitFor ? { waitFor: options.waitFor } : {}),
      ...(clip ? { clip, ...(clicks.length > 0 || steps !== undefined ? { clipLater: true } : {}) } : {}),
      ...(clip && options.showing && options.showing.length > 0 ? { showing: options.showing } : {}),
      ...(options.scrollTo ? { scrollTo: options.scrollTo } : {}),
      ...(options.viewport ? { viewport: true } : {}),
      ...visitViewOf(options),
      ...visitor,
      ...(fromLoad ? { fromLoad } : {}),
      // One picture shows every arrival as it ends — a part clipped or scrolled to too, whose arrivals were taken as they
      // began, blank (a run's schedule rows, sent back for it). Frames, clicks and steps are about what moves, so
      // they are taken as the page plays.
      still: (options.frames ?? 0) <= 1 && clicks.length === 0 && steps === undefined && !fromLoad
    };
    // The run before it, its part, pictured while ours is — its scheme said, nothing waits for ours to be painted.
    const otherPart =
      localPart && options.compare && options.scheme && parts[0]
        ? pictureOf(
            browser,
            otherPageAt(pathname, options.compare),
            { ...view, clip: parts[0] },
            new URL(options.compare).origin
          )
        : undefined;
    const taken =
      where.origin === undefined
        ? await pictureOf(browser, pathname, view)
        : await pictureOf(browser, `${where.origin}${pathname}`, view, where.origin);
    if ('problem' in taken) {
      fail(taken.problem);

      return;
    }

    const { how } = taken;

    // Taken in a task's copy, a picture is the run's, by task: where the lead reads what the agent points at, outside
    // the copy (rebuilt when the task is taken again) and gone with the run — never left in the project's tmp/.
    const copy = copyOf(project.root);
    const file = shotFile(pathname, clip, view.width, taken.scheme);
    const asked = options.out === undefined ? undefined : path.resolve(project.root, options.out);
    // A folder named is where the picture goes, by its own name: written over, a folder was Node's EISDIR (a run's
    // design-2).
    const intoFolder =
      asked !== undefined &&
      (options.out?.endsWith('/') === true ||
        (await stat(asked).then(
          found => found.isDirectory(),
          () => false
        )));
    // A PNG is named one: written without it beside its own `-compare.png`, the picture read as no picture.
    const out = asked
      ? intoFolder
        ? path.join(asked, file)
        : asked.replace(/(\.png)?$/, '.png')
      : copy
        ? path.join(runPaths(copy.root, copy.run).shots, copy.task, file)
        : path.resolve(project.root, `${PROJECT_TMP}/shots/${file}`);
    const base = out.replace(/\.png$/, '');
    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(out, taken.png);
    const tiles = how.kind === 'page' ? await tilesOf(taken.page, view, base) : [];
    // The sections a diff is told by are the page's: a picture of part of it is one region, named for what it shows.
    const regions: PictureRegion[] = how.kind === 'page' ? await readPage(taken.page, pageRegions, undefined) : [];
    // `--clip` with `--compare` may name any element, not only a section: one inside a section is a region of its own,
    // compared where it is — a panel of a page, a card — where only the landmarks could be named (a run's pills).
    const clipped = section === undefined ? undefined : await clipRegion(taken.page, regions, section);
    if (clipped && 'problem' in clipped) {
      fail(clipped.problem);

      return;
    }

    if (clipped) {
      regions.push(clipped.region);
    }

    const report: ShotReport = {
      path: pathname,
      width: view.width,
      scheme: taken.scheme,
      out,
      ...(taken.settled > 0 ? { settled: taken.settled } : {}),
      ...(taken.unloaded > 0 ? { unloaded: taken.unloaded } : {}),
      ...(taken.undrawn.length > 0 ? { undrawn: taken.undrawn } : {}),
      ...(taken.sentTo ? { sentTo: taken.sentTo } : {}),
      ...(tiles.length > 0 ? { tiles } : {})
    };

    if (options.compare) {
      const target = otherPageAt(pathname, options.compare);
      // Against the page as the run kept it, where it did: the site may have changed since the run began.
      const kept = options.live ? undefined : await keptPage(project.root, target, view.width, taken.scheme);
      const clickedBeside =
        clicks.length > 0
          ? await compareAfterClicks(browser, taken, target, view, clicks.map(pairOf), base)
          : undefined;
      if (clickedBeside && 'problem' in clickedBeside) {
        fail(clickedBeside.problem);

        return;
      }

      const local = localPart
        ? await compareLocalParts(browser, taken, target, view, parts, base, otherPart)
        : undefined;
      if (local && 'problem' in local) {
        fail(local.problem);

        return;
      }

      const single = local?.[0];
      const compared = clickedBeside
        ? clickedBeside
        : parts.length > 1
          ? undefined
          : single
            ? 'problem' in single
              ? single
              : single.compare
            : await compareWith(browser, taken, target, view, regions, base, kept, {
                cutSections: section === undefined
              });
      if (compared && 'problem' in compared) {
        fail(compared.problem);

        return;
      }

      // Several parts: each said apart, its own comparison — one of them not drawn is said, not the whole refused.
      if (local && parts.length > 1) {
        report.parts = local;
      } else if (compared && section === undefined) {
        report.compare = compared;
      } else if (compared && section !== undefined) {
        const kept = compared.regions.filter(each => matchesSection(each, section));
        if (kept.length === 0) {
          fail(
            `--clip ${section} is none of the sections compared: ${compared.regions.map(each => (each.element ? `${each.name} (${each.element})` : each.name)).join(', ') || 'the page has no named section'} — name one of them, by its id or its element's`
          );

          return;
        }

        // Its pictures, the section's: ours where it is, theirs where the alignment found it.
        const box = regions.find(each => matchesSection(each, section));
        if (box) {
          await cropToSection(
            taken.page,
            { ...compared, own: out },
            box,
            kept.find(each => matchesSection(each, section))?.shift ?? 0
          );
        }

        // Its own findings, not the page's: dev-1's clip of one panel listed hundreds of the page's texts.
        const inside = (y: number) =>
          kept.some(region => {
            const box = regions.find(each => each.name === region.name);

            return box !== undefined && y >= box.y && y <= box.y + box.height;
          });
        const found = kept.find(each => matchesSection(each, section));
        const misaligned =
          found && (found.changed >= MISALIGNED_PERCENT || Math.abs(found.shift ?? 0) > view.height)
            ? `${section} lined up with a part of ${target} that is not it (${String(found.changed)}% differs${found.shift ? `, ${String(Math.abs(found.shift))}px ${found.shift > 0 ? 'lower' : 'higher'}` : ''}): the other page has no such section${view.scheme === undefined ? '' : `, or no ${view.scheme} scheme`} — compare ${view.scheme === 'light' ? 'in dark (--scheme dark)' : 'the page whole'}, or picture that page alone (plitzi page shot ${target})`
            : undefined;
        report.compare = {
          ...compared,
          ...(misaligned ? { misaligned } : {}),
          regions: kept,
          decorations: compared.decorations.filter(each => matchesSection({ name: each.section }, section)),
          texts: {
            ...compared.texts,
            differ: compared.texts.differ.filter(each => inside(each.y)),
            onlyHere: [],
            onlyThere: []
          },
          section
        };
      }
    }

    const frames = options.frames ?? 0;
    const every = options.every ?? 500;
    let moments: Moment[] = [];
    if (steps) {
      // Another account's steps (`as mika …`) reach the project's own server alone: a site of another's has none of them.
      const visitors =
        where.origin === undefined
          ? undefined
          : visitorsOn(project.root, browser, where.origin, {
              width: view.width,
              ...(view.scheme ? { scheme: view.scheme } : {}),
              ...(view.timezone ? { timezone: view.timezone } : {}),
              ...(view.conditions ? { conditions: view.conditions } : {})
            });
      const played = await playSteps(taken, how, steps, visitors).finally(() => visitors?.close());
      if ('problem' in played) {
        fail(played.problem);

        return;
      }

      moments = played.moments;
      report.steps = played.changes;
    } else if (clicks.length > 0 && !options.compare) {
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
      report.frames = framesOf(moved, how.kind === 'page', frames, every);
    }

    // The pictures taken after the first: on one sheet with `--sheet`, and each in a file of its own beside it always —
    // a sheet of 1440-wide steps is too small to read one, and kept none whole (design-1).
    if (moments.length > 1 && options.sheet) {
      const sheet = await taken.page.evaluate(
        contactSheet,
        moments.map(moment => ({ label: moment.label, src: dataUrl(moment.png) }))
      );
      report.sheet = `${base}-sheet.png`;
      await writeFile(report.sheet, Buffer.from(sheet.replace(/^data:image\/png;base64,/, ''), 'base64'));
    }

    if (moments.length > 1) {
      // Each picture after the first in a file of its own beside it — frames too: only the first was written, and it is
      // taken before anything has moved.
      report.pictures = [];
      for (const [index, moment] of moments.slice(1).entries()) {
        const file = `${base}-${String(index + 1)}.png`;
        await writeFile(file, moment.png);
        report.pictures.push({ label: moment.label, out: file });
      }
    }

    // `--dress`: a section with none of a kind of dress the other page has fails the picture — an acceptance's line.
    if (options.dress !== undefined && options.dress !== false && report.compare) {
      const named = typeof options.dress === 'string' ? options.dress : undefined;
      const missing = missingDress(report.compare.decorations).filter(
        line => named === undefined || line.includes(named)
      );
      if (missing.length > 0) {
        report.dressMissing = missing;
        process.exitCode = 1;
      }
    } else if (options.dress !== undefined && options.dress !== false) {
      fail('--dress says what a comparison found: give it --compare <the other page>');

      return;
    }

    if (options.json) {
      if (options.collect) {
        options.collect(report);
      } else {
        console.log(JSON.stringify(report));
      }

      return;
    }

    console.log(out);
    // A part a few lines tall is pictured at its own size — a run's 11px legend came out 350×26: said, with --scale.
    const small = clip !== undefined && options.scale === undefined ? smallPicture(taken.png) : undefined;
    if (small) {
      console.log(chalk.dim(`${small}: a part this small is read up close with --scale 4`));
    }

    if (report.sentTo) {
      console.log(
        chalk.yellow(
          visitor.account
            ? `${pathname} sent the browser to ${report.sentTo}, signed in as ${visitor.account.username}: the picture is of ${report.sentTo} — that account may not see ${pathname}`
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
      console.log(
        chalk.yellow(`${String(report.unloaded)} picture(s) or embed(s) had not loaded when the page was taken`)
      );
    }

    if (report.undrawn) {
      console.log(
        chalk.yellow(
          `${report.undrawn.join(', ')}: from another site, below the first screen — blank in a picture of the whole page, as the browser draws it only on screen: --scroll-to ${report.undrawn[0] ?? '<id>'} --viewport pictures it`
        )
      );
    }

    for (const each of report.parts ?? []) {
      console.log(
        'problem' in each ? chalk.yellow(`? ${each.part}: ${each.problem}`) : compareText(each.compare).join('\n')
      );
    }

    if (report.compare) {
      console.log(compareText(report.compare).join('\n'));
    }

    if (report.dressMissing) {
      console.log(
        chalk.red(
          [
            `✗ --dress: dressed otherwise than ${options.compare ?? 'the other page'}`,
            ...report.dressMissing.map(line => `  ${line}`)
          ].join('\n')
        )
      );
    } else if (options.dress !== undefined && options.dress !== false) {
      console.log(
        chalk.green(
          `✓ --dress: every look${typeof options.dress === 'string' ? ` naming "${options.dress}"` : ''} the other page dresses it in, this one has`
        )
      );
    }

    // Nothing changed in the part pictured is said with what changed outside it, when anything did.
    const outsideText = (outside: readonly string[] | undefined): string | undefined =>
      outside === undefined
        ? undefined
        : `nothing changed in ${String(options.clip)}, and the page changed outside it — ${outside.join('; ')}: clip what it opened, or a part that holds both`;
    for (const { label, changed, outside } of report.steps ?? []) {
      console.log(
        changed > 0
          ? `${label}: ${String(changed)}% of the picture changed`
          : chalk.yellow(`${label}: ${outsideText(outside) ?? 'nothing changed since the picture before'}`)
      );
    }

    for (const { target, changed, opened, outside } of report.clicked ?? []) {
      console.log(
        opened
          ? `clicked ${target}: it opened ${String(options.clip)}, pictured alone after it`
          : changed > 0
            ? `clicked ${target}: ${String(changed)}% of the picture changed`
            : chalk.yellow(
                `clicked ${target}: ${outsideText(outside) ?? 'nothing changed — the click did nothing to see'}`
              )
      );
    }

    if (report.sheet) {
      console.log(`sheet: ${report.sheet}`);
    }

    if (report.tiles) {
      console.log(
        `A tall page, in ${String(report.tiles.length)} parts too, each read at its size: ${report.tiles.join(', ')}`
      );
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
      if (report.frames.slight.length > 0) {
        console.log(
          `  barely — ${String(MOVING_PERCENT)}% or less, a caret or anti-aliasing, or a small part that moves: ${regionsText(report.frames.slight)} (--clip <it> says whether it moves)`
        );
      }
    }
  } finally {
    await browser.close();
  }
};
