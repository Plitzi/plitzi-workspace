import { sameValue } from '@plitzi/sdk-shared/history';

import { resolveElement } from './resolveElement';

import type { ResolvedElement } from './resolveElement';
import type { Schema, UnitExpectation, UnitTest } from '@plitzi/sdk-shared';

/** How one unit test went: what each expectation it missed read, or why it could not run. */
export interface UnitResult {
  id: string;
  title: string;
  ok: boolean;
  /** One line an expectation it missed: what was expected, and what was read. */
  misses: string[];
  /** Why it could not run at all: an element no page has. */
  problem?: string;
}

export interface UnitReport {
  passed: number;
  failed: number;
  results: UnitResult[];
}

const shown = (value: unknown): string => (value === undefined ? 'nothing' : JSON.stringify(value));

/** A CSS property as the SDK writes it inline: `background-color` → `backgroundColor`; a custom property as named. */
const inlineName = (property: string): string =>
  property.startsWith('--') ? property : property.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());

/** The expectation missed, said with what was read — or nothing when it holds. */
const missOf = (resolved: ResolvedElement, expectation: UnitExpectation): string | undefined => {
  switch (expectation.kind) {
    case 'visible':
      return resolved.visible === expectation.value
        ? undefined
        : `${expectation.value ? 'shown' : 'hidden'} expected, it is ${resolved.visible ? 'shown' : 'hidden'}`;
    case 'attribute': {
      const read = resolved.attributes[expectation.name];

      return sameValue(read, expectation.value)
        ? undefined
        : `${expectation.name} ${shown(expectation.value)} expected, it is ${shown(read)}`;
    }
    case 'style': {
      const name = inlineName(expectation.property);
      const read = Object.hasOwn(resolved.style, name) ? resolved.style[name] : undefined;

      return read === expectation.value
        ? undefined
        : `${expectation.property} ${expectation.value} expected, it is ${read ?? 'not written'}`;
    }
    case 'variant': {
      const read = resolved.styleVariant[expectation.className] ?? '';

      return read === expectation.value
        ? undefined
        : `${expectation.className}'s variant ${expectation.value || 'its base'} expected, it is ${read || 'its base'}`;
    }
    case 'state': {
      const read = resolved.initialState[expectation.key];

      return sameValue(read, expectation.value)
        ? undefined
        : `state ${expectation.key} ${shown(expectation.value)} expected, it is ${shown(read)}`;
    }
  }
};

/** One unit test run against the document: its element resolved for what it gives, each expectation held. */
export const runUnitTest = (document: Schema, test: UnitTest): UnitResult => {
  let resolved: ResolvedElement;
  try {
    resolved = resolveElement(document, test.element, test.given);
  } catch (error) {
    const problem = error instanceof Error ? error.message : String(error);

    return { id: test.id, title: test.title, ok: false, misses: [], problem };
  }

  const misses = test.expect.flatMap(expectation => missOf(resolved, expectation) ?? []);

  return { id: test.id, title: test.title, ok: misses.length === 0, misses };
};

/** The document's unit tests — or those given — each run against it. */
export const runUnitTests = (document: Schema, tests: readonly UnitTest[] = document.tests?.unit ?? []): UnitReport => {
  const results = tests.map(test => runUnitTest(document, test));
  const passed = results.filter(result => result.ok).length;

  return { passed, failed: results.length - passed, results };
};

/** The report as a person reads it: a line a test, what each failed one missed under it. */
export const unitReportText = (report: UnitReport): string[] => [
  ...report.results.flatMap(result =>
    result.ok
      ? [`✓ ${result.id} — ${result.title}`]
      : [
          `✗ ${result.id} — ${result.title}`,
          ...(result.problem ? [`  ${result.problem}`] : result.misses.map(miss => `  ${miss}`))
        ]
  ),
  `${String(report.passed)} passed, ${String(report.failed)} failed`
];
