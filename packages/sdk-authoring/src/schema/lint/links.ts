import { getPageFullPath } from '@plitzi/sdk-shared/navigation';

import type { LintContext } from './context';
import type { Element } from '@plitzi/sdk-shared';

const attributeText = (element: Element, key: string): string => {
  const value: unknown = element.attributes[key];

  return typeof value === 'string' ? value : '';
};

/** The path a link inside the space leads to, as the link resolves it: a page id (or its path), or a path of its own. */
const pathOf = (ctx: LintContext, link: Element, mode: string): string => {
  const href = attributeText(link, 'href');
  if (mode === 'page') {
    return getPageFullPath(ctx.flat, ctx.schema.pageFolders, href, true);
  }

  return `/${href}`.replaceAll(/\/+/g, '/').split(/[?#]/)[0];
};

/**
 * A link current for its section — `current: 'section'` — has to be a link there is a section under: one that is never
 * current (an external one) says nothing, and one to `/` holds every page of the space, so it is lit on all of them.
 */
export const lintLinks = (ctx: LintContext): void => {
  Object.values(ctx.flat).forEach(link => {
    if (link.definition.type !== 'link' || attributeText(link, 'current') !== 'section') {
      return;
    }

    const where = ctx.describe(link.id);
    const mode = attributeText(link, 'mode') || 'page';
    if (mode === 'external') {
      ctx.warn(
        'link-current-section',
        `${where} has \`current: 'section'\`, and an external link is never current — it does nothing. Leave \`current\` out.`,
        link.id
      );

      return;
    }

    if (pathOf(ctx, link, mode) === '/') {
      ctx.warn(
        'link-current-section',
        `${where} has \`current: 'section'\` and leads to \`/\`, which every page of the space is under — it would be lit on all of them. Leave \`current\` out: a link to the home page is current on the home page.`,
        link.id
      );
    }
  });
};
