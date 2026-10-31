import chalk from 'chalk';

import { e2eResultText, e2eTestProblems, runE2eTest } from '@plitzi/sdk-authoring';

import { authoredSpace } from '../project/spaceTests';

import type { PlayOptions } from './play';
import type { BrowserPage, Scheme } from '../../browser';
import type { ExistingProject } from '../project/existingProject';
import type { E2eTest, Schema } from '@plitzi/sdk-shared';

/**
 * `page play --journey <id>`: one of the space's journeys played first, by the engine that plays it everywhere — its
 * steps pressed and its checks held — so a play, a read or a picture starts from the case it reaches, never from steps
 * written again on the command line.
 */

/**
 * The journey `--journey` names, from the space as it authors — and the page it starts on, which the play opens — or
 * why it cannot be played: no such journey, one written wrong, another site beside it.
 */
const journeyAsked = async (
  project: ExistingProject,
  id: string,
  options: Pick<PlayOptions, 'compare'>
): Promise<{ journey: E2eTest; space: Schema } | { problem: string }> => {
  if (options.compare) {
    return {
      problem: '--journey plays one of this space’s journeys, which the other site has not: play it without --compare'
    };
  }

  const authored = await authoredSpace(project);
  if ('problem' in authored) {
    return authored;
  }

  const journeys = authored.schema.tests?.e2e ?? [];
  const journey = journeys.find(each => each.id === id);
  if (!journey) {
    return {
      problem: `no journey of the space is "${id}" — ${journeys.length > 0 ? `its journeys: ${journeys.map(each => each.id).join(', ')}` : 'it keeps none: write them in its spec, tests.e2e'}`
    };
  }

  const problems = e2eTestProblems(authored.schema, [journey], authored.schema.tests?.unit ?? []);

  return problems.length > 0
    ? { problem: `the journey is written so it cannot be played: ${problems.join('; ')}` }
    : { journey, space: authored.schema };
};

/**
 * The journey played on the page the play opened, at the play's width and scheme — or what it says when it does not
 * hold, the play stopped there: a case it never reached is no place to read from.
 */
export const playJourneyFirst = async (
  page: BrowserPage,
  { journey, space }: { journey: E2eTest; space: Schema },
  { origin, width, scheme, first }: { origin: string; width: number; scheme: Scheme | undefined; first: boolean }
): Promise<string | undefined> => {
  const played = await runE2eTest(
    page,
    { ...journey, width, ...(scheme ? { scheme } : {}) },
    {
      origin,
      space,
      open: () => Promise.resolve()
    }
  );
  if (!played.ok) {
    return [`--journey ${journey.id} did not hold at ${String(width)} px:`, ...e2eResultText(played)].join('\n');
  }

  if (first) {
    process.stderr.write(
      `${chalk.dim(`· journey ${journey.id} played first — ${String(played.steps.length)} steps, every check held — and read from where it left the page`)}\n`
    );
  }

  return undefined;
};

/**
 * Where a play starts: the page given — or, with `--journey`, the journey and the page it opens on (a path given beside
 * it that is another page is said, and the journey's played) — or why it cannot start.
 */
export const playStart = async (
  project: ExistingProject,
  given: string | undefined,
  options: Pick<PlayOptions, 'journey' | 'compare'>
): Promise<{ route: string; journey?: { journey: E2eTest; space: Schema } } | { problem: string }> => {
  if (options.journey === undefined) {
    return given === undefined
      ? { problem: 'page play needs the page to play — /pricing — or --journey <id>, which opens on its own.' }
      : { route: given };
  }

  const asked = await journeyAsked(project, options.journey, options);
  if ('problem' in asked) {
    return { problem: `--journey ${options.journey}: ${asked.problem}.` };
  }

  if (given !== undefined && given !== asked.journey.page) {
    process.stderr.write(
      `${chalk.dim(`· --journey ${asked.journey.id} starts on ${asked.journey.page}, not ${given}: played there`)}\n`
    );
  }

  return { route: asked.journey.page, journey: asked };
};
