import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { DEVELOPER, TESTER } from './team';
import { workedBy } from './worked';

import type { Acceptance, PlannedTask, RunPlan, RunTask } from './model';
import type { TaskView } from './taskStore';

/**
 * A tester in the team: every developer task gets a task of its tests, after it — `<id>-tests`, a developer's that
 * worked none of what it tests (`testsOf`), a tester's when no developer may — so what a developer wrote is held by tests
 * somebody else wrote from its acceptance, not from its code; the tester reviews them, its QA (Carlos: the tester's Opus
 * is for judgment, the tests are a developer's work). Its files are
 * where this project's tests are: a page's in `visual/<page>.spec.ts` (Playwright, against the copy served), a module's
 * beside it (`<file>.test.ts`, `node --test`). A task that says `tests: false`, writes nothing a test is written for, or
 * that a tester's task of the plan already waits for, gets none; two whose tests are one file share one task of them.
 */

export const TESTS_SUFFIX = '-tests';

/**
 * Whether `agent` may write a task: one of tests, only if it worked none of the tasks it tests — written from what was
 * asked, by one that did not write the work. Any other, anyone of its role.
 */
export const writesTests = (task: Pick<RunTask, 'testsOf'>, agent: string, views: readonly TaskView[]): boolean =>
  task.testsOf === undefined ||
  !views.some(view => task.testsOf?.includes(view.task.id) === true && workedBy(view, agent));

/** The developers that may write a task of tests: none, and it is a tester's (`spareTests`). */
export const testWriters = (
  task: Pick<RunTask, 'testsOf'>,
  views: readonly TaskView[],
  developers: readonly string[]
): string[] => developers.filter(developer => writesTests(task, developer, views));

/** What the project's tests run with: Playwright for its pages' — when it has it — against the copy its start serves. */
export interface TestSetup {
  playwright: boolean;
  served: boolean;
  /**
   * The page a file is drawn in, read off the imports: the unit that owns it (`src/space/pages/walks.ts` for the
   * `walkFilter.ts` only it imports) — none for a module several pages share. A file it does not know is its own.
   */
  unitOf?: (file: string) => string | undefined;
  /**
   * The test files the project has already: what a task's change may break — given to it as well (`touches`), so it
   * fixes what it breaks there; encore-14's t-shows-coming went to review failing a test that enumerates every action,
   * its file its tests card's.
   */
  existing?: ReadonlySet<string>;
}

export const testSetupOf = async (root: string): Promise<TestSetup> => {
  const parsed: unknown = await fs
    .readFile(path.join(root, 'package.json'), 'utf-8')
    .then(text => JSON.parse(text) as unknown)
    .catch(() => undefined);
  const named = (field: string): Record<string, unknown> => {
    const value = isRecord(parsed) ? parsed[field] : undefined;

    return isRecord(value) ? value : {};
  };
  const scripts = named('scripts');

  return {
    playwright: '@playwright/test' in { ...named('dependencies'), ...named('devDependencies') },
    served: ['start', 'start:dev'].some(name => typeof scripts[name] === 'string')
  };
};

const PAGES = 'src/space/pages/';
/** Code a test of its own is written for: a module outside the space's document — or its `lib/` — not a `.tsx`. */
const MODULE = /^src\/(?!space\/(?!lib\/)).+\.[cm]?ts$/;
const NOT_TESTED = /\.(?:test|spec)\.[cm]?ts$|\.d\.[cm]?ts$|^src\/(?:main\.ts$|config\/)/;

/**
 * The test files of a task's files: each page's spec — when the project has Playwright — and each module's test beside
 * it, in the files' order, once.
 */
export const testFilesFor = (
  files: readonly string[],
  { playwright = true, unitOf = file => file }: Partial<Pick<TestSetup, 'playwright' | 'unitOf'>> = {}
): string[] => {
  const tests = files.flatMap(file => {
    if (file.startsWith(PAGES)) {
      const unit = unitOf(file);
      if (!playwright || unit === undefined || !unit.startsWith(PAGES)) {
        return [];
      }

      const page = unit
        .slice(PAGES.length)
        .split('/')[0]
        ?.replace(/\.[cm]?tsx?$/, '');

      return page ? [`visual/${page}.spec.ts`] : [];
    }

    return MODULE.test(file) && !NOT_TESTED.test(file) ? [file.replace(/\.([cm]?ts)$/, '.test.$1')] : [];
  });

  return [...new Set(tests)];
};

/** Of the test files the tasks' files are named for, those the project has already. */
export const existingTests = async (
  root: string,
  tasks: readonly Pick<PlannedTask, 'files'>[],
  setup: Pick<TestSetup, 'playwright' | 'unitOf'>
): Promise<Set<string>> => {
  const named = [...new Set(tasks.flatMap(task => testFilesFor(task.files, setup)))];
  const found = await Promise.all(
    named.map(file =>
      fs
        .access(path.join(root, file))
        .then(() => file)
        .catch(() => undefined)
    )
  );

  return new Set(found.filter(file => file !== undefined));
};

/**
 * The commands that run them, against the copy served: what the task of them is accepted by — said as a line to check by
 * hand when the project has no start script to serve the copy with.
 */
