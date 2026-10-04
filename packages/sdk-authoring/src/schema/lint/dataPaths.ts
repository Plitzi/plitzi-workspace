import { textOf } from './context';
import { followPath, isWrongPath, pathSteps, stoppedAt } from '../dataPath';

import type { LintContext } from './context';

/** What a provider publishes beside its answer: its state, which every binding may read too. */
const PUBLISHED_STATE = { isLoading: false, isEmpty: false, hasError: false, errorMessage: '', isStale: false };

const PROVIDER = 'apiContainer_';

/**
 * Every binding onto a provider whose answer the author can read (`data` — a JSON file the project serves), held to
 * that answer: a path it does not have is the binding that renders nothing, found where it is written instead of on a
 * page that was served empty. A provider fed by a connector or an action publishes its own slice, which no file says,
 * and a `query` with `{{tokens}}` is asked of the visitor's route and state: both are left unchecked.
 */
export const lintDataPaths = (ctx: LintContext): void => {
  const answerOf = ctx.catalogs.data;
  if (!answerOf) {
    return;
  }

  const answers = new Map<string, unknown>();
  const answer = (providerId: string): unknown => {
    if (answers.has(providerId)) {
      return answers.get(providerId);
    }

    const provider = ctx.flat[providerId] as (typeof ctx.flat)[string] | undefined;
    const query = textOf(provider?.attributes.query);
    const fed = ['connector', 'action'].some(key => textOf(provider?.attributes[key]) !== '');
    const sample = provider && query && !fed && !query.includes('{{') ? answerOf(query) : undefined;
    const published = sample === undefined ? undefined : { status: 200, data: sample, ...PUBLISHED_STATE };
    answers.set(providerId, published);

    return published;
  };

  for (const element of Object.values(ctx.flat)) {
    for (const binding of Object.values(element.definition.bindings ?? {}).flat()) {
      if (binding.enabled === false || !binding.source.startsWith(PROVIDER)) {
        continue;
      }

      const [root, ...path] = pathSteps(binding.source);
      const published = answer(root.slice(PROVIDER.length));
      if (published === undefined) {
        continue;
      }

      const reach = followPath(published, path);
      const rows = element.definition.type === 'list' && binding.to === 'items';
      if (!reach.found && isWrongPath(reach, path.length, rows)) {
        const query = textOf(ctx.element(root.slice(PROVIDER.length))?.attributes.query);
        ctx.warn(
          'path-not-in-data',
          `${ctx.describe(element.id)} reads \`${binding.source}\` for its ${binding.to}, and ${query} has no such path — ${stoppedAt(root, reach)}.`,
          element.id,
          { source: binding.source }
        );
      }
    }
  }
};
