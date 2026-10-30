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
 * `plitzi test [id…]`: the project's own tests (RFC 0031), as the space's document keeps them — written in its spec,
 * authored with it. Those written wrong are said first and run nothing; then the unit tests, no browser; then the e2e
 * tests, each a page of the project's server played as a visitor. What the snapshot and the publish would hold.
 */
export const spaceTest = async (ids: string[], options: SpaceTestOptions): Promise<void> => {
  const project = await projectHere('whose tests to run');
  if (!project) {
    return;
  }

  const loaded = await loadProjectSpace(project.root);
  if ('problem' in loaded) {
    unanswered(`The space does not author, so its tests cannot run: ${loaded.problem}`);

    return;
  }

  let schema: Schema;
  try {
    ({ schema } = authorSpace(loaded.space, loaded.authoring));
  } catch (error) {
    unanswered(
      `The space does not author, so its tests cannot run: ${error instanceof Error ? error.message : String(error)}`
    );

    return;
  }

  const both = options.unit !== true && options.e2e !== true;
  const unit: UnitTest[] = chosen(schema.tests?.unit ?? [], ids, both || options.unit === true);
  const e2e: E2eTest[] = chosen(schema.tests?.e2e ?? [], ids, both || options.e2e === true);
  const unknown = ids.filter(id => ![...unit, ...e2e].some(test => test.id === id));
  const problems = [...unitTestProblems(schema, unit), ...e2eTestProblems(schema, e2e)];
  if (unknown.length > 0 || problems.length > 0 || unit.length + e2e.length === 0) {
    const said = [
      ...unknown.map(id => `no test of the space is "${id}"`),
      ...problems,
      ...(unknown.length === 0 && problems.length === 0
        ? ['the space has no tests — write them in its spec: tests: { unit: [unit.test(…)], e2e: [e2e.test(…)] }']
        : [])
    ];
    if (options.json) {
      console.log(JSON.stringify({ ok: false, problems: said }));
    } else {
      console.error(chalk.red(said.map(line => `✗ ${line}`).join('\n')));
    }

    process.exitCode = 1;

    return;
  }

  const unitReport: UnitReport = runUnitTests(schema, unit);
  let e2eResults: E2eResult[] = [];
  if (e2e.length > 0) {
    const where = await originHere(
      project.root,
      project.plitzi?.kind === 'project' ? project.plitzi : undefined,
      options.url
    );
    if ('problem' in where) {
      unanswered(`${where.problem} — the e2e tests open its pages (plitzi test --unit runs the rest)`);

      return;
    }

    const ran = await runE2e(project.root, where.origin, e2e).finally(() => where.stop?.());
    if ('problem' in ran) {
      unanswered(ran.problem);

      return;
    }

    e2eResults = ran;
  }

  const ok = unitReport.failed === 0 && e2eResults.every(result => result.ok);
  if (options.json) {
    console.log(JSON.stringify({ ok, unit: unitReport, e2e: e2eResults }));
  } else {
    console.log(
      [
        ...(unit.length > 0 ? [chalk.bold('Unit tests'), ...unitReportText(unitReport)] : []),
        ...(e2e.length > 0
          ? [
              chalk.bold('E2E tests'),
              ...e2eResults.flatMap(e2eResultText),
              `${String(e2eResults.filter(result => result.ok).length)} passed, ${String(e2eResults.filter(result => !result.ok).length)} failed`
            ]
          : [])
      ].join('\n')
    );
  }

  if (!ok) {
    process.exitCode = 1;
  }
};
