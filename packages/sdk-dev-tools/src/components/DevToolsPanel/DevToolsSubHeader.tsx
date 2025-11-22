import clsx from 'clsx';
import throttle from 'lodash-es/throttle.js';
import { useCallback, useEffect, useMemo, useState } from 'react';

import DevToolsButton from './DevToolsButton';

import type { ReactNode } from 'react';

export type DevToolsSubHeaderProps = {
  className?: string;
  currentPageId?: string;
  children?: ReactNode;
  elementSelected?: string;
  onSelectElement: (id?: string) => void;
};

const DevToolsSubHeader = ({ className, elementSelected, currentPageId, onSelectElement }: DevToolsSubHeaderProps) => {
  const [selectorEnabled, setSelectorEnabled] = useState(false);

  const handleElementHovered = useCallback(
    (elementDOM?: HTMLElement) => {
      const { id: elementId } = elementDOM?.dataset ?? {};
      onSelectElement(elementId);
    },
    [onSelectElement]
  );

  const handleElementHoveredDebounced = useMemo(() => throttle(handleElementHovered, 100), [handleElementHovered]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const closest = (e.target as HTMLElement).closest('.plitzi-sdk');
      if (!closest) {
        return;
      }

      handleElementHoveredDebounced((e.target as HTMLElement).closest('[data-id]') as HTMLElement | undefined);
    },
    [handleElementHoveredDebounced]
  );

  const handleClick = useCallback((e: MouseEvent) => {
    const closest = (e.target as HTMLElement).closest('.plitzi-sdk');
    if (!closest) {
      return;
    }

    e.stopPropagation();
    e.preventDefault();
    setSelectorEnabled(false);
  }, []);

  const handleClickSelector = useCallback(() => setSelectorEnabled(true), [setSelectorEnabled]);

  const handleClickPage = useCallback(() => {
    setSelectorEnabled(false);
    onSelectElement(currentPageId);
  }, [currentPageId, onSelectElement]);

  const handleClickClear = useCallback(() => {
    setSelectorEnabled(false);
    onSelectElement('');
  }, [onSelectElement]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const elementsDOM = document.querySelectorAll(`[data-id="${elementSelected}"]`);
    elementsDOM.forEach(elementDOM => elementDOM.classList.add('devtools-element-hovered'));

    return () => {
      elementsDOM.forEach(elementDOM => elementDOM.classList.remove('devtools-element-hovered'));
    };
  }, [elementSelected]);

  useEffect(() => {
    if (!selectorEnabled || typeof document === 'undefined') {
      return undefined;
    }

    const plitziSdkContainer = document.getElementsByClassName('plitzi-sdk')[0] as HTMLElement | undefined;
    if (!plitziSdkContainer) {
      return undefined;
    }

    plitziSdkContainer.addEventListener('click', handleClick);
    plitziSdkContainer.addEventListener('mousemove', handleMouseMove);

    return () => {
      plitziSdkContainer.removeEventListener('click', handleClick);
      plitziSdkContainer.removeEventListener('mousemove', handleMouseMove);
    };
  }, [handleClick, handleMouseMove, selectorEnabled]);

  return (
    <div className={clsx('flex items-center justify-between gap-2 border-b border-gray-300 px-2 py-1', className)}>
      <div className="flex gap-2">
        <DevToolsButton
          iconClassName="fa-regular fa-hand-pointer"
          title="Select an element in the page to inspect it"
          onClick={handleClickSelector}
          isSelected={selectorEnabled}
        />
        <DevToolsButton
          iconClassName="fa-regular fa-file"
          title="Current Page"
          onClick={handleClickPage}
          isSelected={elementSelected === currentPageId}
        />
      </div>
      <DevToolsButton
        iconClassName="fa-solid fa-ban"
        onClick={handleClickClear}
        title="Clear"
        isSelected={!!elementSelected}
      />
    </div>
  );
};

export default DevToolsSubHeader;
