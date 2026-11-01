import { rolesGrant } from '@plitzi/sdk-shared/auth';
import { pageAccessOf } from '@plitzi/sdk-shared/schema';

import { targetId } from './page';
import { isExpectation } from './play';
import { parseRelation, relationElements } from './position';
import { pageAt } from '../../schema/route';

import type { E2eAccount, E2eStep, E2eTest, Schema, UnitTest } from '@plitzi/sdk-shared';

/** A test account's id: letters, digits, `-` and `_`. */
const NAME = /^[A-Za-z0-9_-]+$/;

/** A journey's tag: a word or two, lower case — one spelling, so `Sign-in` and `sign-in` are never two chips. */
const TAG = /^[a-z0-9][a-z0-9_-]{0,31}$/;

/** What is wrong with a journey's tags: one no tag may be, or one said twice. */
const tagProblems = (at: string, tags: readonly string[]): string[] => [
  ...tags
    .filter(tag => !TAG.test(tag))
    .map(
      tag => `${at}: the tag "${tag}" is no word — lower case letters, digits, - and _, up to 32: sign-in, onboarding`
    ),
  ...[...new Set(tags.filter((tag, index) => tags.indexOf(tag) !== index))].map(
    tag => `${at}: the tag "${tag}" is said twice — once is enough`
  )
];

/** What is wrong with the test accounts as declared: an id no account may have, or one twice. */
const accountProblems = (accounts: readonly E2eAccount[]): string[] => {
  const seen = new Set<string>();

  return accounts.flatMap(account => {
    const at = `test account "${account.id}"`;
    const twice = seen.has(account.id);
    seen.add(account.id);

    return [
      ...(NAME.test(account.id) ? [] : [`${at}: an id is letters, digits, - and _ — editor, visitor-pro`]),
      ...(twice ? [`${at}: its id is another test account's — each has its own`] : [])
    ];
  });
};

/**
 * What a test account holds that the space no longer gives (`test-account-role-gone`): a visitor role removed from
 * `settings.visitorRoles` since it was chosen. Warned, never refused — the journey plays without it, and says so.
 */
export const testAccountWarnings = (
  document: Schema,
  accounts: readonly E2eAccount[] = document.tests?.accounts ?? []
): string[] =>
  accounts.flatMap(account =>
    rolesGrant(document.settings.visitorRoles, account.roles ?? []).missing.map(
      role =>
        `test account "${account.id}": the space has no role "${role}" — removed from its visitor roles since, or never there; a journey plays it without it: choose one the space has`
    )
  );

/**
 * Where a journey starts that its visitor may not be (`journey-start-access`): a page for signed-in visitors played as a
 * guest — who is sent to sign in there — or a page that asks permissions its account's roles do not give, withheld from
 * it. Warned, never refused: a journey may mean to test the door itself.
 */
export const journeyStartWarnings = (
  document: Schema,
  tests: readonly E2eTest[] = document.tests?.e2e ?? []
): string[] =>
  tests.flatMap(test => {
    const { action, pageId } = pageAt(document, test.page, { signedIn: true });
    const attributes =
      pageId === undefined || action !== 'normal' || !Object.hasOwn(document.flat, pageId)
        ? undefined
        : document.flat[pageId].attributes;
    if (!attributes) {
      return [];
    }

    const access = pageAccessOf(attributes);
    if (test.as === undefined) {
      return attributes.accessLevel === 'authenticated' || access
        ? [
            `journey "${test.id}": it starts on ${test.page} as a guest, and that page is for signed-in visitors — a guest is sent to sign in there: play it as one of the test accounts, or start on a page a guest opens (keep it if the door is what it checks)`
          ]
        : [];
    }

    const account = document.tests?.accounts?.find(each => each.id === test.as);
    const given = account ? rolesGrant(document.settings.visitorRoles, account.roles ?? []).permissions : [];
    const lacks = account && access ? access.permissions.filter(permission => !given.includes(permission)) : [];

    return lacks.length > 0
      ? [
          `journey "${test.id}": it starts on ${test.page} as ${test.as}, whose roles do not give ${lacks.join(', ')} — the page asks every one of its permissions, and is withheld from it: give the account a role that grants them, or start where it may be`
        ]
      : [];
  });

