// Packages
import React, { useMemo, use, useState, useCallback } from 'react';
import classNames from 'classnames';

// Monorepo
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';

// Relatives
import ElementsList from './ElementsList';

/**
 * @param {{
 *   className?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const ElementsViewer = props => {
  const { className } = props;
  const { currentPageId } = use(NavigationContext);
  const { schema } = use(SchemaContext);
  const [elementSelected, setElementSelected] = useState('');
  const elements = useMemo(
    () => Object.values(schema.flat).filter(element => element.definition.rootId === currentPageId),
    [schema.flat, currentPageId]
  );

  const handleElementSelected = useCallback(id => setElementSelected(id), []);

  console.log(elements);

  return (
    <div className={classNames('flex h-full w-full', className)}>
      <ElementsList
        className="p-2"
        elements={elements}
        elementSelected={elementSelected}
        onSelect={handleElementSelected}
      />
    </div>
  );
};

export default ElementsViewer;
