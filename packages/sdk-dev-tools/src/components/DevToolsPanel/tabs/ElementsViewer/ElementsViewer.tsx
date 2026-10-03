import clsx from 'clsx';
import { useMemo, useState } from 'react';

import { useCommonStore } from '@plitzi/sdk-shared/store';

import ElementDetails from './components/ElementDetails';
import ElementsTree from './components/ElementsTree';
import { renderTree } from './helpers/renderTree';
import useHighlightElement from '../../../../highlight';

export type ElementsViewerProps = {
  className?: string;
  elementSelected?: string;
  onSelectElement: (id?: string) => void;
};

/**
 * What is on screen, element by element: the layouts around the page, the page, and the components it places — each
 * element outlined on the page while it is pointed at, and, selected, how it is doing and what the document says.
 */
const ElementsViewer = ({ className, elementSelected, onSelectElement }: ElementsViewerProps) => {
  const [[flat, components, currentPageId]] = useCommonStore([
    'schema.flat',
    'schema.components',
    'navigation.currentPageId'
  ]);
  const [filter, setFilter] = useState('');
  const [hovered, setHovered] = useState<string>();
  const sections = useMemo(() => renderTree({ flat, components }, currentPageId), [flat, components, currentPageId]);
  useHighlightElement(hovered);

  return (
    <div className={clsx('flex h-full w-full', className)}>
      <ElementsTree
        sections={sections}
        filter={filter}
        selected={elementSelected}
        onFilter={setFilter}
        onSelect={onSelectElement}
        onHover={setHovered}
      />
      {elementSelected && <ElementDetails id={elementSelected} onSelectElement={onSelectElement} />}
    </div>
  );
};

export default ElementsViewer;