const testChecks = (files: readonly string[], served: boolean): Acceptance[] => {
  const specs = files.filter(file => file.startsWith('visual/'));
  const units = files.filter(file => !file.startsWith('visual/'));
  const said = 'Its pages’ tests pass against the copy served';

  return [
    ...(specs.length > 0
      ? [
          served
            ? { said, check: `npx playwright test ${specs.join(' ')} --reporter=line` }
            : `${said} — npx playwright test ${specs.join(' ')}, with the copy started by hand: the project has no start script`
        ]
      : []),
    // Every test beside them, not only the files named: a run's test-1 held a task's acceptance in a third file of
    // the folder, which the check never ran.
    ...(units.length > 0
      ? [
          {
            said: 'Its modules’ tests pass, and every test beside them',
            check: `node --test ${[...new Set(units.map(file => path.posix.dirname(file)))].map(dir => `'${dir}/**/*.test.ts'`).join(' ')}`
          }
        ]
      : [])
  ];
};

/** The plan with a task of tests after each developer task — as it is when the team has no tester, otherwise. */
export const withTestTasks = (
  plan: RunPlan,
  setup: TestSetup | undefined
): { plan: RunPlan; added: string[]; untested: { task: string; why: string }[] } => {
  if (!setup) {
    return { plan, added: [], untested: [] };
  }

  const untested: { task: string; why: string }[] = [];

  const holderOf = new Map(plan.tasks.flatMap(task => task.files.map(file => [file, task.id] as const)));
  // What a task of the plan already tests: its `testsOf`, or what a tester's task of it waits for.
  const tested = new Set(
    plan.tasks.flatMap(task => task.testsOf ?? ((task.role ?? DEVELOPER) === TESTER ? task.dependsOn : []))
  );
  const ids = new Set(plan.tasks.map(task => task.id));
  // By developer task, the test files of the project its tests card takes: its own to fix as well, before that card.
  const touched = new Map<string, string[]>();
  // By test file, the developer tasks whose tests it holds: one task of tests a group of them.
  const groups: { of: PlannedTask[]; files: string[] }[] = [];
  for (const task of plan.tasks) {
    if (
      (task.role ?? DEVELOPER) !== DEVELOPER ||
      // Research writes no file: nothing of it is tested, and nothing is said missing.
      (task.spike !== undefined && task.files.length === 0) ||
      task.testsOf !== undefined ||
      task.tests === false ||
      tested.has(task.id)
    ) {
      continue;
    }

    const named = testFilesFor(task.files, setup);
    const files = named.filter(file => !holderOf.has(file));
    const breaks = files.filter(file => setup.existing?.has(file) === true);
    if (breaks.length > 0) {
      touched.set(task.id, breaks);
    }

    if (files.length === 0) {
      // Its own test files are its own tests, written with it — said so, never "another task's" (encore-10).
      const own = named.filter(file => holderOf.get(file) === task.id);
      const others = named.filter(file => holderOf.get(file) !== task.id);
      untested.push({
        task: task.id,
        why:
          named.length === 0
            ? 'none of its files has a test file named for it — a component or a module no page owns'
            : others.length === 0
              ? `it writes its tests itself (${own.join(', ')}): none written by another`
              : `its test files are another task's (${others.join(', ')})`
      });
      continue;
    }

    const meeting = groups.filter(group => group.files.some(file => files.includes(file)));
    const merged = {
      of: [...meeting.flatMap(group => group.of), task],
      files: [...new Set([...meeting.flatMap(group => group.files), ...files])]
    };
    groups.splice(0, groups.length, ...groups.filter(group => !meeting.includes(group)), merged);
  }

  const added = groups.map(({ of, files }): PlannedTask => {
    const [first] = of;
    const id = ids.has(`${first.id}${TESTS_SUFFIX}`) ? `${first.id}${TESTS_SUFFIX}-2` : `${first.id}${TESTS_SUFFIX}`;
    const named = of.map(each => each.id).join(', ');

    return {
      id,
      title: `Tests for ${named}: what ${of.length > 1 ? 'they do' : 'it does'}, held by tests`,
      role: DEVELOPER,
      files,
      dependsOn: of.map(each => each.id),
      testsOf: of.map(each => each.id),
      priority: first.priority,
      estimateMinutes: Math.max(10, Math.round(of.reduce((sum, each) => sum + each.estimateMinutes, 0) / 2)),
      ...(first.milestone ? { milestone: first.milestone } : {}),
      acceptance: [
        `Every line of ${named}'s acceptance has a test, both sides of each condition — empty and full, each choice, signed in and out where it applies — written from what was asked, not from the code`,
        'A test that fails because the work does not do what was asked is not bent to pass: it is told to the lead (task tell), naming the line',
        'A case the project’s data never shows (an age the data has no dog of, an empty list) is held by a unit test of the module that decides it, and told to the lead: a page spec cannot see it',
        ...testChecks(files, setup.served)
      ]
    };
  });

  const tasks = plan.tasks.map(task => {
    const breaks = touched.get(task.id);

    return breaks === undefined ? task : { ...task, touches: [...new Set([...(task.touches ?? []), ...breaks])] };
  });

  return { plan: { ...plan, tasks: [...tasks, ...added] }, added: added.map(task => task.id), untested };
};
