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
  hover: { label: 'Point at', fields: [element()] },
  type: { label: 'Type into a field', fields: [element('Field'), { name: 'text', label: 'Text', kind: 'text' }] },
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
  waitFor: { label: 'Wait for it to show', fields: [element()] },
  goto: { label: 'Go to a page', fields: [{ name: 'path', label: 'Page address (/pricing)', kind: 'text' }] },
  back: { label: 'Go back', fields: [] },
  reload: { label: 'Reload the page', fields: [] },
  setState: {
    label: 'Set a state value',
    fields: [
      { name: 'key', label: 'Key', kind: 'text' },
      { name: 'value', label: 'Value', kind: 'value' }
    ]
  },
  setSource: {
    label: 'Set data',
    fields: [
      { name: 'path', label: 'Path (apiContainer_feed.items)', kind: 'text' },
      { name: 'value', label: 'Value', kind: 'value' }
    ]
  },
  tick: { label: 'Let time pass', fields: [{ name: 'ms', label: 'Milliseconds', kind: 'number' }] },
  expectShown: { label: 'Check it shows', fields: [element()] },
  expectHidden: { label: 'Check it is hidden', fields: [element()] },
  expectText: { label: 'Check its words', fields: [element(), { name: 'text', label: 'Text', kind: 'text' }] },
  expectState: {
    label: 'Check a state value',
    fields: [
      { name: 'key', label: 'Key', kind: 'text' },
      { name: 'value', label: 'Value', kind: 'value' }
    ]
  },
  expectAttribute: {
    label: 'Check an attribute',
    fields: [
      element(),
      { name: 'name', label: 'Attribute', kind: 'text' },
      { name: 'value', label: 'Value', kind: 'text' }
    ]
  },
  expectStyle: {
    label: 'Check a style',
    fields: [
      element(),
      { name: 'property', label: 'CSS property', kind: 'text' },
      { name: 'value', label: 'Value', kind: 'text' }
    ]
  },
  expectPosition: {
    label: 'Check where it sits',
    fields: [{ name: 'relation', label: 'Relation (a.bottom + 8 <= b.top)', kind: 'text' }]
  }
};

/** A step's kind as a select names it — any string — to what it takes, or none for one no step is. */
const STEP_KIND_SPECS = new Map<string, KindSpec>(Object.entries(STEP_KINDS));

export const stepKindOf = (kind: string): KindSpec | undefined => STEP_KIND_SPECS.get(kind);

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

/**
 * What a person calls the element a step names: the label it was given — else its id, which a space's author chose — and
 * which copy, for one a list draws more than once.
 */
export const elementNameOf = (
  flat: Partial<Record<string, { definition: { label?: string; type: string } }>>,
  target: string
): string => {
  const match = /^(.+?)(?::(\d+|last))?$/.exec(target);
  const id = match?.[1] ?? target;
  const copy: string | undefined = match?.[2];
  const definition = flat[id]?.definition;
  // A label the builder gave by itself names the type ("Button"), and says nothing of WHICH button.
  const bare = (words: string) => words.replace(/[^a-z0-9]/gi, '').toLowerCase();
  const labelled = definition?.label && bare(definition.label) !== bare(definition.type);
  const name = labelled ? (definition.label ?? id) : id;

  return copy === undefined ? name : `${name} (${copy === 'last' ? 'the last' : `#${copy}`})`;
};

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

/** A step of a flow, where it sits in it. */
export type PlacedStep = { step: E2eStep; index: number };

/** One moment of a flow: something done — none for the page as it opens — and what must hold once it is. */
export type FlowMoment = { action?: PlacedStep; checks: PlacedStep[] };

const EXPECTS = new Set<string>([
  'expectShown',
  'expectHidden',
  'expectText',
  'expectState',
  'expectAttribute',
  'expectStyle',
  'expectPosition'
]);

/**
 * A flow read as a person reads it: moments, each a thing done and the checks after it — "when this, then that". The
 * checks before anything is done are the page as it opens; a flow that checks nothing there does not start with one.
 */
