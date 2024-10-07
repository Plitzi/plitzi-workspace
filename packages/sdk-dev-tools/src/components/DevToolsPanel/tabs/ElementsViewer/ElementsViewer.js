// Packages
import React, { useMemo, use, useCallback } from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';

// Monorepo
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';

// Relatives
import ElementsList from './ElementsList';
import ElementDetails from './ElementDetails';

/**
 * @param {{
 *   className?: string;
 *   elementSelected?: string;
 *   onElementSelect: (id: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const ElementsViewer = props => {
  const { className, elementSelected, onElementSelect = noop } = props;
  const { currentPageId } = use(NavigationContext);
  const { schema } = use(SchemaContext);
  const elements = useMemo(
    () => Object.values(schema.flat).filter(element => element.definition.rootId === currentPageId),
    [schema.flat, currentPageId]
  );
  const element = useMemo(() => elements.find(element => element.id === elementSelected), [elements]);

  const handleElementSelected = useCallback(id => onElementSelect(id), [onElementSelect]);

  return (
    <div className={classNames('flex h-full w-full', className)}>
      <ElementsList
        className="p-2 w-[200px]"
        elements={elements}
        elementSelected={elementSelected}
        onSelect={handleElementSelected}
      />
      {elementSelected && <ElementDetails element={element} />}
    </div>
  );
};

export default ElementsViewer;
