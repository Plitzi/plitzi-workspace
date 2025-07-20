import classNames from 'classnames';
import camelCase from 'lodash/camelCase';
import debounce from 'lodash/debounce';
import { memo, use, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import BuilderSchemaContext from '@plitzi/sdk-shared/builder/contexts/BuilderSchemaContext';

import type { DropPosition, Element as PlitziElement } from '@plitzi/sdk-shared';
import type { CSSProperties, RefObject } from 'react';

export const OVERLAY_MODE_NORMAL = 'normal';
export const OVERLAY_MODE_DRAG = 'drag';

export type BuilderOverlayDragProps = {
  refIframe: RefObject<HTMLIFrameElement | null>;
  sizeOffset?: number;
  zoom?: number;
};

const BuilderOverlayDrag = ({ refIframe, sizeOffset = 2, zoom = 1 }: BuilderOverlayDragProps) => {
  const elementDOM = useRef<Element | undefined | null>(null);
  const [, setRerender] = useState(false);
  const {
    builderElementPermissions,
    baseContext: { baseElementId }
  } = use(BuilderContext);
  const {
    builderDropElement,
    schema: { flat }
  } = use(BuilderSchemaContext);
  const setRerenderDebounced = useMemo(() => debounce(setRerender, 50), [setRerender]);

  const dragMetadata = useRef<{
    element?: PlitziElement;
    parentElement?: PlitziElement;
    dropAllowed: boolean;
    dropPosition?: DropPosition;
    clientRect?: DOMRect;
  }>({
    element: undefined,
    parentElement: undefined,
    dropAllowed: true,
    dropPosition: undefined,
    clientRect: undefined
  });

  const processContainer = useCallback(
    (id: string) => {
      let scrollY = 0;
      let scrollX = 0;
      let innerHeight = 0;
      let innerWidth = 0;
      if (refIframe.current && refIframe.current.contentWindow) {
        elementDOM.current = refIframe.current.contentWindow.document.querySelector(
          `[data-id="${id}"][data-root-id="${baseElementId}"]`
        );
        ({ scrollX, scrollY, innerHeight, innerWidth } = refIframe.current.contentWindow);
      } else {
        elementDOM.current = window.document.querySelector(`[data-id="${id}"][data-root-id="${baseElementId}"]`);
        ({ scrollX, scrollY, innerHeight } = window);
      }

      if (!elementDOM.current) {
        return {};
      }

      const { width, height, x, y } = elementDOM.current.getBoundingClientRect();
      let xFinal = x;
      if (x < 0) {
        xFinal = 0;
      }

      return {
        width: width - sizeOffset,
        height: height - sizeOffset,
        x: xFinal,
        y,
        scrollX,
        scrollY,
        innerHeight,
        innerWidth
      };
    },
    [baseElementId, refIframe, sizeOffset]
  );

  const handleDragOver = useCallback(
    (e: DragEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const type = e.dataTransfer?.types[0];
      if (!type) {
        return;
      }

      const typeArr = type.split('##');
      if (typeArr.length !== 2 || (typeArr[0] !== 'add' && typeArr[0] !== 'move')) {
        return;
      }

      const target = (e.target as HTMLElement).closest<HTMLElement>('.plitzi-component');
      if (!target || !target.dataset.id) {
        return;
      }

      const { id } = target.dataset;
      const dataType = camelCase(typeArr[1]);
      let { clientX: x, clientY: y } = e;
      if (!dragMetadata.current.element || dragMetadata.current.element.id !== id) {
        const element = flat[id];
        const clientRect = target.getBoundingClientRect();
        let parentElement: PlitziElement | undefined;
        if (element as PlitziElement | undefined) {
          const {
            definition: { parentId }
          } = element;

          if (parentId) {
            parentElement = flat[parentId];
          }
        }

        dragMetadata.current = { ...dragMetadata.current, element, parentElement, clientRect };
      }

      const { element, parentElement, clientRect, dropPosition } = dragMetadata.current;
      if (!element || !clientRect) {
        return;
      }

      let { itemsAllowed, itemsNotAllowed } = builderElementPermissions(element);
      const {
        definition: { type: elementType, items }
      } = element;

      const { width, height } = clientRect;
      if (zoom !== 1) {
        x /= zoom;
        y /= zoom;
      }

      let newDropPosition: DropPosition = 'inside';
      if (items) {
        if (x < clientRect.x + width * 0.1) {
          // left
          newDropPosition = 'left';
        } else if (x > clientRect.x + width * 0.9) {
          // right
          newDropPosition = 'right';
        } else if (y < clientRect.y + height * 0.1) {
          // top
          newDropPosition = 'top';
        } else if (y > clientRect.y + height * 0.9) {
          // bottom
          newDropPosition = 'bottom';
        }
      } else if (x < clientRect.x + width * 0.25) {
        // left
        newDropPosition = 'left';
      } else if (x > clientRect.x + width * 0.75) {
        // right
        newDropPosition = 'right';
      } else if (y <= clientRect.y + height * 0.5) {
        // top
        newDropPosition = 'top';
      } else if (y > clientRect.y + height * 0.5) {
        // bottom
        newDropPosition = 'bottom';
      }

      if (elementType === 'page' || !parentElement) {
        newDropPosition = 'inside';
      }

      if (newDropPosition !== 'inside' && parentElement) {
        ({ itemsAllowed, itemsNotAllowed } = builderElementPermissions(parentElement));
      }

      let dropAllowed = !itemsAllowed || itemsAllowed.length === 0 || itemsAllowed.includes(dataType);
      if (itemsNotAllowed && itemsNotAllowed.includes(dataType)) {
        dropAllowed = false;
      }

      if (dropPosition !== newDropPosition) {
        dragMetadata.current = {
          ...dragMetadata.current,
          dropPosition: newDropPosition,
          dropAllowed: dataType ? dropAllowed : true
        };
        setRerenderDebounced(state => !state);
      }
    },
    [flat, builderElementPermissions, setRerenderDebounced, zoom]
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const { dropPosition, element } = dragMetadata.current;
      dragMetadata.current = {
        element: undefined,
        parentElement: undefined,
        dropAllowed: true,
        dropPosition: undefined,
        clientRect: undefined
      };
      if (!element || !dropPosition) {
        setRerender(state => !state);
        return;
      }

      const type = e.dataTransfer?.types[0];
      if (!type) {
        return;
      }

      const data = JSON.parse(e.dataTransfer.getData(type)) as {
        id: string;
        parentId?: string;
        element: PlitziElement;
      };
      console.log(data);
      if (data.id === element.id || (data.parentId === element.id && dropPosition === 'inside')) {
        setRerender(state => !state);
        return;
      }

      builderDropElement(type, data, dropPosition, element.id, baseElementId);
      setRerender(state => !state);
    },
    [builderDropElement, baseElementId]
  );

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.stopPropagation();
    e.preventDefault();
    dragMetadata.current = {
      element: undefined,
      parentElement: undefined,
      dropAllowed: true,
      dropPosition: undefined,
      clientRect: undefined
    };

    setRerender(state => !state);
  }, []);

  useEffect(() => {
    const iframeDOM = refIframe.current;
    if (iframeDOM && iframeDOM.contentWindow) {
      iframeDOM.contentWindow.addEventListener('dragover', handleDragOver);
      iframeDOM.contentWindow.addEventListener('drop', handleDrop);
      iframeDOM.contentWindow.addEventListener('dragleave', handleDragLeave);
    }

    return () => {
      if (iframeDOM && iframeDOM.contentWindow) {
        iframeDOM.contentWindow.removeEventListener('dragover', handleDragOver);
        iframeDOM.contentWindow.removeEventListener('drop', handleDrop);
        iframeDOM.contentWindow.removeEventListener('dragleave', handleDragLeave);
      }
    };
  }, [refIframe, flat, builderDropElement, baseElementId, zoom, handleDragOver, handleDrop, handleDragLeave]);

  const { dropPosition, element, dropAllowed } = dragMetadata.current;
  if (!element) {
    return null;
  }

  const { id } = element;
  const container = processContainer(id);
  const { x, y } = container;
  let { width, height } = container;

  const extraStyle: CSSProperties = {};
  switch (dropPosition) {
    case 'top': {
      height = 0;

      break;
    }
    case 'bottom':
      extraStyle.top = height;
      height = 0;

      break;
    case 'left':
      width = 0;

      break;
    case 'right':
      extraStyle.left = width;
      width = 0;

      break;
    default:
      break;
  }

  return (
    <div
      className={classNames('builder__overlay overlay--drag', {
        'overlay--red': !dropAllowed,
        'overlay--blue': dropAllowed,
        'overlay--drag-inside': dropPosition === 'inside' || !dropAllowed
      })}
      style={{ width, height, transform: `translate3d(${x}px,${y}px, 5px)`, ...extraStyle }}
    >
      {dropPosition === 'inside' && (
        <div className="overlay__drop-message-container" style={{ transform: `scale(${1 / zoom})` }}>
          <div className="overlay__drop-message">
            {!dropAllowed && 'Not Allowed'}
            {dropAllowed && 'Drop Here'}
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(BuilderOverlayDrag);
