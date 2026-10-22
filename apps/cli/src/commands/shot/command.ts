import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';

import { comparePictures, pageRegions } from '@plitzi/sdk-authoring';

import { dataUrl, launchBrowser, projectOrigin } from '../../browser';
import { originHere } from '../../runs/copyServer';
import { copyOf, runPaths } from '../../runs/paths';
import { keptPage } from '../../runs/reference';
import { PROJECT_TMP } from '../../scaffold/paths';
import { checkAccount, CHECK_PASSWORD_ENV } from '../check';
import { projectHere } from '../existingProject';
import { parseSteps } from '../shotSteps';
import { fail } from '../terminal';
import { capture, pictureOf, readPage } from './capture';
import {
  compareText,
  compareLocalPart,
  compareWith,
  contactSheet,
  cropToSection,
  framesMoved,
  missingDress,
  regionsText
} from './compare';
import { clickThrough, playSteps } from './steps';
import { MOVING_PERCENT } from './types';

import type { Moment, ShotOptions, ShotReport, Taken, View } from './types';
import type { PictureDiff, PictureRegion } from '@plitzi/sdk-authoring';

/**
 * `plitzi page shot`: a picture of each path at each width.
 */

/**
 * `plitzi page shot --width 1440,390`: a picture at each width, one after another — each named by its width, `--out`
 * too (`home.png` becomes `home-1440.png`, `home-390.png`) so one never writes over another.
 */
/** How much of a clipped section differs before it is said to be lined up with something else: a section redone stays under. */
const MISALIGNED_PERCENT = 90;

export const shotEach = async (
  route: string | undefined,
  options: Omit<ShotOptions, 'width'> & { width: number[] }
): Promise<void> => {
  const { width: all, ...rest } = options;
  // In a task's copy nobody serves, the copy is served once for every width, and stopped after the last.
  const external = route !== undefined && /^https?:\/\//.test(route);
  const project = !external && rest.url === undefined ? await projectHere('whose page to picture') : undefined;
  const served =
    project && copyOf(project.root)
      ? await originHere(project.root, project.plitzi?.kind === 'project' ? project.plitzi : undefined)
      : undefined;
  if (served && 'problem' in served) {
    fail(served.problem);

    return;
  }

  // `--json` at several widths is one object, `{ widths: [...] }`, as the flag says — two lines of JSON are no object.
  const reports: ShotReport[] = [];
  const collect = rest.json && all.length > 1 ? (report: ShotReport) => reports.push(report) : undefined;
  try {
    for (const each of all) {
      const out = rest.out && all.length > 1 ? rest.out.replace(/(\.png)?$/, `-${String(each)}.png`) : rest.out;
      await shot(route, {
        ...rest,
        width: each,
        ...(out ? { out } : {}),
        ...(served ? { url: served.origin } : {}),
        ...(collect ? { collect } : {})
      });
      if (process.exitCode !== undefined && process.exitCode !== 0) {
        break;
      }
    }
  } finally {
    served?.stop?.();
  }

  if (collect) {
    console.log(JSON.stringify({ widths: reports }));
  }
};

const matchesSection = (region: { name: string; element?: string }, section: string): boolean =>
  region.name === section || region.name.endsWith(`#${section}`) || region.element === section;

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
  const besideLocal =
    options.compare !== undefined && /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(options.compare);
  // Beside the project's own other server, a part is the same element on both: pictured alone each side (`compareLocalPart`).
  const localPart = besideLocal && options.clip !== undefined;
  const section = options.compare && !localPart ? options.clip : undefined;
  const clip = options.compare && !localPart ? undefined : options.clip;

  try {
    const pathname = route ?? '/';
    const view: View = {
      width: options.width ?? 1280,
      height: options.height ?? 800,
      ...(options.scheme ? { scheme: options.scheme } : {}),
      // Beside a page of this machine — the run before a task — both sides held to what the project changed: motion
      // reduced and another site's pictures stood in for, on each (velada-polish: the same look 7%, then 0%).
      reducedMotion: options.reducedMotion === true || besideLocal,
      ...(besideLocal ? { standIns: true } : {}),
      ...(options.waitFor ? { waitFor: options.waitFor } : {}),
      ...(clip ? { clip, ...(clicks.length > 0 || steps !== undefined ? { clipLater: true } : {}) } : {}),
      ...(options.scrollTo ? { scrollTo: options.scrollTo } : {}),
      ...(options.viewport ? { viewport: true } : {}),
      ...(options.presence ? { presence: true } : {}),
      ...(options.timezone ? { timezone: options.timezone } : {}),
      ...(account ? { account } : {}),
      ...(fromLoad ? { fromLoad } : {}),
      // One picture shows every arrival as it ends — a part clipped or scrolled to too, whose arrivals were taken as they
      // began, blank (la-velada's schedule rows, sent back for it). Frames, clicks and steps are about what moves, so
      // they are taken as the page plays.
      still: (options.frames ?? 0) <= 1 && clicks.length === 0 && steps === undefined && !fromLoad
    };
    // The run before it, its part, pictured while ours is — its scheme said, nothing waits for ours to be painted.
    const otherPart =
      localPart && options.compare && options.scheme && options.clip
        ? (() => {
            const other = new URL(options.compare);
            const target = other.pathname === '/' ? new URL(pathname, other).href : other.href;

            return pictureOf(browser, target, { ...view, clip: options.clip }, other.origin);
          })()
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
    const regions: PictureRegion[] = how.kind === 'page' ? await readPage(taken.page, pageRegions, undefined) : [];
    // `--clip` with `--compare` may name any element, not only a section: one inside a section is a region of its own,
    // compared where it is — a panel of a page, a card — where only the landmarks could be named (la-velada's pills).
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
      ...(taken.sentTo ? { sentTo: taken.sentTo } : {})
    };

    if (options.compare) {
      const other = new URL(options.compare);
      const target = other.pathname === '/' ? new URL(pathname, other).href : other.href;
      // Against the page as the run kept it, where it did: the site may have changed since the run began.
      const kept = options.live ? undefined : await keptPage(project.root, target, view.width, taken.scheme);
      const compared =
        localPart && options.clip !== undefined
          ? await compareLocalPart(browser, taken, target, view, options.clip, base, otherPart)
          : await compareWith(browser, taken, target, view, regions, base, kept);
      if ('problem' in compared) {
        fail(compared.problem);

        return;
      }

      if (section === undefined) {
        report.compare = compared;
      } else {
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

    // The pictures taken after the first: on one sheet with `--sheet`, and each in a file of its own beside it always —
    // a sheet of 1440-wide steps is too small to read one, and kept none whole (velada-dress, design-1).
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

    for (const { label, changed } of report.steps ?? []) {
      console.log(
        changed > 0
          ? `${label}: ${String(changed)}% of the picture changed`
          : chalk.yellow(`${label}: nothing changed since the picture before`)
      );
    }

    for (const { target, changed, opened } of report.clicked ?? []) {
      console.log(
        opened
          ? `clicked ${target}: it opened ${String(options.clip)}, pictured alone after it`
          : changed > 0
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
