import { useToast } from '@plitzi/plitzi-ui/Toast';
import clsx from 'clsx';
import get from 'lodash-es/get';
import throttle from 'lodash-es/throttle';
import { use, useRef, useCallback, useMemo, useEffect } from 'react';

import FlatMap from '@plitzi/sdk-schema/helpers/FlatMap';
import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import BuilderHoveredContext from '@plitzi/sdk-shared/builder/contexts/BuilderHoveredContext';
import BuilderSchemaContext from '@plitzi/sdk-shared/builder/contexts/BuilderSchemaContext';
import BuilderSelectedContext from '@plitzi/sdk-shared/builder/contexts/BuilderSelectedContext';
import BuilderStyleContext from '@plitzi/sdk-shared/builder/contexts/BuilderStyleContext';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import { RTEvent } from '@plitzi/sdk-shared/websockets/RTCodec';
import AppContext from '@pmodules/App/AppContext';
import BuilderSubscriptionsContext from '@pmodules/Network/contexts/BuilderSubscriptionsContext';
import UndoableContext from '@pmodules/Undoable/UndoableContext';

import { processPaste } from '../../BuilderHelper';

import type { Schema, Style } from '@plitzi/sdk-shared';
import type { MouseEvent, ReactNode } from 'react';

export type BuilderAreaTrackingProps = {
  children?: ReactNode;
  className?: string;
  iframeDOM?: HTMLIFrameElement | null;
  isActive?: boolean;
  iframeScaleX?: number;
  previewMode?: boolean;
};

