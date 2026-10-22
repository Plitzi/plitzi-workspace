import { isRecord } from '@plitzi/sdk-shared/helpers';

import { RunRefusal } from '../../runs/refusal';

import type { LookOptions } from './review';
import type { Preview } from '../../runs/preview';

/** One page of a look beside the run before the task: how much differs, and in which sections. */
export interface BeforeAfter {
  route: string;
  width: string;
  scheme: string;
  changed?: number;
  sections: string[];
  /**
   * The sections whose dress the task changed — a layer added, or one taken away — in a few words: a soft light is a
   * few levels a pixel, under the picture comparison's tolerance, and read "0.1% differs" where a page's light was
   * new (velada-dress, /artistas).
   */
  dress: string[];
  sideBySide?: string;
  problem?: string;
}

/** A look's server that stopped while it looked — why, and its last lines — or nothing while it serves. */
export const stoppedText = (what: string, served: Pick<Preview, 'stopped'> | undefined): string[] => {
  const stopped = served?.stopped();

  return stopped
    ? [
        `${what} stopped while it was looked at (${stopped.why}): what failed after is no finding of the task's${stopped.said.length > 0 ? ` — it said last: ${stopped.said.join(' | ')}` : ''}`
      ]
    : [];
};

/** What `page shot --compare --json` answered: how much differs, by section, and where the pictures went. */
export const comparedOf = (output: string): Omit<BeforeAfter, 'route' | 'width' | 'scheme'> => {
  const at = output.indexOf('{');
  try {
    const answer: unknown = at === -1 ? undefined : JSON.parse(output.slice(at));
    const compare = isRecord(answer) && isRecord(answer.compare) ? answer.compare : undefined;
    if (!compare) {
      return { sections: [], dress: [], problem: output.trim().split('\n').at(-1) ?? 'no comparison' };
    }

    const regions = Array.isArray(compare.regions) ? compare.regions : [];
    const decorations = Array.isArray(compare.decorations) ? compare.decorations : [];
    // Here is the task's page, there the run before it: what is only here it added, what is only there it took away.
    const listOf = (value: unknown): string[] =>
      Array.isArray(value) ? value.filter((each): each is string => typeof each === 'string') : [];

    return {
      ...(typeof compare.changed === 'number' ? { changed: compare.changed } : {}),
      sections: regions.flatMap(region =>
        isRecord(region) && typeof region.name === 'string' && typeof region.changed === 'number' && region.changed > 0
          ? [`${region.name} ${String(region.changed)}%`]
          : []
      ),
      dress: decorations.flatMap(section => {
        if (!isRecord(section) || typeof section.section !== 'string') {
          return [];
        }

        const added = listOf(section.extra);
        const gone = [...listOf(section.absent), ...listOf(section.missing)];

        return added.length > 0 || gone.length > 0
          ? [
              `${section.section}${added.length > 0 ? ` + ${added.join('; ')}` : ''}${gone.length > 0 ? ` − ${gone.join('; ')}` : ''}`
            ]
          : [];
      }),
      ...(typeof compare.sideBySide === 'string' ? { sideBySide: compare.sideBySide } : {})
    };
  } catch {
    return { sections: [], dress: [], problem: 'the comparison could not be read' };
  }
};

export interface Checked {
  code: number;
  output: string;
}

/**
 * The page check of `task look`: its pages, and the click or hover asked — one element of one page, as `page check`
 * takes it, so with several pages each is checked with it apart (velada-dress: `task look --hover` on a task of three
 * pages was refused whole). One browser at a time: each check opens its own.
 */
/** What `page same --json` read differing first, for one page: none when it drew the same, or could not be told. */
export const elsewhereOf = (output: string): { here: string; there: string } | undefined => {
  try {
    const read: unknown = JSON.parse(output.trim().split('\n').at(-1) ?? '');
    const page: unknown = isRecord(read) && Array.isArray(read.pages) ? (read.pages as unknown[])[0] : undefined;
    const first = isRecord(page) && page.same === false && isRecord(page.first) ? page.first : undefined;

    return first && typeof first.here === 'string' && typeof first.there === 'string'
      ? { here: first.here, there: first.there }
      : undefined;
  } catch {
    return undefined;
  }
};

/** The pages `page same --json` read the same on both servers: what a look leaves unpictured. */
export const samePaths = (output: string): string[] => {
  const line = output.trim().split('\n').at(-1) ?? '';
  try {
    const read: unknown = JSON.parse(line);
    const pages = isRecord(read) && Array.isArray(read.pages) ? (read.pages as unknown[]) : [];

    return pages.flatMap(page =>
      isRecord(page) && page.same === true && typeof page.path === 'string' ? [page.path] : []
    );
  } catch {
    return [];
  }
};

export const checkWithInteraction = async (
  routes: readonly string[],
  interaction: readonly string[],
  checkOf: (pages: readonly string[], also: readonly string[]) => Promise<Checked>
): Promise<Checked> => {
  if (interaction.length === 0 || routes.length === 1) {
    return checkOf(routes, interaction);
  }

  const all = await checkOf(routes, []);
  const each: Checked[] = [];
  for (const route of routes) {
    each.push(await checkOf([route], interaction));
  }

  return {
    code: [all, ...each].some(one => one.code !== 0) ? 1 : 0,
    output: [
      all.output.trim(),
      ...each.map((one, index) => `With ${interaction.join(' ')} on ${routes[index]}:\n${one.output.trim()}`)
    ].join('\n')
  };
};

/** The pictures a `page shot --steps --json` took after the first: the hovered page, for a look. */
export const picturesOf = (output: string): string[] => {
  try {
    const report: unknown = JSON.parse(output.trim().split('\n').at(-1) ?? '');
    const pictures = isRecord(report) && Array.isArray(report.pictures) ? report.pictures : [];

    return pictures.flatMap(picture => (isRecord(picture) && typeof picture.out === 'string' ? [picture.out] : []));
  } catch {
    return [];
  }
};

const WIDTHS = /^\d{3,4}(,\d{3,4})*$/;

/**
 * The widths and schemes asked for (`--width 1440,768`, `--scheme light,dark`): each width in each scheme — none asked,
 * the team's. Refused when they are not widths or schemes, never pictured on a guess.
 */
export const viewsAsked = (
  options: Pick<LookOptions, 'width' | 'scheme'>
): [string, 'light' | 'dark'][] | undefined => {
  if (options.width === undefined && options.scheme === undefined) {
    return undefined;
  }

  const widths = options.width ?? '1440,390';
  if (!WIDTHS.test(widths)) {
    throw new RunRefusal('invalid', `--width ${widths}: widths in px, separated by commas (1440,390)`);
  }

  const schemes = (options.scheme ?? 'light,dark').split(',').map(each => each.trim());
  const valid = schemes.filter((each): each is 'light' | 'dark' => each === 'light' || each === 'dark');
  if (valid.length !== schemes.length || valid.length === 0) {
    throw new RunRefusal('invalid', `--scheme ${options.scheme ?? ''}: light, dark, or both (light,dark)`);
  }

  return widths.split(',').flatMap(width => valid.map(scheme => [width, scheme] as [string, 'light' | 'dark']));
};
