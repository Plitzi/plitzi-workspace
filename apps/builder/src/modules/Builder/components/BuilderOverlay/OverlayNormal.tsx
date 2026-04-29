import ContentEditable from '@plitzi/plitzi-ui/ContentEditable';
import { get, set } from '@plitzi/plitzi-ui/helpers';
import clsx from 'clsx';
import { produce } from 'immer';
import { useCallback, use, useEffect, useMemo, useRef, useState } from 'react';

import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import { createStoreHook } from '@plitzi/sdk-store/createStore';
import { makeSelector } from '@plitzi/sdk-style/StyleHelper';

import OverlayButtonContainer from './OverlayButtonContainer';
import OverlayButtonResize from './OverlayButtonResize';
import OverlaySpacing from './OverlaySpacing';

import type { OverlayRect } from './BuilderOverlayHelper';
import type { BuilderState, DisplayMode, Element } from '@plitzi/sdk-shared';
import type { RefObject } from 'react';

export type OverlayNormalProps = {
  ref: RefObject<HTMLDivElement | null>;
  id?: string;
  element?: Element;
  refIframe?: RefObject<HTMLIFrameElement | null>;
  elementDOM?: HTMLElement | null;
  hideActions?: boolean;
  displayMode?: DisplayMode;
  container?: OverlayRect;
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
  zoom = 1,
  mode = 'hover',
  isCollaborator = false,
  color,
  collaboratorName = ''
}: OverlayNormalProps) => {
  const { useStore } = createStoreHook<BuilderState>();
  const [[style, selector, styleSelector, styleVariant, styleState]] = useStore([
    'style',
    'selector',
    'styleSelector',
    'styleVariant',
    'styleState'
  ]);
  const [hoverRemove, setHoverRemove] = useState(false);
  const { builderElementPermissions, builderHandler } = use(BuilderContext);
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

    return width / zoom >= 50 && height / zoom >= 30;
  }, [container, hideActions, zoom]);
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
      if (!finalUpdate || !element || mode !== 'select') {
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
        builderHandler(
          'styleAddSelector',
          displayMode,
          newSelector,
          'class',
          undefined,
          { width: `${width}px`, height: `${height}px` },
          { styleSelector: 'base' }
        );
      } else {
        const values = get(
          styleRef.current,
          `platform.${displayMode}.${selector}.attributes.${styleSelector}.default`,
          {}
        );
        builderHandler(
          'styleUpdateSelector',
          displayMode,
          selector,
          undefined,
          { ...values, width: `${width}px`, height: `${height}px` },
          { styleSelector, styleVariant, styleState }
        );
      }
    },
    [element, mode, selector, builderHandler, displayMode, styleSelector, styleVariant, styleState]
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
      className={clsx('builder__overlay', {
        'overlay--red': hoverRemove,
        'overlay--blue': !hoverRemove,
        'overlay--empty': items && items.length === 0
      })}
      style={{ outlineColor: color }}
    >
      <OverlaySpacing
        id={id}
        hoverRemove={hoverRemove}
        hasItems={!!items}
        elementDOM={elementDOM}
        refIframe={refIframe}
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
        >{`${container.rounded.width / zoom}x${container.rounded.height / zoom}`}</div>
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
          className={clsx('overlay__collaborator-name', {
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
