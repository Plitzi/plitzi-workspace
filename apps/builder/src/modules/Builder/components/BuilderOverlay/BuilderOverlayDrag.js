// Packages
import React, { memo, use, useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import camelCase from 'lodash/camelCase';
import debounce from 'lodash/debounce';
import get from 'lodash/get';

import BuilderContext from '@plitzi/sdk-shared/builder/BuilderContext';
import BuilderSchemaContext from '@plitzi/sdk-shared/builder/BuilderSchemaContext';

export const OVERLAY_MODE_NORMAL = 'normal';
export const OVERLAY_MODE_DRAG = 'drag';

/**
 * @param {{
 *   iframeDOM: object;
 *   sizeOffset?: number;
 *   zoom?: number;
 * }} props
 * @returns {React.ReactElement}
 */
const BuilderOverlayDrag = props => {
  const { iframeDOM, sizeOffset = 2, zoom = 1 } = props;
  const elementDOM = useRef(null);
  const [, setRerender] = useState(false);
  const elementDOMIframe = useRef(null);
  const {
    builderElementPermissions,
    baseContext: { baseElementId }
  } = use(BuilderContext);
  const {
    builderDropElement,
    schema: { flat }
  } = use(BuilderSchemaContext);
  const setRerenderDebounced = useMemo(() => debounce(setRerender, 50), [setRerender]);

  const dragMetadata = useRef({
    element: null,
    parentElement: null,
    dropAllowed: true,
    dropPosition: null,
    clientRect: null
  });

  const processContainer = id => {
    let scrollY = 0;
    let scrollX = 0;
    let innerHeight = 0;
    let innerWidth = 0;
    if (iframeDOM) {
      elementDOM.current = elementDOMIframe.current.document.querySelector(
        `[data-id="${id}"][data-root-id="${baseElementId}"]`
      );
      ({ scrollX, scrollY, innerHeight, innerWidth } = elementDOMIframe.current);
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
  };

  const handleDragOver = e => {
    e.stopPropagation();
    e.preventDefault();
    let type = e.dataTransfer.types[0];
    if (!type) {
      return;
    }

    type = type.split('##');
    if (type.length !== 2 || (type[0] !== 'add' && type[0] !== 'move')) {
      return;
    }

    const target = e.target.closest('.plitzi-component');
    if (!target) {
      return;
    }

    const { id } = target.dataset;
    const dataType = camelCase(type[1]);
    let { clientX: x, clientY: y } = e;
    if (!dragMetadata.current.element || dragMetadata.current.element.id !== id) {
      const element = flat[id];
      const clientRect = target.getBoundingClientRect();
      let parentElement;
      if (element) {
        const {
          definition: { parentId }
        } = element;

        parentElement = flat[parentId];
      }

      dragMetadata.current = { ...dragMetadata.current, element, parentElement, clientRect };
    }

    const { element, parentElement, clientRect, dropPosition } = dragMetadata.current;
    if (!element) {
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

    let newDropPosition = 'inside';
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
  };

  const handleDrop = e => {
    e.stopPropagation();
    e.preventDefault();
    const { dropPosition, element } = dragMetadata.current;
    dragMetadata.current = {
      element: null,
      parentElement: null,
      dropAllowed: true,
      dropPosition: null,
      clientRect: null
    };
    if (!element) {
      setRerender(state => !state);
      return;
    }

    const type = e.dataTransfer.types[0];
    const data = JSON.parse(e.dataTransfer.getData(type));
    if (data.id === element.id || (data.parentId === element.id && dropPosition === 'inside')) {
      setRerender(state => !state);
      return;
    }

    builderDropElement(type, data, dropPosition, element.id, baseElementId);
    setRerender(state => !state);
  };

  const handleDragLeave = e => {
    e.stopPropagation();
    e.preventDefault();
    dragMetadata.current = {
      element: null,
      parentElement: null,
      dropAllowed: true,
      dropPosition: null,
      clientRect: null
    };

    setRerender(state => !state);
  };

  useEffect(() => {
    if (iframeDOM) {
      elementDOMIframe.current = iframeDOM.contentWindow;
      if (elementDOMIframe.current) {
        elementDOMIframe.current.addEventListener('dragover', handleDragOver);
        elementDOMIframe.current.addEventListener('drop', handleDrop);
        elementDOMIframe.current.addEventListener('dragleave', handleDragLeave);
      }
    }

    return () => {
      if (elementDOMIframe.current) {
        elementDOMIframe.current.removeEventListener('dragover', handleDragOver);
        elementDOMIframe.current.removeEventListener('drop', handleDrop);
        elementDOMIframe.current.removeEventListener('dragleave', handleDragLeave);
      }
    };
  }, [iframeDOM, flat, builderDropElement, baseElementId, zoom]);

  const { dropPosition, element, dropAllowed } = dragMetadata.current;
  const theme = useMemo(() => {
    const type = get(element, 'element.definition');
    if (!type) {
      return 'normal';
    }

    return builderElementPermissions(type, 'overlay.theme', 'normal');
  }, [element, builderElementPermissions]);
  if (!element) {
    return null;
  }

  const { id } = element;
  const container = processContainer(id);
  const { x, y } = container;
  let { width, height } = container;

  const extraStyle = {};
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
        'overlay--blue': (theme === 'normal' || !theme) && dropAllowed,
        'overlay--drag-inside':
          (dropPosition && dropPosition === 'inside') || (!dropAllowed && dropPosition === 'inside')
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
