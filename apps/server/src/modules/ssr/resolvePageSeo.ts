import { pageSeoText } from '@plitzi/sdk-shared/schema/serverElements';

import type { Element, Schema } from '@plitzi/sdk-shared';

export type PageSeo = {
  title?: string;
  description?: string;
};

type PageSeoAttributes = {
  seoEnabled?: boolean;
  seoPageTitle?: string;
  seoPageDescription?: string;
};

/**
 * The title and description the addressed page declares for itself.
 *
 * The page element has carried `seoEnabled` / `seoPageTitle` / `seoPageDescription` all along — the builder edits
 * them and the client renders them into the head through Helmet — but the SSR document was built from a constant,
 * so every server-rendered page arrived titled the same. That is the half a crawler and a link preview see, which
 * is the half that matters: they read the document as delivered and never run the client.
 *
 * `seoEnabled: false` returns nothing rather than a default, so the deployment's own title stays in charge of a
 * page that opted out. Blank strings are treated as absent for the same reason — the builder writes one for a
 * field the author cleared, and an empty <title> is worse than a generic one.
 *
 * Either may be a template over the page's server providers and the address (`pageSeoContext`): a detail page says
 * the title of the record it shows, in the HTML a crawler reads. One that does not evaluate is nothing, as a blank is.
 */
export const resolvePageSeo = (
  schema: Schema | undefined,
  pageId: string | undefined,
  context: Record<string, unknown> = {}
): PageSeo => {
  if (!schema || !pageId) {
    return {};
  }

  const page = schema.flat[pageId] as Element<PageSeoAttributes> | undefined;
  if (!page?.attributes.seoEnabled) {
    return {};
  }

  const title = pageSeoText(page.attributes.seoPageTitle, context);
  const description = pageSeoText(page.attributes.seoPageDescription, context);

  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {})
  };
};
