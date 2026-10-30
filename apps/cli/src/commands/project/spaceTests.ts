import chalk from 'chalk';

import {
  authorSpace,
  e2eResultText,
  e2eTestProblems,
  runE2eTest,
  runUnitTests,
  unitReportText,
  unitTestProblems
} from '@plitzi/sdk-authoring';

import { projectHere } from './existingProject';
import { loadProjectSpace } from './projectSpace';
import { launchBrowser, openProjectPage, VIEW_HEIGHT } from '../../browser';
import { originHere } from '../../runs/copies/copyServer';
import { unanswered } from '../shared/terminal';

import type { ExistingProject } from './existingProject';
import type { E2eResult, UnitReport } from '@plitzi/sdk-authoring';
import type { E2eTest, Schema, UnitTest } from '@plitzi/sdk-shared';

export interface SpaceTestOptions {
  /** The unit tests alone: no browser, no server. */
  unit?: boolean;
  /** The e2e tests alone. */
  e2e?: boolean;
  /** Where the project is served, when not by its own server. */
  url?: string;
  json?: boolean;
}

/** How the project's tests went: those written wrong, the unit tests' report, each e2e test played. */
export interface SpaceTestsPlayed {
  ok: boolean;
  /** Tests written so they cannot be read, and ids asked for that no test has: said first, and nothing run. */
  problems: string[];
  /** How many tests the space has, of both kinds — none is a project with nothing to run. */
  count: number;
  unit?: UnitReport;
  e2e: E2eResult[];
}

/** The tests a run takes: those named by id, else all — of the kind asked, or both. */
const chosen = <T extends { id: string }>(tests: readonly T[], ids: readonly string[], wanted: boolean): T[] =>
  wanted ? tests.filter(test => ids.length === 0 || ids.includes(test.id)) : [];

/** Each e2e test played in a page of its own, at its width, against the project's server. */
const runE2e = async (
  root: string,
  origin: string,
  tests: readonly E2eTest[]
): Promise<E2eResult[] | { problem: string }> => {
  const browser = await launchBrowser(root);
  if ('problem' in browser) {
    return browser;
  }

  try {
    const results: E2eResult[] = [];
    for (const test of tests) {
      const page = await openProjectPage(browser, origin, {
        width: test.width ?? 1440,
        height: VIEW_HEIGHT,
        reducedMotion: true,
        ...(test.scheme ? { scheme: test.scheme } : {})
      });
      try {
        results.push(await runE2eTest(page, test, { origin }));
      } finally {
        await page.close();
      }
    }

    return results;
  } finally {
    await browser.close();
  }
};

/**
 * The project's own tests (RFC 0031), as the space's document keeps them — written in its spec, authored with it: those
 * written wrong said first and nothing run; then the unit tests, no browser; then the e2e tests, each a page of the
 * project's server played as a visitor. What the snapshot and the publish would hold. Answers how it went, or why it
 * could not be asked: `plitzi test` says it, `plitzi verify` counts it as one of its checks.
 */
export const playSpaceTests = async (
  project: ExistingProject,
  ids: readonly string[],
  options: Omit<SpaceTestOptions, 'json'>
): Promise<SpaceTestsPlayed | { problem: string }> => {
  const loaded = await loadProjectSpace(project.root);
  if ('problem' in loaded) {
    return { problem: `The space does not author, so its tests cannot run: ${loaded.problem}` };
  }

  let schema: Schema;
  try {
    ({ schema } = authorSpace(loaded.space, loaded.authoring));
  } catch (error) {
    return {
      problem: `The space does not author, so its tests cannot run: ${error instanceof Error ? error.message : String(error)}`
    };
  }

  const both = options.unit !== true && options.e2e !== true;
  const unit: UnitTest[] = chosen(schema.tests?.unit ?? [], ids, both || options.unit === true);
  const e2e: E2eTest[] = chosen(schema.tests?.e2e ?? [], ids, both || options.e2e === true);
  const unknown = ids.filter(id => ![...unit, ...e2e].some(test => test.id === id));
  const problems = [
    ...unknown.map(id => `no test of the space is "${id}"`),
    ...unitTestProblems(schema, unit),
    ...e2eTestProblems(schema, e2e)
  ];
  const count = unit.length + e2e.length;
  if (problems.length > 0 || count === 0) {
    return { ok: problems.length === 0, problems, count, e2e: [] };
  }

  const unitReport = runUnitTests(schema, unit);
  if (e2e.length === 0) {
    return { ok: unitReport.failed === 0, problems, count, unit: unitReport, e2e: [] };
  }

  const where = await originHere(
    project.root,
    project.plitzi?.kind === 'project' ? project.plitzi : undefined,
    options.url
  );
  if ('problem' in where) {
    return { problem: `${where.problem} — the e2e tests open its pages (plitzi test --unit runs the rest)` };
  }

  const played = await runE2e(project.root, where.origin, e2e).finally(() => where.stop?.());
  if ('problem' in played) {
    return played;
  }

  return {
    ok: unitReport.failed === 0 && played.every(result => result.ok),
    problems,
    count,
    unit: unitReport,
    e2e: played
  };
};

/** How the tests went, as a person reads it: those written wrong; else each kind with what each test did. */
export const spaceTestsText = (played: SpaceTestsPlayed): string[] => {
  if (played.problems.length > 0) {
    return played.problems.map(line => `✗ ${line}`);
  }

  if (played.count === 0) {
    return ['✗ the space has no tests — write them in its spec: tests: { unit: [unit.test(…)], e2e: [e2e.test(…)] }'];
  }

  return [
    ...(played.unit && played.unit.results.length > 0 ? ['Unit tests', ...unitReportText(played.unit)] : []),
    ...(played.e2e.length > 0
      ? [
          'E2E tests',
          ...played.e2e.flatMap(e2eResultText),
          `${String(played.e2e.filter(result => result.ok).length)} passed, ${String(played.e2e.filter(result => !result.ok).length)} failed`
        ]
      : [])
  ];
};

/** `plitzi test [id…]`: the project's own tests, said; a failure — or a test written wrong — exits 1. */
export const spaceTest = async (ids: string[], options: SpaceTestOptions): Promise<void> => {
  const project = await projectHere('whose tests to run');
  if (!project) {
    return;
  }

  const played = await playSpaceTests(project, ids, options);
  if ('problem' in played) {
    unanswered(played.problem);

    return;
  }

  const failed = !played.ok || played.count === 0;
  if (options.json) {
    console.log(
      JSON.stringify(
        played.problems.length > 0 || played.count === 0
          ? { ok: false, problems: played.problems.length > 0 ? played.problems : spaceTestsText(played) }
          : { ok: played.ok, unit: played.unit, e2e: played.e2e }
      )
    );
  } else {
    const lines = spaceTestsText(played).map(line =>
      line === 'Unit tests' || line === 'E2E tests' ? chalk.bold(line) : line
    );
    (failed ? console.error : console.log)(
      failed && played.problems.length > 0 ? chalk.red(lines.join('\n')) : lines.join('\n')
    );
  }

  if (failed) {
    process.exitCode = 1;
  }
};
