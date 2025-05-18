import get from 'lodash/get';
import { useCallback, use, useMemo } from 'react';

import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import DataSourceContext from '@plitzi/sdk-shared/dataSource/DataSourceContext';
import { getPathsFromObeject } from '@plitzi/sdk-shared/helpers/utils';
import StateManagerContext from '@plitzi/sdk-state/StateManagerContext';

import type { ReactNode } from 'react';

export type PageStateSourceProps = {
  children?: ReactNode;
};

const PageStateSource = ({ children }: PageStateSourceProps) => {
  const { useDataSource } = use(DataSourceContext);
  const { currentPageId } = use(NavigationContext);
  const { schema } = use(SchemaContext);
  const { state } = use(StateManagerContext);
  const pages = useMemo(
    () =>
      get(schema, 'pages', []).reduce<{ value: string; label: string }[]>(
        (acum, pageId) => [
          ...acum,
          { value: pageId, label: get(schema, `flat.${pageId}.attributes.name`, pageId) as string }
        ],
        []
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schema.pages, schema.flat]
  );

  const sourceFields = useCallback(() => {
    if (pages.length > 0) {
      return [
        ...getPathsFromObeject(state).reduce<{ path: string; name: string }[]>(
          (acum, path) => [...acum, { path, name: `page.${path}` }],
          []
        ),
        { path: 'currentPageId', name: 'Current Page', inputType: 'select', values: pages }
      ];
    }

    return [
      ...getPathsFromObeject(state).reduce<{ path: string; name: string }[]>(
        (acum, path) => [...acum, { path, name: `page.${path}` }],
        []
      ),
      { path: 'currentPageId', name: 'Current Page' }
    ];
  }, [state, pages]);

  const finalState = useMemo(() => ({ ...state, currentPageId }), [state, currentPageId]);

  const [PageStateContext] = useDataSource({
    id: 'global',
    source: 'page',
    name: 'Page State',
    mode: 'write',
    fields: sourceFields
  });

  return <PageStateContext value={finalState}>{children}</PageStateContext>;
};

export default PageStateSource;
