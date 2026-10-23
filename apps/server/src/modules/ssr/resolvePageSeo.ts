import { isOgType, jsonForScript, pageSeoText, pageStructuredData } from '@plitzi/sdk-shared/schema';

import type { Element, Schema } from '@plitzi/sdk-shared';
import type { OgType } from '@plitzi/sdk-shared/schema';

export type PageSeo = {
  title?: string;
  description?: string;
  /** `<meta name="robots">`: whether search engines index the page and follow its links. */
  robots?: string;
  /** Each JSON-LD object, as the text of its `<script type="application/ld+json">` — escaped for the tag. */
  structuredData?: string[];
  /** The picture a link to the page shows (`og:image`), as the page wrote it: a file of the site or an address. */
  image?: string;
  imageAlt?: string;
  /** What the page is, in Open Graph's words (`og:type`). */
  type?: OgType;
};

type PageSeoAttributes = {
  seoEnabled?: boolean;
  seoPageTitle?: string;
  seoPageDescription?: string;
  seoRobots?: string;
  seoStructuredData?: unknown;
  seoImage?: string;
  seoImageAlt?: string;
  seoType?: string;
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
 * Either may be a template over the page's server providers and the address (`pageServerContext`): a detail page says
 * the title of the record it shows, in the HTML a crawler reads. One that does not evaluate is nothing, as a blank is.
 * So may each text of its JSON-LD (`pageStructuredData`).
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
  const robots = typeof page.attributes.seoRobots === 'string' ? page.attributes.seoRobots.trim() : '';
  const structuredData = pageStructuredData(page.attributes.seoStructuredData, context).map(jsonForScript);
  // A picture may be a template too: a room's page shows its own cover.
  const image = pageSeoText(page.attributes.seoImage, context);
  const imageAlt = pageSeoText(page.attributes.seoImageAlt, context);
  const { seoType } = page.attributes;

  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(robots ? { robots } : {}),
    ...(structuredData.length > 0 ? { structuredData } : {}),
    ...(image ? { image } : {}),
    ...(image && imageAlt ? { imageAlt } : {}),
    ...(isOgType(seoType) ? { type: seoType } : {})
  };
};
