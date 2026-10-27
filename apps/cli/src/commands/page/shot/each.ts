import { stat } from 'node:fs/promises';
import path from 'node:path';

import { shot } from './command';
import { eachOut } from './output';
import { originHere } from '../../../runs/copies/copyServer';
import { copyOf } from '../../../runs/core/paths';
import { projectHere } from '../../project/existingProject';
import { fail, UNANSWERED_EXIT } from '../../shared/terminal';

import type { ShotOptions, ShotReport } from './types';
import type { Scheme } from '../../../browser';

/**
 * `plitzi page shot / /about --width 1440,390`: a picture of each page at each width, one after another — `--out` named
 * by what differs (`home.png` becomes `home-1440.png`, `home-390.png`; with pages, `home-about-1440.png`) so one never
 * writes over another.
 */
/** What `plitzi page shot` is handed: a list of widths, and of schemes. */
export type ShotEachOptions = Omit<ShotOptions, 'width' | 'scheme'> & { width: number[]; scheme?: Scheme[] };

export const shotEach = async (routes: readonly string[], options: ShotEachOptions): Promise<void> => {
  const { width: widthsAsked, scheme: schemesAsked, ...rest } = options;
  // Each page asked, and each at each width in each scheme: `--scheme light,dark` as `--width 1440,390` (a run's
  // design-2 asked for both), and several pages as `page check` takes them — a lead wrote three and was refused.
  const pages = routes.length > 0 ? routes : [undefined];
  const views = widthsAsked.flatMap(width =>
    (schemesAsked ?? [undefined]).map(scheme => ({ width, ...(scheme ? { scheme } : {}) }))
  );
  const all = pages.flatMap(route => views.map(view => ({ route, ...view })));
  const externals = pages.filter(route => route !== undefined && /^https?:\/\//.test(route));
  if (externals.length > 0 && externals.length < pages.length) {
    fail(
      `${externals.join(', ')} ${externals.length === 1 ? 'is another site' : 'are other sites'}: picture another site's pages in a command of their own, apart from the project's.`
    );

    return;
  }

  // In a task's copy nobody serves, the copy is served once for every picture, and stopped after the last.
  const external = externals.length > 0;
  const project = !external && rest.url === undefined ? await projectHere('whose page to picture') : undefined;
  const served =
    project && copyOf(project.root)
      ? await originHere(project.root, project.plitzi?.kind === 'project' ? project.plitzi : undefined)
      : undefined;
  if (served && 'problem' in served) {
    fail(served.problem);

    return;
  }

  // `--json` of several pictures is one object, `{ widths: [...] }` — each with its path, width and scheme — as the
  // flag says: two lines of JSON are no object.
  const reports: ShotReport[] = [];
  const collect = rest.json && all.length > 1 ? (report: ShotReport) => reports.push(report) : undefined;
  try {
    // A folder named stays the folder — each picture in it by its own name, the width in it (the folder
    // became `<folder>-1440.png`); a file is named for each page, width and scheme.
    const folder =
      rest.out !== undefined &&
      (rest.out.endsWith('/') ||
        (await stat(path.resolve(project?.root ?? process.cwd(), rest.out)).then(
          found => found.isDirectory(),
          () => false
        )));
    let failed = false;
    for (const each of all) {
      const out =
        rest.out && all.length > 1 && !folder
          ? eachOut(rest.out, each, {
              pages: pages.length,
              widths: widthsAsked.length,
              schemes: schemesAsked?.length ?? 0
            })
          : rest.out;
      process.exitCode = undefined;
      await shot(each.route, {
        ...rest,
        width: each.width,
        ...(each.scheme ? { scheme: each.scheme } : {}),
        ...(out ? { out } : {}),
        ...(served ? { url: served.origin } : {}),
        ...(collect ? { collect } : {})
      });
      // A picture that differs at one width says nothing of the next: every picture is taken, and the command fails at
      // the end (a --dress failing at 1440 left 390 untaken, and the lead ran it again). One that cannot be taken
      // at all stops it.
      const exit = exitCode();
      if (exit === UNANSWERED_EXIT) {
        return;
      }

      failed ||= exit !== undefined && exit !== 0;
    }

    process.exitCode = failed ? 1 : undefined;
  } finally {
    served?.stop?.();
  }

  if (collect) {
    console.log(JSON.stringify({ widths: reports }));
  }
};

/** The exit a shot set, read anew: assigned before it, TypeScript would take it for the value it was given. */
const exitCode = (): typeof process.exitCode => process.exitCode;
