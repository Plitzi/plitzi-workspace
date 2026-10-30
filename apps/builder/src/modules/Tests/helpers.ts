import type { E2eStep, E2eTest, SpaceTests, UnitExpectation, UnitTest } from '@plitzi/sdk-shared';

/**
 * The space's tests as the builder edits them (RFC 0031): two kinds kept apart — unit tests, one element resolved with
 * no browser, and e2e tests, a visitor's steps on a page — each edited as a list of rows whose fields its kind says.
 */

/** What a field of a row holds: words, a number, any value (JSON when it reads as JSON), or an element of the space. */
export type FieldKind = 'text' | 'number' | 'value' | 'element';

export type FieldSpec = { name: string; label: string; kind: FieldKind };

export type KindSpec = { label: string; fields: FieldSpec[] };

/** What must hold of a unit test's element, by kind. */
export const UNIT_KINDS: Record<UnitExpectation['kind'], KindSpec> = {
  visible: { label: 'Shows', fields: [{ name: 'value', label: 'Shown (true / false)', kind: 'value' }] },
  attribute: {
    label: 'Attribute is',
    fields: [
      { name: 'name', label: 'Attribute', kind: 'text' },
      { name: 'value', label: 'Value', kind: 'value' }
    ]
  },
  style: {
    label: 'Style is',
    fields: [
      { name: 'property', label: 'CSS property', kind: 'text' },
      { name: 'value', label: 'Value', kind: 'text' }
    ]
  },
  variant: {
    label: 'Variant is',
    fields: [
      { name: 'className', label: 'Class', kind: 'text' },
      { name: 'value', label: 'Variant (empty: its base)', kind: 'text' }
    ]
  },
  state: {
    label: 'State key is',
    fields: [
      { name: 'key', label: 'Key', kind: 'text' },
      { name: 'value', label: 'Value', kind: 'value' }
    ]
  }
};

const element = (label = 'Element'): FieldSpec => ({ name: 'element', label, kind: 'element' });

/** A step of an e2e test — something done, or something that must hold — by kind. */
export const STEP_KINDS: Record<E2eStep['kind'], KindSpec> = {
  click: { label: 'Click', fields: [element()] },
  hover: { label: 'Hover', fields: [element()] },
  type: { label: 'Type', fields: [element('Field'), { name: 'text', label: 'Text', kind: 'text' }] },
  press: { label: 'Press a key', fields: [{ name: 'key', label: 'Key (Enter, Meta+k)', kind: 'text' }] },
  scroll: {
    label: 'Scroll',
    fields: [
      element(),
      { name: 'dx', label: 'Across (px)', kind: 'number' },
      { name: 'dy', label: 'Down (px)', kind: 'number' }
    ]
  },
  drag: {
    label: 'Drag',
    fields: [
      element(),
      { name: 'dx', label: 'Across (px)', kind: 'number' },
      { name: 'dy', label: 'Down (px)', kind: 'number' }
    ]
  },
  waitFor: { label: 'Wait for', fields: [element()] },
  goto: { label: 'Go to', fields: [{ name: 'path', label: 'Path', kind: 'text' }] },
  back: { label: 'Back', fields: [] },
  reload: { label: 'Reload', fields: [] },
  setState: {
    label: 'Set state',
    fields: [
      { name: 'key', label: 'Key', kind: 'text' },
      { name: 'value', label: 'Value', kind: 'value' }
    ]
  },
  setSource: {
    label: 'Set a source',
    fields: [
      { name: 'path', label: 'Path (apiContainer_feed.items)', kind: 'text' },
      { name: 'value', label: 'Value', kind: 'value' }
    ]
  },
  tick: { label: 'Move the clock', fields: [{ name: 'ms', label: 'Milliseconds', kind: 'number' }] },
  expectShown: { label: 'Expect shown', fields: [element()] },
  expectHidden: { label: 'Expect hidden', fields: [element()] },
  expectText: { label: 'Expect text', fields: [element(), { name: 'text', label: 'Text', kind: 'text' }] },
  expectState: {
    label: 'Expect state',
    fields: [
      { name: 'key', label: 'Key', kind: 'text' },
      { name: 'value', label: 'Value', kind: 'value' }
    ]
  },
  expectAttribute: {
    label: 'Expect attribute',
    fields: [
      element(),
      { name: 'name', label: 'Attribute', kind: 'text' },
      { name: 'value', label: 'Value', kind: 'text' }
    ]
  },
  expectStyle: {
    label: 'Expect style',
    fields: [
      element(),
      { name: 'property', label: 'CSS property', kind: 'text' },
      { name: 'value', label: 'Value', kind: 'text' }
    ]
  },
  expectPosition: {
    label: 'Expect position',
    fields: [{ name: 'relation', label: 'Relation (a.bottom + 8 <= b.top)', kind: 'text' }]
  }
};

