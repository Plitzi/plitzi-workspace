// Packages
import { useCallback, useContext, useMemo } from 'react';

// Monorepo
import DataSourceContext from '@plitzi/sdk-data-source/DataSourceContext';
import { getPathsFromObeject, emptyObject } from '@plitzi/sdk-shared/utils';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';

const pagesDefault = [];

/**
 * @param {{
 *   children: React.ReactNode;
 *   state: object;
 *   pages: string[];
 * }} props
 * @returns {React.ReactElement}
 */
const PageStateSource = props => {
  const { children, state = emptyObject, pages = pagesDefault } = props;
  const { useDataSource } = useContext(DataSourceContext);
  const { currentPageId } = useContext(NavigationContext);

  const sourceFields = useCallback(async () => {
    if (pages && pages.length > 0) {
      return [
        ...getPathsFromObeject(state).reduce((acum, path) => [...acum, { path, name: path }], []),
        { path: 'currentPageId', name: 'Current Page', inputType: 'select', values: pages }
      ];
    }

    return [
      ...getPathsFromObeject(state).reduce((acum, path) => [...acum, { path, name: path }], []),
      { path: 'currentPageId', name: 'Current Page' }
    ];
  }, [state, currentPageId, pages]);

  const finalState = useMemo(() => ({ ...state, currentPageId }), [state, currentPageId]);

  useDataSource({
    id: 'global',
    source: 'page',
    name: 'Page State',
    contextName: 'PageContext',
    value: finalState,
    fields: sourceFields
  });

  return children;
};

export default PageStateSource;
