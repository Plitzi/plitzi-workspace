// Packages
import React, { useContext, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import get from 'lodash/get';

// Monorepo
import { emptyObject } from '@repo/shared';

// Relatives
import usePlitziServiceContext from '../../services/hooks/usePlitziServiceContext';

const ReplicaProvider = props => {
  const { children, id = '', dataSourceValue = emptyObject } = props;
  const {
    contexts: { DataSourceContext }
  } = usePlitziServiceContext();

  const dataSourceContext = useContext(DataSourceContext);
  const dsManager = get(dataSourceContext, 'dataSourceManager');
  const dsManagerChild = useMemo(() => {
    const dataSourceInstance = get(dataSourceContext.dataSourceManager, `dataSources.${id}`);
    const source = `list-${id}`;
    const value = get(dataSourceInstance, `${source}.value`, {});
    const dsManagerChild = dataSourceContext.dataSourceManager.createChildManager(id, undefined, {
      [id]: { [source]: { ...dataSourceInstance, value: { ...value, ...dataSourceValue } } }
    });

    return dsManagerChild;
  }, [dataSourceContext, id, dataSourceValue]);

  const referenceContextSource = useMemo(
    () => ({ ...dataSourceContext, dataSourceManager: dsManagerChild }),
    [dataSourceContext, dsManagerChild]
  );

  useEffect(() => {
    return () => {
      dsManager.removeChildManager(dsManagerChild);
    };
  }, [dsManagerChild]);

  return <DataSourceContext.Provider value={referenceContextSource}>{children}</DataSourceContext.Provider>;
};

ReplicaProvider.propTypes = {
  children: PropTypes.node,
  id: PropTypes.string,
  dataSourceValue: PropTypes.object
};

export default ReplicaProvider;
