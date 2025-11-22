import clsx from 'clsx';
import { useMemo, use, useCallback } from 'react';

import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';

import ElementDetails from './ElementDetails';
import ElementsList from './ElementsList';

import type { Element } from '@plitzi/sdk-shared';

export type ElementsViewerProps = {
  className?: string;
  elementSelected?: string;
  onSelectElement: (id?: string) => void;
};

const ElementsViewer = ({ className, elementSelected, onSelectElement }: ElementsViewerProps) => {
  const { currentPageId } = use(NavigationContext);
  const { schema } = use(SchemaContext);
  const elements = useMemo<Element[]>(
    () => Object.values(schema.flat).filter(element => element.definition.rootId === currentPageId),
    [schema.flat, currentPageId]
  );
  const element = useMemo(() => elements.find(element => element.id === elementSelected), [elements, elementSelected]);

  const handleElementSelected = useCallback((id?: string) => onSelectElement(id), [onSelectElement]);

  return (
    <div className={clsx('flex h-full w-full', className)}>
      <ElementsList elements={elements} elementSelected={elementSelected} onSelect={handleElementSelected} />
      {elementSelected && (
        <ElementDetails
          definition={element?.definition}
          attributes={element?.attributes}
          onSelectElement={onSelectElement}
        />
      )}
    </div>
  );
};

export default ElementsViewer;
