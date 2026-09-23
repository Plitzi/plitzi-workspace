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
