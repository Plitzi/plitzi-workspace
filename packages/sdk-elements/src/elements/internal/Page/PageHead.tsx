import { Helmet } from '@dr.pogodin/react-helmet';
import { useMemo } from 'react';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';
import { collectServerElements, pageServerContext, pageSeoText } from '@plitzi/sdk-shared/schema/serverElements';
import { useCommonStore } from '@plitzi/sdk-shared/store';

export type PageHeadProps = {
  pageId: string;
  title?: string;
  description?: string;
};

/**
 * The page's title and description in the head: its words, or its templates read against the answers of its server
 * providers — `rsc.data`, what the server wrote the HTML's head from, and what a navigation fetches before it lands —
 * so the tab says the record a detail page shows, on arrival and after every move.
 */
const PageHead = ({ pageId, title, description }: PageHeadProps) => {
  const [[flat, serverData, routeParams, queryParams]] = useCommonStore([
    'schema.flat',
    'rsc.data',
    'navigation.routeParams',
    'navigation.queryParams'
  ]);
  // A render with no schema in its store (a widget, a test) has no providers to read.
  const elements = useMemo(() => (isRecord(flat) ? collectServerElements({ flat }, pageId) : []), [flat, pageId]);
  const context = useMemo(
    () => pageServerContext(elements, serverData ?? {}, { routeParams, queryParams }),
    [elements, serverData, routeParams, queryParams]
  );
  const shownTitle = pageSeoText(title, context);
  const shownDescription = pageSeoText(description, context);

  return (
    <Helmet>
      {!!shownTitle && <title>{shownTitle}</title>}
      {!!shownDescription && <meta name="description" content={shownDescription} />}
    </Helmet>
  );
};

export default PageHead;
