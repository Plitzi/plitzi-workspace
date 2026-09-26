import deepEqual from '@plitzi/plitzi-ui/utils/deepEqual';

import { processTwigValue } from '../helpers/twigWrapper';

/**
 * The space's computed values, from its definitions and the global sources they read.
 *
 * In declaration order, each one seeing the values before it as `computed.<name>` — so `level` can be written over
 * `xp` without repeating it. A value that reads one declared after it reads nothing; authoring refuses that.
 *
 * Given the `previous` evaluation, a value that comes out the same keeps the object it was, and so does the whole
 * when none changed. They are all evaluated again whenever the state changes, and a list or a record evaluates to a new
 * object every time: every element reading one — a star on each of a hundred and sixty library items reading the
 * favourites — rendered again for the tool in hand changing, because what it read was no longer the same object.
 */
export const evaluateComputed = (
  definitions: Record<string, string>,
  globals: Record<string, unknown>,
  previous?: Record<string, unknown>
): Record<string, unknown> => {
  const computed: Record<string, unknown> = {};
  let unchanged = previous !== undefined && Object.keys(previous).length === Object.keys(definitions).length;
  for (const [name, template] of Object.entries(definitions)) {
    const value = processTwigValue(template, { ...globals, computed: { ...computed } });
    const before = previous?.[name];
    const same =
      previous !== undefined && Object.hasOwn(previous, name) && (before === value || deepEqual(before, value));
    computed[name] = same ? before : value;
    unchanged &&= same;
  }

  return unchanged && previous ? previous : computed;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isDefinitions = (value: unknown): value is Record<string, string> =>
  isRecord(value) && Object.values(value).every(template => typeof template === 'string');

/** The globals a computed value is evaluated over — the same ones `GlobalSources` hands it on render. */
const COMPUTED_GLOBALS = ['variables', 'navigation', 'auth', 'host', 'theme'] as const;

/**
 * The sources as a flow step reads them: `state` as the store holds it this instant, and `computed` evaluated over it.
 *
 * `runtime.sources` carries both as the last render left them — they are copied there after React renders — so a step
 * reading them right after an earlier step wrote the state could see the value from before the write, or not,
 * depending on whether React had rendered in between. Read here, a step always sees every write made before it: the
 * flow's own and anything else that happened while it waited.
 */
export const liveSources = (
  sources: Record<string, unknown>,
  state: unknown,
  definitions: unknown
): Record<string, unknown> => {
  const current = isRecord(state) ? state : {};
  if (!isDefinitions(definitions)) {
    return { ...sources, state: current };
  }

  return { ...sources, state: current, computed: computedOver(definitions, sources, current) };
};

/**
 * The last evaluation, and what it was evaluated over.
 *
 * A flow reads its sources before every step — and before every `when` — so that a step sees what the steps before
 * it wrote; with a space's computed values evaluated each time, a twenty-step flow over a hundred computed values was
 * four thousand templates, run again on every pointer move that fired it. What they are evaluated over is the store's
 * own immutable snapshots — `state`, the definitions, each global source — so the same references are the same
 * answer, and only a read after an actual change evaluates again.
 */
let lastEvaluation:
  | {
      definitions: Record<string, string>;
      state: Record<string, unknown>;
      globals: unknown[];
      computed: Record<string, unknown>;
    }
  | undefined;

const computedOver = (
  definitions: Record<string, string>,
  sources: Record<string, unknown>,
  state: Record<string, unknown>
): Record<string, unknown> => {
  const globals = COMPUTED_GLOBALS.map(name => sources[name]);
  if (
    lastEvaluation?.definitions === definitions &&
    lastEvaluation.state === state &&
    lastEvaluation.globals.every((value, index) => value === globals[index])
  ) {
    return lastEvaluation.computed;
  }

  const computed = evaluateComputed(
    definitions,
    { ...Object.fromEntries(COMPUTED_GLOBALS.map((name, index) => [name, globals[index]])), state },
    lastEvaluation?.definitions === definitions ? lastEvaluation.computed : undefined
  );
  lastEvaluation = { definitions, state, globals, computed };

  return computed;
};
