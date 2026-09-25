import { processTwigValue } from '../helpers/twigWrapper';

/**
 * The space's computed values, from its definitions and the global sources they read.
 *
 * In declaration order, each one seeing the values before it as `computed.<name>` — so `level` can be written over
 * `xp` without repeating it. A value that reads one declared after it reads nothing; authoring refuses that.
 */
export const evaluateComputed = (
  definitions: Record<string, string>,
  globals: Record<string, unknown>
): Record<string, unknown> => {
  const computed: Record<string, unknown> = {};
  for (const [name, template] of Object.entries(definitions)) {
    computed[name] = processTwigValue(template, { ...globals, computed: { ...computed } });
  }

  return computed;
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

  const globals = Object.fromEntries(COMPUTED_GLOBALS.map(name => [name, sources[name]]));

  return { ...sources, state: current, computed: evaluateComputed(definitions, { ...globals, state: current }) };
};