/** The widths an e2e test is played at, as the builder offers them. */
export const WIDTHS = [
  { value: 390, label: 'Phone · 390' },
  { value: 768, label: 'Tablet · 768' },
  { value: 1440, label: 'Desktop · 1440' }
];

/** An id no test of the list has: `<prefix>-1`, `<prefix>-2`… */
export const nextId = (prefix: string, taken: readonly { id: string }[]): string => {
  const ids = new Set(taken.map(test => test.id));
  let index = taken.length + 1;
  while (ids.has(`${prefix}-${String(index)}`)) {
    index += 1;
  }

  return `${prefix}-${String(index)}`;
};

export const newUnitTest = (element: string, taken: readonly UnitTest[]): UnitTest => ({
  id: nextId('unit', taken),
  title: '',
  element,
  given: { state: {} },
  expect: [{ kind: 'visible', value: true }]
});

export const newE2eTest = (page: string, taken: readonly E2eTest[]): E2eTest => ({
  id: nextId('e2e', taken),
  title: '',
  page,
  width: 1440,
  steps: []
});

/** A row of a kind, its fields as the kind starts them: an element field the element given, the rest empty. */
export const emptyOf = (kind: string, spec: KindSpec, elementId: string): Row => ({
  kind,
  ...Object.fromEntries(
    spec.fields.map(field => [
      field.name,
      field.kind === 'element' ? elementId : field.kind === 'number' ? 0 : field.kind === 'value' ? true : ''
    ])
  )
});

/** What a value field shows: words as they are, anything else as JSON. */
export const valueText = (value: unknown): string =>
  typeof value === 'string' ? value : value === undefined ? '' : JSON.stringify(value);

/** What a value field holds: what it reads as JSON — a number, true, a list — or else its words. */
export const valueOf = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

/** A list with the test of `id` replaced — added when none is — or, given none, removed. */
const replaced = <T extends { id: string }>(list: readonly T[], test: T | undefined, id: string): T[] => {
  if (test === undefined) {
    return list.filter(each => each.id !== id);
  }

  return list.some(each => each.id === id) ? list.map(each => (each.id === id ? test : each)) : [...list, test];
};

/** The tests with one unit test saved under `id`, or removed: what is saved whole. */
export const withUnitTest = (tests: SpaceTests, test: UnitTest | undefined, id: string): SpaceTests => ({
  ...tests,
  unit: replaced(tests.unit ?? [], test, id)
});

/** The tests with one e2e test saved under `id`, or removed: what is saved whole. */
export const withE2eTest = (tests: SpaceTests, test: E2eTest | undefined, id: string): SpaceTests => ({
  ...tests,
  e2e: replaced(tests.e2e ?? [], test, id)
});

/** The elements a field may name, as the builder lists them: its label or type, and its id. */
export const elementOptions = (flat: Record<string, { definition: { label?: string; type: string } }>) =>
  Object.entries(flat)
    .map(([id, element]) => ({ value: id, label: `${element.definition.label || element.definition.type} · ${id}` }))
    .sort((a, b) => a.label.localeCompare(b.label));

/** A row as the builder edits it: a kind and the fields it took. */
export type Row = { kind: string } & Record<string, unknown>;

/**
 * A row as a unit test's expectation. Its fields are held by the server's reader (`readSpaceTests`) as it saves — a
 * field missing refuses the save, saying which — so the record is sent as the row reads.
 */
export const expectationOf = (row: Row): UnitExpectation => row as unknown as UnitExpectation;

/** A row as an e2e test's step, held by the server's reader as it saves (see `expectationOf`). */
export const stepOf = (row: Row): E2eStep => row as unknown as E2eStep;

/** A list with the row at `index` moved by `by` places, or the list as it was past either end. */
export const moved = <T>(list: readonly T[], index: number, by: number): T[] => {
  const to = index + by;
  if (to < 0 || to >= list.length) {
    return [...list];
  }

  const next = [...list];
  const [row] = next.splice(index, 1);
  next.splice(to, 0, row);

  return next;
};

/** The step a run is shown at first: the one that failed, else the last played. */
export const shownStepOf = (steps: readonly { ok: boolean; notRun?: true }[]): number => {
  const failed = steps.findIndex(step => !step.ok && step.notRun !== true);
  if (failed >= 0) {
    return failed;
  }

  const played = steps.filter(step => step.notRun !== true).length;

  return Math.max(0, played - 1);
};

/** How wide the device frame draws a page of a width: a phone at its size, anything wider scaled to fit. */
export const frameWidthOf = (width: number): number => Math.min(width, 390);
