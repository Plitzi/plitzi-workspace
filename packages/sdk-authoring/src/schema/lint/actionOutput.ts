import { textOf } from './context';

import type { LintContext } from './context';

const PROVIDER = 'apiContainer_';

/** A provider's `.data`, wherever a template reads it: `apiContainer_feed.data`, its id `-` and all. */
const DATA_READ = /(?<![\w.])apiContainer_([A-Za-z0-9_-]+)\.data(?![\w-])/g;

/**
 * A provider fed by a server action publishes the action's output at its root, beside its state (`isLoading`, …).
 * `.data` is what a `query` provider answers with, in either runtime, so a read of it on an action's provider is the
 * template that renders nothing — authored without a word, and found on a page served empty.
 */
const checkRead = (ctx: LintContext, providerId: string, path: string, where: string, id?: string): void => {
  const provider = ctx.element(providerId);
  const action = textOf(provider?.attributes.action);
  if (!provider || provider.definition.type !== 'apiContainer' || !action || textOf(provider.attributes.connector)) {
    return;
  }

  const rest = path.slice(`${PROVIDER}${providerId}.data`.length);
  ctx.warn(
    'action-output-path',
    `${where} reads \`${path}\`, but "${providerId}" is fed by the server action "${action}", which it publishes at its root: \`${PROVIDER}${providerId}${rest}\`. \`.data\` is a query provider's answer. (An output whose own top field is \`data\` reads the same as a query's — name it otherwise.)`,
    id,
    { source: path }
  );
};

/** Every template's reads of `<provider>.data` — see {@link checkRead}. */
export const checkActionOutputReads = (ctx: LintContext, template: string, where: string, id?: string): void => {
  for (const match of template.matchAll(DATA_READ)) {
    const [path, providerId = ''] = match;
    const tail = /^[\w.-]*/.exec(template.slice(match.index + path.length))?.[0] ?? '';
    checkRead(ctx, providerId, `${path}${tail}`, where, id);
  }
};

/** Every binding's source that reads `<provider>.data` — see {@link checkRead}. */
export const lintActionOutputBindings = (ctx: LintContext): void => {
  for (const element of Object.values(ctx.flat)) {
    for (const binding of Object.values(element.definition.bindings ?? {}).flat()) {
      if (binding.enabled === false || !binding.source.startsWith(PROVIDER)) {
        continue;
      }

      const [root = '', next] = binding.source.split('.');
      if (next === 'data') {
        checkRead(ctx, root.slice(PROVIDER.length), binding.source, ctx.describe(element.id), element.id);
      }
    }
  }
};
