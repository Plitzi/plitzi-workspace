import type { E2eAccount, E2eAction, E2eExpectation, E2eTarget, E2eTest } from '@plitzi/sdk-shared';

/**
 * E2e tests as code: `e2e.test({ page, steps: [e2e.click('add'), e2e.expectText('count', '1')] })` — the same records the
 * builder writes as it records a visitor, kept in the document's `tests.e2e`.
 */
export const e2e = {
  test: (test: E2eTest): E2eTest => test,
  /** Somebody a journey plays as, signed in (`as`): declared in `tests.accounts` alone — no account of the platform's. */
  account: (account: E2eAccount): E2eAccount => account,
  click: (element: E2eTarget): E2eAction => ({ kind: 'click', element }),
  hover: (element: E2eTarget): E2eAction => ({ kind: 'hover', element }),
  type: (element: E2eTarget, text: string): E2eAction => ({ kind: 'type', element, text }),
  press: (key: string): E2eAction => ({ kind: 'press', key }),
  scroll: (element: E2eTarget, { dx, dy }: { dx?: number; dy?: number }): E2eAction => ({
    kind: 'scroll',
    element,
    ...(dx === undefined ? {} : { dx }),
    ...(dy === undefined ? {} : { dy })
  }),
  drag: (element: E2eTarget, dx: number, dy: number): E2eAction => ({ kind: 'drag', element, dx, dy }),
  waitFor: (element: E2eTarget, ms?: number): E2eAction => ({ kind: 'waitFor', element, ...(ms ? { ms } : {}) }),
  goto: (path: string): E2eAction => ({ kind: 'goto', path }),
  back: (): E2eAction => ({ kind: 'back' }),
  reload: (): E2eAction => ({ kind: 'reload' }),
  setState: (key: string, value: unknown): E2eAction => ({ kind: 'setState', key, value }),
  setSource: (path: string, value: unknown): E2eAction => ({ kind: 'setSource', path, value }),
  tick: (ms: number): E2eAction => ({ kind: 'tick', ms }),
  expectShown: (element: E2eTarget): E2eExpectation => ({ kind: 'expectShown', element }),
  expectHidden: (element: E2eTarget): E2eExpectation => ({ kind: 'expectHidden', element }),
  expectText: (element: E2eTarget, text: string, { exact = false }: { exact?: boolean } = {}): E2eExpectation => ({
    kind: 'expectText',
    element,
    text,
    ...(exact ? { exact } : {})
  }),
  expectState: (key: string, value: unknown): E2eExpectation => ({ kind: 'expectState', key, value }),
  expectAttribute: (element: E2eTarget, name: string, value: string): E2eExpectation => ({
    kind: 'expectAttribute',
    element,
    name,
    value
  }),
  expectStyle: (element: E2eTarget, property: string, value: string, at?: '>=' | '<='): E2eExpectation => ({
    kind: 'expectStyle',
    element,
    property,
    value,
    ...(at ? { at } : {})
  }),
  expectPosition: (relation: string): E2eExpectation => ({ kind: 'expectPosition', relation }),
  expectCheck: (check: string): E2eExpectation => ({ kind: 'expectCheck', check })
};