export const momentsOf = (steps: readonly E2eStep[]): FlowMoment[] => {
  const moments: FlowMoment[] = [{ checks: [] }];
  steps.forEach((step, index) => {
    const placed = { step, index };
    if (EXPECTS.has(step.kind)) {
      moments[moments.length - 1].checks.push(placed);
    } else {
      moments.push({ action: placed, checks: [] });
    }
  });

  return moments[0].checks.length === 0 ? moments.slice(1) : moments;
};

/** A problem the server said of a test, taken apart: which kind of test, its id, the step if one, what is wrong. */
const parseProblem = (problem: string) => {
  const match = /^(e2e|unit) test "([^"]+)"(?:, step (\d+) \((\w+)\))?: (.*)$/.exec(problem);
  if (!match) {
    return undefined;
  }

  const [, kind, id, step, , said] = match;

  // A sentence, as it is read beside others: capitalised, and closed.
  const sentence = said.charAt(0).toUpperCase() + said.slice(1);

  return { kind, id, step, said: /[.!?]$/.test(sentence) ? sentence : `${sentence}.` };
};

/**
 * A problem the server said of a test, as the person reads it: the test by the title they gave it — not its id — and
 * what is wrong with it, a sentence.
 */
export const problemInWords = (problem: string, tests: SpaceTests): { test: string; said: string } => {
  const parsed = parseProblem(problem);
  if (!parsed) {
    return { test: '', said: problem };
  }

  const list: readonly { id: string; title: string }[] = (parsed.kind === 'e2e' ? tests.e2e : tests.unit) ?? [];
  const title = list.find(each => each.id === parsed.id)?.title || parsed.id;

  return { test: parsed.step ? `${title}, step ${parsed.step}` : title, said: parsed.said };
};

/** What the server said is wrong with one test — of a kind, by its id — each a sentence; none when it said nothing. */
export const problemsOfTest = (problems: readonly string[], kind: 'e2e' | 'unit', id: string): string[] =>
  problems.flatMap(problem => {
    const parsed = parseProblem(problem);
    if (!parsed || parsed.kind !== kind || parsed.id !== id) {
      return [];
    }

    return [parsed.step ? `Step ${parsed.step}: ${parsed.said}` : parsed.said];
  });

/** The problems the server said of one kind of test — the flows', or the element checks' — each as it said it. */
export const problemsOfKind = (problems: readonly string[], kind: 'e2e' | 'unit'): string[] =>
  problems.filter(problem => parseProblem(problem)?.kind === kind);

/** The tests of a kind that need a look, by id, each once and in the order the server named them. */
export const testsNeedingLook = (problems: readonly string[], kind: 'e2e' | 'unit'): string[] => [
  ...new Set(
    problems.flatMap(problem => {
      const parsed = parseProblem(problem);

      return parsed?.kind === kind ? [parsed.id] : [];
    })
  )
];

/** What is wrong with one flow, by where it is fixed: where it starts, its device, a step, or the flow as a whole. */
export type FlowProblems = { page: string[]; device: string[]; steps: Map<number, string[]>; other: string[] };

/**
 * A flow's problems placed where they are fixed — the field or the step a person changes — so each is said beside it
 * rather than in a list apart.
 */
export const flowProblemsOf = (problems: readonly string[], id: string): FlowProblems => {
  const placed: FlowProblems = { page: [], device: [], steps: new Map(), other: [] };
  for (const problem of problems) {
    const parsed = parseProblem(problem);
    if (parsed?.kind !== 'e2e' || parsed.id !== id) {
      continue;
    }

    if (parsed.step) {
      const index = Number(parsed.step) - 1;
      placed.steps.set(index, [...(placed.steps.get(index) ?? []), parsed.said]);
    } else if (/no page of the space answers/i.test(parsed.said)) {
      placed.page.push(parsed.said);
    } else if (/a width of/i.test(parsed.said)) {
      placed.device.push(parsed.said);
    } else {
      placed.other.push(parsed.said);
    }
  }

  return placed;
};
