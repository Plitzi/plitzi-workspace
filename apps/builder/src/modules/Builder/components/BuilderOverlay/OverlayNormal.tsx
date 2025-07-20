import ContentEditable from '@plitzi/plitzi-ui/ContentEditable';
import classNames from 'classnames';
import { produce } from 'immer';
import get from 'lodash/get';
import set from 'lodash/set';
import { useCallback, use, useEffect, useMemo, useRef, useState } from 'react';

import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import BuilderStyleContext from '@plitzi/sdk-shared/builder/contexts/BuilderStyleContext';
import { makeSelector } from '@plitzi/sdk-style/StyleHelper';

import OverlayButtonContainer from './OverlayButtonContainer';
import OverlayButtonResize from './OverlayButtonResize';
import OverlaySpacing from './OverlaySpacing';

import type { OverlayRect } from './BuilderOverlayHelper';
import type { Element } from '@plitzi/sdk-shared';
import type { RefObject } from 'react';

export type OverlayNormalProps = {
  ref: RefObject<HTMLDivElement | null>;
  id?: string;
  element?: Element;
  refIframe?: RefObject<HTMLIFrameElement | null>;
  elementDOM?: HTMLElement | null;
  hideActions?: boolean;
  displayMode?: 'desktop' | 'tablet' | 'mobile';
  container?: OverlayRect;
  selector?: string;
  zoom?: number;
  mode?: 'hover' | 'select';
  isCollaborator?: boolean;
  color?: string;
  collaboratorName?: string;
};

const OverlayNormal = ({
  ref,
  id = '',
  element,
  refIframe,
  elementDOM,
  hideActions = false,
  displayMode = 'desktop',
  container,
  selector = '',
  zoom = 1,
  mode = 'hover',
  isCollaborator = false,
  color,
  collaboratorName = ''
}: OverlayNormalProps) => {
  const [hoverRemove, setHoverRemove] = useState(false);
  const { builderElementPermissions, builderHandler } = use(BuilderContext);
  const { style } = use(BuilderStyleContext);
  const styleRef = useRef(style);
  styleRef.current = style;

  const isVisible = useMemo(() => {
    const visibility = get(element, 'definition.initialState.visibility', true) as boolean | string;

    return visibility || visibility === 'true';
  }, [element]);
  const showLabels = useMemo(() => {
    if (hideActions) {
      return false;
    }

    if (!container) {
      return true;
    }

    const { width, height } = container.rounded;

    return width >= 50 && height >= 30;
  }, [container, hideActions]);
  const componentConfig = useMemo(
    () => (element ? builderElementPermissions(element) : {}),
    [element, builderElementPermissions]
  );
  const { canMove = true } = componentConfig;

  const handleDragStart = useCallback(
    (e: DragEvent | React.DragEvent) => {
      if (!element) {
        return;
      }

      const {
        definition: { parentId, type }
      } = element;
      const clientRect = (e as React.DragEvent).currentTarget.getBoundingClientRect();
      const offsetX = e.clientX / zoom - clientRect.left;
      const offsetY = e.clientY / zoom - clientRect.top + 10;
      e.stopPropagation();
      (e as React.DragEvent).dataTransfer.setDragImage((e as React.DragEvent).currentTarget, offsetX, offsetY);
      (e as React.DragEvent).dataTransfer.setData(`move##${type}`, JSON.stringify({ id, parentId, element }));
    },
    [id, element, zoom]
  );

  const handleOnChangeSize = useCallback(
    (width: number, height: number, finalUpdate = false) => {
      if (!finalUpdate || !element) {
        return;
      }

      if (!selector) {
        const newSelector = makeSelector(element.definition.type);
        builderHandler(
          'schemaUpdateElement',
          produce(element, draft => {
            set(draft, 'definition.styleSelectors.base', newSelector);
          })
        );
        builderHandler('styleAddSelector', displayMode, newSelector, 'class', '', {
          width: `${width}px`,
          height: `${height}px`
        });
      } else {
        const selectorType = get(styleRef.current, `platform.${displayMode}.${selector}.type`, 'class');
        const values = get(styleRef.current, `platform.${displayMode}.${selector}.attributes`);
        builderHandler('styleUpdateSelector', displayMode, selector, selectorType, '', {
          ...values,
          width: `${width}px`,
          height: `${height}px`
        });
      }
    },
    [element, selector, builderHandler, displayMode]
  );

  const handleChange = useCallback(
    (value: string) => {
      if (element && value !== element.definition.label) {
        builderHandler('schemaUpdateElement', {
          ...element,
          definition: { ...element.definition, label: value }
        });
      }
    },
    [builderHandler, element]
  );

  useEffect(() => {
    if (!canMove || !elementDOM || mode !== 'select') {
      return;
    }

    elementDOM.addEventListener('dragstart', handleDragStart);
    elementDOM.setAttribute('draggable', 'true');

    return () => {
      elementDOM.removeEventListener('dragstart', handleDragStart);
      elementDOM.setAttribute('draggable', 'false');
    };
  }, [canMove, elementDOM, handleDragStart, mode]);

  if (!element || !container) {
    return <div ref={ref} />;
  }

  const {
    definition: { label, items }
  } = element;

  return (
    <div
      ref={ref}
      className={classNames('builder__overlay', {
        'overlay--red': hoverRemove,
        'overlay--blue': !hoverRemove,
        'overlay--empty': items && items.length === 0
      })}
      style={{ outlineColor: color }}
    >
      <OverlaySpacing
        id={id}
        hoverRemove={hoverRemove}
        selector={selector}
        hasItems={!!items}
        elementDOM={elementDOM}
        refIframe={refIframe}
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
          <ContentEditable
            className="name-editable-container"
            value={label}
            myWindow={refIframe?.current?.contentWindow}
            onChange={handleChange}
            openMode="doubleClick"
          />
        </div>
      )}
      {isCollaborator && collaboratorName && (
        <div
          className={classNames('overlay__collaborator-name', {
            'collaborator-name--bottom': container.y < 30,
            'collaborator-name--xs': container.width < 70
          })}
          style={{ backgroundColor: color }}
          title={collaboratorName}
        >
          {container.width >= 70 && <i className="fa-solid fa-user" />}
          {collaboratorName}
        </div>
      )}
      {mode === 'select' && canMove && !hideActions && elementDOM && (
        <>
          <OverlayButtonResize
            width={container.rounded.width}
            height={container.rounded.height}
            elementDOM={elementDOM}
            refIframe={refIframe}
            resizeHandle="nw"
            onChange={handleOnChangeSize}
            transformScale={zoom}
          />
          <OverlayButtonResize
            width={container.rounded.width}
            height={container.rounded.height}
            elementDOM={elementDOM}
            refIframe={refIframe}
            resizeHandle="ne"
            onChange={handleOnChangeSize}
            transformScale={zoom}
          />
          <OverlayButtonResize
            width={container.rounded.width}
            height={container.rounded.height}
            elementDOM={elementDOM}
            refIframe={refIframe}
            resizeHandle="sw"
            onChange={handleOnChangeSize}
            transformScale={zoom}
          />
          <OverlayButtonResize
            width={container.rounded.width}
            height={container.rounded.height}
            elementDOM={elementDOM}
            refIframe={refIframe}
            resizeHandle="se"
            onChange={handleOnChangeSize}
            transformScale={zoom}
          />
        </>
      )}
    </div>
  );
};

export default OverlayNormal;
