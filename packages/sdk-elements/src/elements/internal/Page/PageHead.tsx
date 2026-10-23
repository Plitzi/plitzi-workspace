import { Helmet } from '@dr.pogodin/react-helmet';
import { useMemo } from 'react';

import { isRecord } from '@plitzi/sdk-shared/helpers';
import {
  collectServerElements,
  jsonForScript,
  pageHeadTags,
  pageServerContext,
  pageSeoText,
  pageStructuredData,
  spaceIdentity
} from '@plitzi/sdk-shared/schema';
import { useCommonStore } from '@plitzi/sdk-shared/store';

import type { OgType } from '@plitzi/sdk-shared/schema';

export type PageHeadProps = {
  pageId: string;
  title?: string;
  description?: string;
  robots?: string;
  structuredData?: Record<string, unknown>[];
  image?: string;
  imageAlt?: string;
  type?: OgType;
};

/** The page's whole address, without its query — what the server says as its `og:url`; none where there is no window. */
const pageUrl = (): string =>
  typeof window === 'undefined' ? '' : `${window.location.origin}${window.location.pathname}`;

/**
 * The page's head: its title, its JSON-LD and every tag `pageHeadTags` says of it — description, robots, Open Graph and
 * card with its picture, its address, the space's icon, colour and language — its words, or its templates read against
 * the answers of its server providers — `rsc.data`, what the server wrote the HTML's head from, and what a navigation
 * fetches before it lands — so the tab says the record a detail page shows, on arrival and after every move.
 */
const PageHead = ({ pageId, title, description, robots, structuredData, image, imageAlt, type }: PageHeadProps) => {
  const [[flat, serverData, routeParams, queryParams, settings]] = useCommonStore([
    'schema.flat',
    'rsc.data',
    'navigation.routeParams',
    'navigation.queryParams',
    'schema.settings'
  ]);
  // A render with no schema in its store (a widget, a test) has no providers to read.
  const elements = useMemo(() => (isRecord(flat) ? collectServerElements({ flat }, pageId) : []), [flat, pageId]);
  const context = useMemo(
    () => pageServerContext(elements, serverData ?? {}, { routeParams, queryParams }),
    [elements, serverData, routeParams, queryParams]
  );
  const shownTitle = pageSeoText(title, context);
  const shownDescription = pageSeoText(description, context);
  const shownData = useMemo(() => pageStructuredData(structuredData, context), [structuredData, context]);
  const shownImage = pageSeoText(image, context);
  const shownAlt = pageSeoText(imageAlt, context);
  const head = pageHeadTags(
    {
      ...(shownTitle ? { title: shownTitle } : {}),
      ...(shownDescription ? { description: shownDescription } : {}),
      ...(robots ? { robots } : {}),
      ...(shownImage ? { image: shownImage } : {}),
      ...(shownImage && shownAlt ? { imageAlt: shownAlt } : {}),
      ...(type ? { type } : {})
    },
    spaceIdentity(settings),
    pageUrl()
  );

  return (
    <Helmet>
      {head.lang && <html lang={head.lang} />}
      {!!shownTitle && <title>{shownTitle}</title>}
      {head.meta.map(tag => (
        <meta
          key={`${tag.key}${tag.media ?? ''}`}
          {...(tag.attribute === 'name' ? { name: tag.key } : { property: tag.key })}
          content={tag.content}
          {...(tag.media ? { media: tag.media } : {})}
        />
      ))}
      {head.links.map(link => (
        <link key={link.rel} rel={link.rel} href={link.href} {...(link.type ? { type: link.type } : {})} />
      ))}
      {shownData.map((item, index) => (
        <script key={index} type="application/ld+json">
          {jsonForScript(item)}
        </script>
      ))}
    </Helmet>
  );
};

export default PageHead;