/** The element a step names, if it names one. */
const named = (step: E2eStep): string | undefined => ('element' in step ? step.element : undefined);

/**
 * What is wrong with the document's e2e tests as written, every problem at once, each naming the test, the step and the
 * fix — held before a browser opens: a page no address answers, an element the space has nowhere, a relation that is
 * none, a clock moved that the test does not hold.
 */
export const e2eTestProblems = (
  document: Schema,
  tests: readonly E2eTest[] = document.tests?.e2e ?? [],
  /** The element checks a step may hold (`expectCheck`): the document's, unless the caller edits others. */
  checks: readonly UnitTest[] = document.tests?.unit ?? [],
  /** The test accounts a test may play as (`as`): the document's, unless the caller edits others. */
  accounts: readonly E2eAccount[] = document.tests?.accounts ?? []
): string[] => {
  const accountIds = new Set(accounts.map(account => account.id));
  const checkIds = new Set(checks.map(check => check.id));
  // Every element a page draws, a component's parts too: what a step may name.
  const elements = new Set([
    ...Object.keys(document.flat),
    ...Object.values(document.components).flatMap(component => Object.keys(component.flat))
  ]);
  const problems: string[] = [...accountProblems(accounts)];
  const seen = new Set<string>();
  for (const test of tests) {
    const at = `e2e test "${test.id}"`;
    if (seen.has(test.id)) {
      problems.push(`${at}: its id is another e2e test's — each has its own`);
    }

    seen.add(test.id);
    // A page answers it — the space's own not-found page too: a flow may start on a wrong address to test that page.
    const answered = [false, true].some(signedIn => {
      const page = pageAt(document, test.page, { signedIn });

      return page.action === 'normal' || (page.action === 'notFound' && page.pageId !== undefined);
    });
    if (!answered) {
      problems.push(`${at}: no page of the space answers ${test.page} — a path one of its pages has`);
    }

    if (test.as !== undefined && !accountIds.has(test.as)) {
      problems.push(
        `${at}: it plays as "${test.as}", which is none of the test accounts — declare it in tests.accounts, or play it as a guest`
      );
    }

    problems.push(...tagProblems(at, test.tags ?? []));
    if (test.width !== undefined && (test.width < 200 || test.width > 4000)) {
      problems.push(`${at}: a width of ${String(test.width)} px is no screen's — 390, 768 or 1440`);
    }

    if (test.clock !== undefined && Number.isNaN(Date.parse(test.clock))) {
      problems.push(`${at}: its clock "${test.clock}" is no instant — 2026-10-30T09:00:00Z`);
    }

    if (test.steps.length === 0) {
      problems.push(`${at}: it has no steps — what a visitor does, and what must hold`);
    }

    if (!test.steps.some(isExpectation)) {
      problems.push(`${at}: it expects nothing, so it holds nothing — an expectation where the page must be something`);
    }

    test.steps.forEach((step, index) => {
      const where = `${at}, step ${String(index + 1)} (${step.kind})`;
      const element = named(step);
      if (element !== undefined && !elements.has(targetId(element))) {
        problems.push(`${where}: no element "${targetId(element)}" in the space — name one by its id`);
      }

      if (step.kind === 'tick' && test.clock === undefined) {
        problems.push(`${where}: it moves the page's clock, which the test holds only with its own clock`);
      }

      if (step.kind === 'expectCheck' && !checkIds.has(step.check)) {
        problems.push(
          `${where}: no element check of the space is "${step.check}" — name one of its tests.unit by its id`
        );
      }

      if (step.kind === 'expectPosition') {
        const relation = parseRelation(step.relation);
        if ('problem' in relation) {
          problems.push(`${where}: ${relation.problem}`);
        } else {
          for (const each of relationElements(relation).filter(id => !elements.has(targetId(id)))) {
            problems.push(`${where}: no element "${targetId(each)}" in the space — name one by its id`);
          }
        }
      }

      if (step.kind === 'expectStyle' && step.at !== undefined && Number.isNaN(Number.parseFloat(step.value))) {
        problems.push(`${where}: ${step.at} holds a number — 44px`);
      }
    });
  }

  return problems;
};
