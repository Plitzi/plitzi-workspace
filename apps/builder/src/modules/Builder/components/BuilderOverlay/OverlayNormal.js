// Packages
import React, { forwardRef, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import get from 'lodash/get';
import noop from 'lodash/noop';
import { produce } from 'immer';
import set from 'lodash/set';
import Contenteditable from '@plitzi/plitzi-ui-components/ContentEditable';

// Monorepo
import { EventBridgeTypes } from '@repo/event-bridge/EventBridgeHelper';

// Alias
import { makeSelector } from '@pmodules/Style/StyleHelper';

// Relatives
import OverlaySpacing from './OverlaySpacing';
import OverlayButtonContainer from './OverlayButtonContainer';
import BuilderContext from '../../BuilderContext';
import OverlayButtonResize from './OverlayButtonResize';
import BuilderStyleContext from '../../contexts/BuilderStyleContext';

const OverlayNormal = forwardRef((props, ref) => {
  const {
    id = '',
    element,
    iframeDOM,
    elementDOM,
    hideActions = false,
    displayMode = 'desktop',
    container,
    zoom = 1,
    mode = 'hover',
    isCollaborator = false,
    color,
    collaboratorName = ''
  } = props;
  const [hoverRemove, setHoverRemove] = useState(false);
  const { builderElementPermissions, builderHandler } = useContext(BuilderContext);
  const { style } = useContext(BuilderStyleContext);
  const styleRef = useRef(style);
  styleRef.current = style;
  const theme = useMemo(() => {
    if (!element) {
      return 'normal';
    }

    return builderElementPermissions(element, 'overlay.theme', 'normal');
  }, [element, builderElementPermissions]);

  const isVisible = useMemo(() => {
    const visibility = get(element, 'definition.initialState.visibility', true);

    return visibility || visibility === 'true';
  }, [element]);
  const showLabels = useMemo(() => {
    if (hideActions) {
      return false;
    }

    if (!container || !container.rounded) {
      return true;
    }

    const { width, height } = container.rounded;

    return width >= 50 && height >= 30;
  }, [container]);
  const componentConfig = useMemo(() => builderElementPermissions(element), [element, builderElementPermissions]);
  const { canMove = true } = componentConfig;

  if (!element || !container || !container.rounded) {
    return <div ref={ref} />;
  }

  const {
    definition: { label, items, parentId, type, styleSelectors }
  } = element;

  const handleDragStart = useCallback(
    e => {
      const clientRect = e.currentTarget.getBoundingClientRect();
      const offsetX = e.clientX / zoom - clientRect.left;
      const offsetY = e.clientY / zoom - clientRect.top + 10;
      e.stopPropagation();
      e.dataTransfer.setDragImage(e.currentTarget, offsetX, offsetY);
      e.dataTransfer.setData(`move##${type}`, JSON.stringify({ id, parentId, element }));
    },
    [id, parentId, element, type, zoom]
  );

  const handleOnChangeSize = useCallback(
    (width, height, finalUpdate = false) => {
      if (!finalUpdate || !element) {
        return;
      }

      let selector = get(element, 'definition.styleSelectors.base', '');
      if (!selector) {
        selector = `.${makeSelector(type)}`;
        builderHandler(
          EventBridgeTypes.SCHEMA_UPDATE_ELEMENT,
          produce(element, draft => {
            set(draft, 'definition.styleSelectors.base', selector);
          })
        );
        builderHandler(EventBridgeTypes.STYLE_ADD_SELECTOR, displayMode, selector, '', {
          width: `${width}px`,
          height: `${height}px`
        });
      } else {
        const values = get(styleRef.current, `platform.${displayMode}.${btoa(selector)}.attributes`);
        builderHandler(EventBridgeTypes.STYLE_UPDATE_SELECTOR, displayMode, selector, '', {
          ...values,
          width: `${width}px`,
          height: `${height}px`
        });
      }
    },
    [id, get(element, 'definition.styleSelectors.base', ''), displayMode, builderHandler, type]
  );

  const handleChange = useCallback(
    value => {
      if (element && value !== element?.definition?.label) {
        builderHandler(EventBridgeTypes.SCHEMA_UPDATE_ELEMENT, {
          ...element,
          definition: { ...element.definition, label: value }
        });
      }
    },
    [builderHandler, element]
  );

  useEffect(() => {
    if (!canMove || !elementDOM || mode !== 'select') {
      return noop;
    }

    elementDOM.addEventListener('dragstart', handleDragStart);
    elementDOM.setAttribute('draggable', true);

    return () => {
      elementDOM.removeEventListener('dragstart', handleDragStart);
      elementDOM.setAttribute('draggable', false);
    };
  }, [elementDOM, handleDragStart]);

  return (
    <div
      ref={ref}
      className={classNames('builder__overlay', {
        'overlay--red': hoverRemove,
        'overlay--blue': (theme === 'normal' || !theme) && !hoverRemove,
        'overlay--empty': items && items.length === 0
      })}
      style={{ outlineColor: color }}
    >
      <OverlaySpacing
        id={id}
        hoverRemove={hoverRemove}
        selector={get(styleSelectors, 'base', '')}
        hasItems={!!items}
        elementDOM={elementDOM}
        iframeDOM={iframeDOM}
        displayMode={displayMode}
        zoom={zoom}
      />
      {!hideActions && (
        <OverlayButtonContainer
          hoverRemove={hoverRemove}
          onHoverRemove={setHoverRemove}
          id={id}
          element={element}
          container={container}
          zoom={zoom}
        />
      )}
      {showLabels && (
        <div
          className="overlay__size"
          style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'bottom right' }}
        >{`${container.rounded.width}x${container.rounded.height}`}</div>
      )}
      {showLabels && (
        <div
          className="overlay__element-name"
          title={label}
          style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'top left' }}
        >
          {isVisible && <i className="fas fa-eye" />}
          {!isVisible && <i className="fas fa-eye-slash" />}
          {/* {label} */}
          <Contenteditable
            className={classNames('name-editable-container')}
            value={label}
            myWindow={iframeDOM.contentWindow}
            onChange={handleChange}
            openMode="doubleClick"
          />
        </div>
      )}
      {isCollaborator && collaboratorName && (
        <div
          className={classNames('overlay__collaborator-name', {
            'collaborator-name--bottom': container?.y < 30,
            'collaborator-name--xs': container?.width < 70
          })}
          style={{ backgroundColor: color }}
          title={collaboratorName}
        >
          {container?.width >= 70 && <i className="fa-solid fa-user" />}
          {collaboratorName}
        </div>
      )}
      {mode === 'select' && canMove && (
        <>
          <OverlayButtonResize
            width={container.rounded.width}
            height={container.rounded.height}
            elementDOM={elementDOM}
            iframeDOM={iframeDOM}
            resizeHandle="nw"
            onChange={handleOnChangeSize}
            transformScale={zoom}
          />
          <OverlayButtonResize
            width={container.rounded.width}
            height={container.rounded.height}
            elementDOM={elementDOM}
            iframeDOM={iframeDOM}
            resizeHandle="ne"
            onChange={handleOnChangeSize}
            transformScale={zoom}
          />
          <OverlayButtonResize
            width={container.rounded.width}
            height={container.rounded.height}
            elementDOM={elementDOM}
            iframeDOM={iframeDOM}
            resizeHandle="sw"
            onChange={handleOnChangeSize}
            transformScale={zoom}
          />
          <OverlayButtonResize
            width={container.rounded.width}
            height={container.rounded.height}
            elementDOM={elementDOM}
            iframeDOM={iframeDOM}
            resizeHandle="se"
            onChange={handleOnChangeSize}
            transformScale={zoom}
          />
        </>
      )}
    </div>
  );
});

OverlayNormal.propTypes = {
  id: PropTypes.string,
  container: PropTypes.object,
  iframeDOM: PropTypes.object,
  hideActions: PropTypes.bool,
  element: PropTypes.object,
  elementDOM: PropTypes.object,
  displayMode: PropTypes.string,
  zoom: PropTypes.number,
  mode: PropTypes.oneOf(['hover', 'select']),
  isCollaborator: PropTypes.bool,
  color: PropTypes.string,
  collaboratorName: PropTypes.string
};

export default OverlayNormal;
