import { isRecord } from '@plitzi/sdk-shared/helpers';

import type { E2eStep, E2eTest, SpaceTests, UnitExpectation, UnitTest } from '@plitzi/sdk-shared';

/**
 * A document's tests as they arrive from outside — the builder's save, an agent's call, a file — read into their records,
 * or every way they are not one, each said with where it is: a record stored is one a runner can run.
 */

type Read<T> = { value: T } | { problems: string[] };

const isString = (value: unknown): value is string => typeof value === 'string' && value !== '';
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** The fields each kind of step needs, by kind, and what each must be. */
const STEP_FIELDS: Readonly<Record<E2eStep['kind'], Readonly<Record<string, 'string' | 'number' | 'any'>>>> = {
  click: { element: 'string' },
  hover: { element: 'string' },
  type: { element: 'string', text: 'any' },
  press: { key: 'string' },
  scroll: { element: 'string' },
  drag: { element: 'string', dx: 'number', dy: 'number' },
  waitFor: { element: 'string' },
  goto: { path: 'string' },
  back: {},
  reload: {},
  setState: { key: 'string', value: 'any' },
  setSource: { path: 'string', value: 'any' },
  tick: { ms: 'number' },
  expectShown: { element: 'string' },
  expectHidden: { element: 'string' },
  expectText: { element: 'string', text: 'any' },
  expectState: { key: 'string', value: 'any' },
  expectAttribute: { element: 'string', name: 'string', value: 'any' },
  expectStyle: { element: 'string', property: 'string', value: 'string' },
  expectPosition: { relation: 'string' }
};

const UNIT_FIELDS: Readonly<Record<UnitExpectation['kind'], Readonly<Record<string, 'string' | 'number' | 'any'>>>> = {
  visible: { value: 'any' },
  attribute: { name: 'string', value: 'any' },
  style: { property: 'string', value: 'string' },
  variant: { className: 'string', value: 'any' },
  state: { key: 'string', value: 'any' }
};

/** What a record is missing of the fields its kind needs, said by field. */
const fieldsMissing = (value: Record<string, unknown>, fields: Readonly<Record<string, string>>): string[] =>
  Object.entries(fields).flatMap(([name, kind]) => {
    const field = value[name];
    const ok = kind === 'string' ? isString(field) : kind === 'number' ? isNumber(field) : Object.hasOwn(value, name);

    return ok ? [] : [`${name}: ${kind === 'any' ? 'a value' : kind === 'number' ? 'a number' : 'words'}`];
  });

// A kind it names that the table holds: the key read off the table it was checked against.
const kindOf = <K extends string>(
  value: Record<string, unknown>,
  kinds: Readonly<Record<K, unknown>>
): K | undefined =>
  typeof value.kind === 'string' && Object.hasOwn(kinds, value.kind) ? (value.kind as K) : undefined;

const readUnit = (value: unknown, at: string): Read<UnitTest> => {
  if (!isRecord(value)) {
    return { problems: [`${at}: a test — { id, title, element, given?, expect }`] };
  }

  const problems = [
    ...fieldsMissing(value, { id: 'string', title: 'string', element: 'string' }).map(each => `${at}.${each}`),
    ...(value.given === undefined || isRecord(value.given) ? [] : [`${at}.given: { state?, sources? }`]),
    ...(Array.isArray(value.expect) ? [] : [`${at}.expect: a list of what must hold`])
  ];
  const expect = Array.isArray(value.expect) ? value.expect : [];
  expect.forEach((each: unknown, index) => {
    const where = `${at}.expect[${String(index)}]`;
    const kind = isRecord(each) ? kindOf(each, UNIT_FIELDS) : undefined;
    if (!isRecord(each) || kind === undefined) {
      problems.push(`${where}: one of ${Object.keys(UNIT_FIELDS).join(', ')}`);

      return;
    }

    problems.push(...fieldsMissing(each, UNIT_FIELDS[kind]).map(missing => `${where}.${missing}`));
  });

  // Every field of it read above, each as its kind says: what reaches here is the record.
  return problems.length > 0 ? { problems } : { value: value as unknown as UnitTest };
};

const readE2e = (value: unknown, at: string): Read<E2eTest> => {
  if (!isRecord(value)) {
    return { problems: [`${at}: a test — { id, title, page, steps }`] };
  }

  const problems = [
    ...fieldsMissing(value, { id: 'string', title: 'string', page: 'string' }).map(each => `${at}.${each}`),
    ...(value.width === undefined || isNumber(value.width) ? [] : [`${at}.width: a number of px`]),
    ...(value.scheme === undefined || value.scheme === 'light' || value.scheme === 'dark'
      ? []
      : [`${at}.scheme: light or dark`]),
    ...(value.clock === undefined || isString(value.clock) ? [] : [`${at}.clock: an instant, 2026-10-30T09:00:00Z`]),
    ...(value.answers === undefined ||
    (isRecord(value.answers) && Object.values(value.answers).every(answer => isRecord(answer)))
      ? []
      : [`${at}.answers: what each action answers, by its id — an object each`]),
    ...(Array.isArray(value.steps) ? [] : [`${at}.steps: a list of steps`])
  ];
  const steps = Array.isArray(value.steps) ? value.steps : [];
  steps.forEach((each: unknown, index) => {
    const where = `${at}.steps[${String(index)}]`;
    const kind = isRecord(each) ? kindOf(each, STEP_FIELDS) : undefined;
    if (!isRecord(each) || kind === undefined) {
      problems.push(`${where}: a step — ${Object.keys(STEP_FIELDS).join(', ')}`);

      return;
    }

    problems.push(...fieldsMissing(each, STEP_FIELDS[kind]).map(missing => `${where}.${missing}`));
  });

  // Every field of it read above, each as its kind says: what reaches here is the record.
  return problems.length > 0 ? { problems } : { value: value as unknown as E2eTest };
};

/** A document's tests read from anything — `{ unit?: [...], e2e?: [...] }` — or every way they are not. */
export const readSpaceTests = (value: unknown): { tests: SpaceTests } | { problems: string[] } => {
  if (!isRecord(value)) {
    return { problems: ['tests: { unit?: [...], e2e?: [...] }'] };
  }

  const problems: string[] = [];
  const read = <T>(list: unknown, name: 'unit' | 'e2e', each: (value: unknown, at: string) => Read<T>): T[] => {
    if (list === undefined) {
      return [];
    }

    if (!Array.isArray(list)) {
      problems.push(`tests.${name}: a list`);

      return [];
    }

    return list.flatMap((item: unknown, index) => {
      const result = each(item, `tests.${name}[${String(index)}]`);
      if ('problems' in result) {
        problems.push(...result.problems);

        return [];
      }

      return [result.value];
    });
  };
  const unit = read(value.unit, 'unit', readUnit);
  const e2e = read(value.e2e, 'e2e', readE2e);

  return problems.length > 0 ? { problems } : { tests: { unit, e2e } };
};
