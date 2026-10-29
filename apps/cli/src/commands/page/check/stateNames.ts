import { isRecord } from '@plitzi/sdk-shared/helpers';

import type { CheckIssue } from './types';

/**
 * What `--state` names of what the page holds: a source or a key by its name, or a path into one (`computed.layerQuakes`)
 * — each under the name it was asked by. A source is named by its element's id too (`storms-feed` for
 * `apiContainer_storms-feed`): a run's lead asked by the id it wrote, and read `{}` with no word.
 */
export const namedOf = (held: Record<string, unknown>, names: readonly string[]): Record<string, unknown> =>
  Object.fromEntries(
    names.flatMap(name => {
      const at = heldAt(held, name);

      return at === undefined ? [] : [[name, at] as const];
    })
  );

/** The source whose element has `id`: its key is `<type>_<id>` (`list_contacts`). */
const byElementId = (held: Record<string, unknown>, id: string): string | undefined => {
  const keys = Object.keys(held).filter(key => key.endsWith(`_${id}`) && /^[A-Za-z]+_/.test(key));

  return keys.length === 1 ? keys[0] : undefined;
};

const heldAt = (held: Record<string, unknown>, name: string): unknown => {
  if (Object.hasOwn(held, name)) {
    return held[name];
  }

  const [first = '', ...path] = name.split('.');
  const key = Object.hasOwn(held, first) ? first : byElementId(held, first);
  let at: unknown = key === undefined ? undefined : held[key];
  for (const part of path) {
    at = isRecord(at) ? at[part] : undefined;
  }

  return key !== undefined && (path.length > 0 || key !== name) ? at : undefined;
};

/**
 * The names `--state` asked that the page holds nothing by — no state key, no source, no element's source — said as an
 * issue with what it holds: a name that reads nothing is a line written wrong, never an empty answer.
 */
export const unheldNames = (
  state: Record<string, unknown> | undefined,
  sources: Record<string, unknown> | undefined,
  names: readonly string[],
  width: number
): CheckIssue[] => {
  const unheld = names.filter(
    name =>
      (state === undefined || heldAt(state, name) === undefined) &&
      (sources === undefined || heldAt(sources, name) === undefined)
  );

  return unheld.map(name => ({
    code: 'state-unheld' as const,
    message: `--state ${name}: the page holds no state key or source by that name${sources ? ` — its sources: ${Object.keys(sources).join(', ') || 'none'}` : ''}${state ? `; its state: ${Object.keys(state).join(', ') || 'nothing'}` : ''}`,
    width
  }));
};
