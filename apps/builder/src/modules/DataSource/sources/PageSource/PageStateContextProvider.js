// Packages
import { useCallback, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';
import get from 'lodash/get';

// Monorepo
import DataSourceContext from '@plitzi/sdk-data-source/DataSourceContext';
import { getPathsFromObeject } from '@plitzi/sdk-shared/utils';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';

// Alias
import StateManagerContext from '@pmodules/StateManager/StateManagerContext';
import SchemaMainContext from '@pmodules/Schema/SchemaMainContext';

const PageStateContextProvider = props => {
  const { children } = props;
  const { state } = useContext(StateManagerContext);
  const { useDataSource } = useContext(DataSourceContext);
  const { currentPageId } = useContext(NavigationContext);
  const { pages: pageIds, pageDefinitions } = useContext(SchemaMainContext);

  const pageOptions = useMemo(
    () =>
      pageIds.reduce((acum, pageId) => {
        const pageName = get(pageDefinitions, `${pageId}.attributes.name`, pageId);

        return [...acum, { value: pageId, label: pageName }];
      }, []),
    [pageDefinitions, pageIds]
  );

  const sourceFields = useCallback(
    async () => [
      ...getPathsFromObeject(state).reduce((acum, path) => [...acum, { path, name: path }], []),
      { path: 'currentPageId', name: 'Current Page', inputType: 'select', values: pageOptions }
    ],
    [state, currentPageId, pageOptions]
  );

  const finalState = useMemo(() => ({ ...state, currentPageId }), [state, currentPageId]);

  useDataSource({
    id: 'global',
    source: 'page',
    name: 'Plitzi - Page State',
    contextName: 'PageContext',
    value: finalState,
    fields: sourceFields
  });

  return children;
};

PageStateContextProvider.propTypes = {
  children: PropTypes.node
};

export default PageStateContextProvider;
