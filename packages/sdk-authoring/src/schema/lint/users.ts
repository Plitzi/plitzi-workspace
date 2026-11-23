import type { LintContext } from './context';
import type { Schema } from '@plitzi/sdk-shared';

/**
 * The space's account controls: where a guest signs in must be reachable. A provider that signs in by going out and
 * back (Plitzi's) needs no page; one that takes a password (`basic`) does — the page with the space's sign-in form.
 */
export const lintUsers = (ctx: LintContext): void => {
  if (ctx.schema.settings.userProvider !== 'basic') {
    return;
  }

  const trees: Schema['flat'][] = [ctx.schema.flat, ...Object.values(ctx.schema.components).map(c => c.flat)];
  for (const element of trees.flatMap(flat => Object.values(flat))) {
    const { signInHref } = element.attributes;
    if (element.definition.type === 'account' && (signInHref === undefined || signInHref === '')) {
      ctx.warn(
        'account-sign-in-unreachable',
        `Account "${element.id}" has no \`signInHref\`, and this space signs in with its own provider (\`basic\`): a sign-in there needs a form, so its "Sign in" leads nowhere. Give it \`signInHref: '/sign-in'\`, the page with the space's \`signInForm\`.`,
        element.id
      );
    }
  }
};
