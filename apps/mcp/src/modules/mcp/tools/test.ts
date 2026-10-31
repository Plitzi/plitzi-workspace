import { z } from 'zod';

import {
  e2eTestProblems,
  readSpaceTests,
  runUnitTests,
  testAccountWarnings,
  unitTestProblems
} from '@plitzi/sdk-authoring';

import { defineTool } from './shared/tool';

import type { ToolContext } from './shared/tool';
import type { Schema } from '@plitzi/sdk-shared';

export const testShape = {
  action: z
    .enum(['list', 'set', 'run'])
    .describe('list: the tests and how the unit ones stand · set: save them whole · run: the unit tests, then the e2e'),
  tests: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('With set: `{ unit, e2e, accounts }`, every test of the space — what is left out is removed'),
  ids: z.array(z.string()).optional().describe('With run: the tests to run, by id; all when none')
};

/** The tests and how they stand against the document: those written wrong, every unit test run. */
const standing = (schema: Schema) => {
  const report = runUnitTests(schema);

  return {
    tests: {
      unit: schema.tests?.unit ?? [],
      e2e: schema.tests?.e2e ?? [],
      ...(schema.tests?.accounts ? { accounts: schema.tests.accounts } : {})
    },
    problems: [...unitTestProblems(schema), ...e2eTestProblems(schema)],
    // A test account's role the space removed since: warned — the journey plays without it.
    warnings: testAccountWarnings(schema),
    unit: { passed: report.passed, failed: report.failed, failing: report.results.filter(result => !result.ok) }
  };
};

/**
 * The space's own tests, kept in its document: read, saved whole, or run — the unit tests here, the e2e ones
 * on the draft where the deployment plays them. What a snapshot and a publish hold the space to.
 */
export const test = async (
  input: { action: 'list' | 'set' | 'run'; tests?: Record<string, unknown>; ids?: string[] },
  ctx: ToolContext
): Promise<unknown> => {
  const { schema } = ctx.space;
  if (input.action === 'list') {
    return standing(schema);
  }

  if (input.action === 'set') {
    const read = readSpaceTests(input.tests);
    if ('problems' in read) {
      return { saved: false, problems: read.problems };
    }

    if (!ctx.persisters.tests) {
      return { saved: false, problems: ['This connection cannot write the space'] };
    }

    const next: Schema = { ...schema, tests: read.tests };
    await ctx.persisters.tests(next);

    return { saved: true, ...standing(next) };
  }

  const ids = input.ids ?? [];
  const chosen = (schema.tests?.unit ?? []).filter(each => ids.length === 0 || ids.includes(each.id));
  const unit = runUnitTests(schema, chosen);
  const e2e = (schema.tests?.e2e ?? []).filter(each => ids.length === 0 || ids.includes(each.id));
  const played =
    e2e.length === 0
      ? { results: [] }
      : ctx.runE2eTests
        ? await ctx.runE2eTests(e2e.map(each => each.id))
        : { notRun: 'this deployment plays no e2e tests' };

  return {
    unit: { passed: unit.passed, failed: unit.failed, failing: unit.results.filter(result => !result.ok) },
    e2e: played
  };
};

export const testTool = defineTool({
  name: 'plitzi_test',
  title: 'Space tests',
  description:
    'The space’s own tests, kept in its document: list them and how they stand, save them whole (`unit`: an element ' +
    'resolved for a state; `e2e`: a visitor’s steps on a page), or run them. A snapshot and a publish wait for them.',
  inputShape: testShape,
  access: 'write',
  run: (input, ctx) => test(input, ctx)
});
