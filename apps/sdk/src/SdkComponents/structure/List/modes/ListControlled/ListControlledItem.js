// Packages
import React, { useMemo, useContext, useEffect } from 'react';
import PropTypes from 'prop-types';
import get from 'lodash/get';
import classNames from 'classnames';

// Relatives
import usePlitziServiceContext from '../../../../../services/hooks/usePlitziServiceContext';

const ListControlledItem = props => {
  const { children, className = '', isTemplate = false, itemCount = 0, parentId = '', record } = props;
  const {
    contexts: { DataSourceContext }
  } = usePlitziServiceContext();

  const dataSourceContext = useContext(DataSourceContext);
  const dsManager = get(dataSourceContext, 'dataSourceManager');
  const dsManagerChild = useMemo(() => {
    const dataSourceInstance = get(dataSourceContext.dataSourceManager, `dataSources.${parentId}`);
    const source = `list-${parentId}`;
    const value = get(dataSourceInstance, `${source}.value`, {});
    const dsManagerChild = dataSourceContext.dataSourceManager.createChildManager(parentId, undefined, {
      [parentId]: { [source]: { ...dataSourceInstance, value: { ...value, item: record } } }
    });

    return dsManagerChild;
  }, [dataSourceContext, parentId, record]);

  const referenceContextSource = useMemo(
    () => ({ ...dataSourceContext, dataSourceManager: dsManagerChild }),
    [dataSourceContext, dsManagerChild]
  );

  useEffect(() => {
    return () => {
      dsManager.removeChildManager(dsManagerChild);
    };
  }, [dsManagerChild]);

  if (isTemplate) {
    return (
      <div className={classNames('plitzi-component__controlled-list-item', className)}>
        <div className="controlled-list-item__counter">{`List Item - ${itemCount + 1}`}</div>
        <DataSourceContext.Provider value={referenceContextSource}>{children}</DataSourceContext.Provider>
      </div>
    );
  }

  return <DataSourceContext.Provider value={referenceContextSource}>{children}</DataSourceContext.Provider>;
};

ListControlledItem.propTypes = {
  className: PropTypes.string,
  parentId: PropTypes.string,
  record: PropTypes.object,
  isTemplate: PropTypes.bool,
  itemCount: PropTypes.number,
  children: PropTypes.node
};

export default ListControlledItem;
