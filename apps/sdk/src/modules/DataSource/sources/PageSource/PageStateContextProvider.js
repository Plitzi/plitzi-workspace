// Packages
import { useCallback, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';

// Monorepo
import DataSourceContext from '@plitzi/sdk-data-source/DataSourceContext';
import { getPathsFromObeject } from '@plitzi/sdk-shared/utils';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';

// Alias
import StateManagerContext from '@modules/StateManager/StateManagerContext';

const PageStateContextProvider = props => {
  const { children } = props;
  const { state } = useContext(StateManagerContext);
  const { useDataSource } = useContext(DataSourceContext);
  const { currentPageId } = useContext(NavigationContext);

  const sourceFields = useCallback(
    async () => [
      ...getPathsFromObeject(state).reduce((acum, path) => [...acum, { path, name: path }], []),
      { path: 'currentPageId', name: 'Current Page' }
    ],
    [state, currentPageId]
  );

  const sourceValue = useMemo(() => ({ ...state, currentPageId }), [state, currentPageId]);

  useDataSource({
    id: 'global',
    source: 'page',
    name: 'Page State',
    value: sourceValue,
    fields: sourceFields
  });

  return children;
};

PageStateContextProvider.propTypes = {
  children: PropTypes.node
};

export default PageStateContextProvider;
