import { PROJECT_DATA_PREFIX } from '@plitzi/sdk-shared/server/rsc/projectData';

import { textOf } from './context';
import { followPath, isWrongPath, pathSteps, stoppedAt } from '../dataPath';

import type { LintContext } from './context';

/** What a provider publishes beside its answer: its state, which every binding may read too. */
const PUBLISHED_STATE = { isLoading: false, isEmpty: false, hasError: false, errorMessage: '', isStale: false };

const PROVIDER = 'apiContainer_';

/**
 * A provider asking for the project's own data (`/data/…`, kept where the server reads it and never serves it) from the
 * browser: it is answered nothing there, and renders its error state on every page that holds it.
 */
const lintServerDataReads = (ctx: LintContext): void => {
  for (const element of Object.values(ctx.flat)) {
    const query = textOf(element.attributes.query);
    const fed = ['connector', 'action'].some(key => textOf(element.attributes[key]) !== '');
    if (!query.startsWith(PROJECT_DATA_PREFIX) || fed || element.definition.runtime === 'server') {
      continue;
    }

    ctx.error(
      'server-data-in-browser',
      `${ctx.describe(element.id)} asks for ${query} from the browser, and the project's data (\`src/data/\`) is read by its server alone — never served, so the browser is answered nothing. Give it \`runtime: 'server'\`: the page then arrives with the data in it.`,
      element.id
    );
  }
};

/**
 * Every binding onto a provider whose answer the author can read (`data` — a JSON file the project serves), held to
 * that answer: a path it does not have is the binding that renders nothing, found where it is written instead of on a
 * page that was served empty. A provider fed by a connector or an action publishes its own slice, which no file says,
 * and a `query` with `{{tokens}}` is asked of the visitor's route and state: both are left unchecked.
 */
export const lintDataPaths = (ctx: LintContext): void => {
  const { data, serverData } = ctx.catalogs;
  if (!data && !serverData) {
    return;
  }

  // The project's own data first: `/data/…` is its, wherever `public/` has a folder of that name — as the server reads.
  const answerOf = (query: string): unknown => serverData?.(query) ?? data?.(query);

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

  if (serverData) {
    lintServerDataReads(ctx);
  }

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
