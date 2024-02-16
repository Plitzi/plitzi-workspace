// Packages
import { useCallback, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';

// Monorepo
import DataSourceContext from '@repo/data-source-shared/DataSourceContext';

// Alias
import StateManagerContext from '@modules/StateManager/StateManagerContext';
import NavigationContext from '@modules/Navigation/NavigationContext';

// Relatives
import { getPathsFromObeject } from '../../../../helpers/utils';

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
    name: 'Plitzi - Page State',
    value: sourceValue,
    fields: sourceFields
  });

  return children;
};

PageStateContextProvider.propTypes = {
  children: PropTypes.node
};

export default PageStateContextProvider;
