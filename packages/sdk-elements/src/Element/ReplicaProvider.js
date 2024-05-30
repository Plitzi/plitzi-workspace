// Packages
import React, { use, useEffect, useMemo } from 'react';
import get from 'lodash/get';

// Monorepo
import usePlitziServiceContext from '@plitzi/sdk-shared/usePlitziServiceContext';
import { emptyObject } from '@plitzi/sdk-shared/utils';

/**
 * @param {{
 *   children: React.ReactNode;
 *   id: string;
 *   source: string;
 * }} props
 * @returns {React.ReactElement}
 */
const ReplicaProvider = props => {
  const { children, id = '', source = '', dataSourceValue = emptyObject } = props;
  const {
    contexts: { DataSourceContext, InteractionsContext }
  } = usePlitziServiceContext();

  // Data Source

  const dataSourceContext = use(DataSourceContext);
  const dsManager = get(dataSourceContext, 'dataSourceManager');
  const dsManagerChild = useMemo(() => {
    const dataSourceInstance = get(dataSourceContext.dataSourceManager, `dataSources.${id}`, {});
    const dsManagerChild = dataSourceContext.dataSourceManager.createChildManager(id, undefined, {
      [id]: {
        [source]: {
          ...dataSourceInstance,
          value: {
            ...get(dataSourceInstance, `${source}.value`, {}),
            ...dataSourceValue
          }
        }
      }
    });

    return dsManagerChild;
  }, [dataSourceContext, id, dataSourceValue, source]);

  const referenceContextSource = useMemo(
    () => ({ ...dataSourceContext, dataSourceManager: dsManagerChild }),
    [dataSourceContext, dsManagerChild]
  );

  useEffect(() => {
    return () => {
      dsManager.removeChildManager(dsManagerChild);
    };
  }, [dsManagerChild]);

  // Interactions

  const interactionsContext = use(InteractionsContext);
  const interactionsManager = get(interactionsContext, 'interactionsManager');
  const interactionsManagerChild = useMemo(() => interactionsContext.interactionsManager.createChildManager(), [id]);

  const interactionsContextSource = useMemo(
    () => ({ ...interactionsContext, interactionsManager: interactionsManagerChild }),
    [interactionsContext, interactionsManagerChild]
  );

  useEffect(() => {
    return () => {
      interactionsManager.removeChildManager(interactionsManagerChild);
    };
  }, [interactionsManagerChild]);

  return (
    <DataSourceContext value={referenceContextSource}>
      <InteractionsContext value={interactionsContextSource}>{children}</InteractionsContext>
    </DataSourceContext>
  );
};

export default ReplicaProvider;
