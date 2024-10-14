// Packages
import React, { useCallback, use, useMemo } from 'react';
import get from 'lodash/get.js';

// Monorepo
import { getPathsFromObeject } from '@plitzi/sdk-shared/utils';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import StateManagerContext from '@plitzi/sdk-state/StateManagerContext';

// Relatives
import DataSourceContext from '../DataSourceContext.js';

/**
 * @param {{
 *   children: React.ReactNode;
 *   pages: string[];
 * }} props
 * @returns {React.ReactElement}
 */
const PageStateSource = props => {
  const { children } = props;
  const { useDataSource } = use(DataSourceContext);
  const { currentPageId } = use(NavigationContext);
  const { schema } = use(SchemaContext);
  const { state } = use(StateManagerContext);
  const pages = useMemo(
    () =>
      get(schema, 'pages', []).reduce(
        (acum, pageId) => [...acum, { value: pageId, label: get(schema, `flat.${pageId}.attributes.name`, pageId) }],
        []
      ),
    [schema.pages, schema.flat]
  );

  const sourceFields = useCallback(async () => {
    if (pages && pages.length > 0) {
      return [
        ...getPathsFromObeject(state).reduce((acum, path) => [...acum, { path, name: `page.${path}` }], []),
        { path: 'currentPageId', name: 'Current Page', inputType: 'select', values: pages }
      ];
    }

    return [
      ...getPathsFromObeject(state).reduce((acum, path) => [...acum, { path, name: `page.${path}` }], []),
      { path: 'currentPageId', name: 'Current Page' }
    ];
  }, [state, currentPageId, pages]);

  const finalState = useMemo(() => ({ ...state, currentPageId }), [state, currentPageId]);

  const [PageStateContext] = useDataSource({
    id: 'global',
    source: 'page',
    name: 'Page State',
    contextName: 'PageContext',
    fields: sourceFields
  });

  return <PageStateContext value={finalState}>{children}</PageStateContext>;
};

export default PageStateSource;
