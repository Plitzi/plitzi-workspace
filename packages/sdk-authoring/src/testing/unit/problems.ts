import type { Schema, UnitTest } from '@plitzi/sdk-shared';

/**
 * What is wrong with the document's unit tests as written, every problem at once, each naming the test and the fix —
 * held before they run, as the space itself is: an element no page has, a test with nothing to hold, an id twice.
 */
export const unitTestProblems = (
  document: Schema,
  tests: readonly UnitTest[] = document.tests?.unit ?? []
): string[] => {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const test of tests) {
    const at = `unit test "${test.id}"`;
    if (seen.has(test.id)) {
      problems.push(`${at}: its id is another unit test's — each has its own`);
    }

    seen.add(test.id);
    if (!Object.hasOwn(document.flat, test.element)) {
      problems.push(`${at}: no element "${test.element}" on the space's pages — name one by its id`);
    }

    if (test.expect.length === 0) {
      problems.push(`${at}: it expects nothing, so it holds nothing — say what must be true of ${test.element}`);
    }

    for (const expectation of test.expect) {
      if (expectation.kind === 'style' && !/^(?:--)?[a-z][a-z0-9-]*$/.test(expectation.property)) {
        problems.push(`${at}: "${expectation.property}" is no CSS property's name — background-color, height`);
      }
    }
  }

  return problems;
};