const BuilderAreaTracking = ({
  children,
  className,
  iframeDOM,
  isActive = false,
  iframeScaleX = 1,
  previewMode = false,
  ...otherProps
}: BuilderAreaTrackingProps) => {
  const { supportRealTime, subscriptionsPush } = use(BuilderSubscriptionsContext);
  const { elementHovered, setHovered } = use(BuilderHoveredContext);
  const { elementSelected, setSelected } = use(BuilderSelectedContext);
  const {
    multiPagesMode,
    builderHandler,
    baseContext: { baseElementId },
    baseElementIdOriginal,
    builderSetBaseContext
  } = use(BuilderContext);
  const { schema, builderDropElement } = use(BuilderSchemaContext);
  const { style } = use(BuilderStyleContext);
  const { displayBorderComponents } = use(AppContext);
  const { addToast } = useToast();
  const { canRedo, canUndo, undoableRedo, undoableUndo } = use(UndoableContext);
  const { mutate } = use(NetworkContext);
  const { componentDefinitions } = use(ComponentContext);

  const schemaRef = useRef(schema);
  schemaRef.current = schema;
  const styleRef = useRef(style);
  styleRef.current = style;

  const handleMouseEnter = () => {
    if (supportRealTime) {
      subscriptionsPush({ type: RTEvent.MOUSE, payload: { action: 'mouseEnter', rootId: baseElementId } });
    }
  };

  const handleMouseLeave = useCallback(() => {
    if (elementHovered) {
      setHovered(undefined);
    }

    if (supportRealTime) {
      subscriptionsPush({ type: RTEvent.MOUSE, payload: { action: 'mouseLeave', rootId: baseElementId } });
    }
  }, [baseElementId, elementHovered, setHovered, subscriptionsPush, supportRealTime]);

  const callbackPosition = useCallback(
    (x: number, y: number) => {
      if (isActive && supportRealTime) {
        subscriptionsPush({
          type: RTEvent.MOUSE,
          payload: { action: 'mouseMove', x, y, rootId: baseElementId }
        });
      }
    },
    [baseElementId, isActive, subscriptionsPush, supportRealTime]
  );

  const callbackPositionDebounced = useMemo(() => {
    if (!supportRealTime) {
      return undefined;
    }

    return throttle(callbackPosition, 50);
  }, [callbackPosition, supportRealTime]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      callbackPositionDebounced?.(e.clientX * iframeScaleX, e.clientY * iframeScaleX);
      if (previewMode) {
        return;
      }

      const closest = (e.target as HTMLDivElement).closest<HTMLDivElement>('.builder__overlay');
      if (closest) {
        return;
      }

      const target = (e.target as HTMLDivElement).closest<HTMLDivElement>('.plitzi-component');
      if (!target) {
        return;
      }

      const { id } = target.dataset;
      if ((!id && !elementHovered) || id === elementHovered) {
        return;
      }

      setHovered(id);
    },
    [callbackPositionDebounced, elementHovered, iframeScaleX, previewMode, setHovered]
  );

  const handleClickElements = useCallback(
    (e: MouseEvent) => {
      if (previewMode) {
        return;
      }

      const closest = (e.target as HTMLDivElement).closest<HTMLDivElement>('.plitzi-component');
      if (!closest) {
        return;
      }

      const id = get(closest, 'dataset.id');
      const rootId = get(closest, 'dataset.rootId');
      if ((!id && !elementSelected) || id === elementSelected || rootId !== baseElementId) {
        return;
      }

      setSelected(id, iframeDOM);
    },
    [baseElementId, elementSelected, iframeDOM, previewMode, setSelected]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Delete':
        case 'Backspace': {
          if (
            !elementSelected ||
            elementSelected === baseElementId ||
            !get(schemaRef, `current.flat.${elementSelected}`, undefined)
          ) {
            break;
          }

          if (
            iframeDOM?.contentWindow?.document.body.contains(e.target as HTMLDivElement) ||
            (e.target as HTMLDivElement).closest('.builder__breadcrumb')
          ) {
            builderHandler('schemaRemoveElement', elementSelected);
          }

          break;
        }

        case 'Escape': {
          if (elementSelected) {
            setSelected(undefined);
          } else if (!elementSelected && baseElementId !== baseElementIdOriginal) {
            builderSetBaseContext(baseElementIdOriginal);
          }

          break;
        }

        case 'Y':
        case 'y': {
          if (
            (e.ctrlKey || e.metaKey) &&
            iframeDOM?.contentWindow?.document.body.contains(e.target as HTMLDivElement) &&
            canRedo
          ) {
            if (elementSelected) {
              setSelected(undefined);
            }

            undoableRedo();

            break;
          }

          break;
        }

        case 'Z':
        case 'z': {
          if (
            (e.ctrlKey || e.metaKey) &&
            iframeDOM?.contentWindow?.document.body.contains(e.target as HTMLDivElement) &&
            canUndo
          ) {
            if (elementSelected) {
              setSelected(undefined);
            }

            undoableUndo();

            break;
          }

          break;
        }

        default:
          break;
      }
    },
    [
      elementSelected,
      baseElementId,
      iframeDOM,
      builderHandler,
      baseElementIdOriginal,
      setSelected,
      builderSetBaseContext,
      canRedo,
      undoableRedo,
      canUndo,
      undoableUndo
    ]
  );

  const handleCopy = useCallback(
    (e: ClipboardEvent) => {
      if (!elementSelected) {
        return;
      }

      if (
        elementSelected === baseElementId ||
        !(schemaRef.current as Schema | undefined) ||
        !(styleRef.current as Style | undefined)
      ) {
        return;
      }

      if (!iframeDOM?.contentWindow?.document.body.contains(e.target as HTMLDivElement) && document.body !== e.target) {
        return;
      }

      const { elements, elementsStyle, variables } = FlatMap.flatAsTemplate(
        schemaRef.current,
        styleRef.current,
        elementSelected
      );
      e.clipboardData?.setData(
        'application/json',
        JSON.stringify({
          type: 'add##plitzi-template',
          payload: { elements, style: elementsStyle, assets: [], variables }
        })
      );

      addToast('Element copied into the clipboard', { appeareance: 'info', autoDismiss: true, placement: 'top-right' });
      e.preventDefault();
    },
    [elementSelected, baseElementId, iframeDOM, addToast]
  );

  const handlePaste = useCallback(
    async (e: ClipboardEvent) => {
      if (
        !iframeDOM?.contentWindow?.document.body.contains(e.target as HTMLDivElement) &&
        document.body !== e.target &&
        !(e.target as HTMLDivElement).closest('.builder__tree') &&
        !(e.target as HTMLDivElement).closest('.builder__breadcrumb')
      ) {
        return;
      }

      if (!elementSelected) {
        return;
      }

      const result = await processPaste(e.clipboardData, {
        mutate,
        builderDropElement,
        elementSelected,
        componentDefinitions,
        baseElementId,
        builderHandler
      });

      if (!result) {
        addToast('Cant drop it here. Try another spot!', {
          appeareance: 'error',
          autoDismiss: true,
          placement: 'top-right'
        });
      }
    },
    [
      elementSelected,
      addToast,
      baseElementId,
      builderDropElement,
      builderHandler,
      componentDefinitions,
      mutate,
      iframeDOM
    ]
  );

  useEffect(() => {
    if (previewMode) {
      return;
    }

    window.document.addEventListener('copy', handleCopy);
    window.document.addEventListener('paste', handlePaste);
    if (iframeDOM && iframeDOM.contentWindow) {
      iframeDOM.contentWindow.document.addEventListener('copy', handleCopy);
      iframeDOM.contentWindow.document.addEventListener('paste', handlePaste);
    }

    return () => {
      window.document.removeEventListener('copy', handleCopy);
      window.document.removeEventListener('paste', handlePaste);
      if (iframeDOM && iframeDOM.contentWindow) {
        iframeDOM.contentWindow.document.removeEventListener('copy', handleCopy);
        iframeDOM.contentWindow.document.removeEventListener('paste', handlePaste);
      }
    };
  }, [iframeDOM, handleCopy, handlePaste, previewMode]);

  useEffect(() => {
    if (previewMode || multiPagesMode) {
      return;
    }

    window.document.addEventListener('keydown', handleKeyDown);
    if (iframeDOM && iframeDOM.contentWindow) {
      iframeDOM.contentWindow.document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.document.removeEventListener('keydown', handleKeyDown);
      if (iframeDOM && iframeDOM.contentWindow) {
        iframeDOM.contentWindow.document.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [previewMode, handleKeyDown, iframeDOM, multiPagesMode]);

  return (
    <div
      className={clsx(className, {
        'builder--display-component-border display-component-border--black':
          displayBorderComponents === 'black' && !previewMode,
        'builder--display-component-border display-component-border--white':
          displayBorderComponents === 'white' && !previewMode
      })}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      onClick={handleClickElements}
      {...otherProps}
    >
      {children}
    </div>
  );
};

export default BuilderAreaTracking;
