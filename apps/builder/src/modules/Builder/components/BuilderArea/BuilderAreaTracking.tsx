import { get, throttle } from '@plitzi/plitzi-ui/helpers';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import clsx from 'clsx';
import { use, useRef, useCallback, useMemo, useEffect, useImperativeHandle } from 'react';

import FlatMap from '@plitzi/sdk-schema/helpers/FlatMap';
import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import { createStoreHook } from '@plitzi/sdk-shared/store';
import { RTEvent } from '@plitzi/sdk-shared/websockets/RTCodec';
import AppContext from '@pmodules/App/AppContext';
import useNormalizedCursor from '@pmodules/Builder/hooks/useNormalizedCursor';
import BuilderSubscriptionsContext from '@pmodules/Network/contexts/BuilderSubscriptionsContext';
import UndoableContext from '@pmodules/Undoable/UndoableContext';

import { processPaste } from '../../BuilderHelper';

import type { BuilderState } from '@plitzi/sdk-shared';
import type { MouseEvent, ReactNode, RefObject } from 'react';

export type BuilderAreaTrackingProps = {
  ref?: RefObject<HTMLDivElement | null>;
  children?: ReactNode;
  className?: string;
  iframeDOM?: HTMLIFrameElement | null;
  isActive?: boolean;
  zoom?: number;
  previewMode?: boolean;
};

const BuilderAreaTracking = ({
  ref,
  children,
  className,
  iframeDOM,
  isActive = false,
  previewMode = false,
  zoom = 1,
  ...otherProps
}: BuilderAreaTrackingProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  useImperativeHandle<HTMLDivElement | null, HTMLDivElement | null>(ref, () => containerRef.current, []);
  const { supportRealTime, subscriptionsPush } = use(BuilderSubscriptionsContext);
  const {
    multiPagesMode,
    builderHandler,
    baseContext: { baseElementId },
    baseElementIdOriginal,
    builderSetBaseContext,
    builderDropElement
  } = use(BuilderContext);
  const { useStore, useStoreGetter } = createStoreHook<BuilderState>();
  const [[elementHovered, setHovered, elementSelected, setSelected]] = useStore([
    'elementHovered',
    'setHovered',
    'elementSelected',
    'setSelected'
  ]);
  const getSchema = useStoreGetter('schema');
  const getStyle = useStoreGetter('style');
  const { displayBorderComponents } = use(AppContext);
  const { addToast } = useToast();
  const { canRedo, canUndo, undoableRedo, undoableUndo } = use(UndoableContext);
  const { mutate } = use(NetworkContext);
  const { componentDefinitions } = use(ComponentContext);

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

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
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
    [elementHovered, previewMode, setHovered]
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
            !getSchema(`flat.${elementSelected}`, undefined)
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
      getSchema,
      iframeDOM?.contentWindow?.document.body,
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

      if (elementSelected === baseElementId || !getSchema(undefined, undefined) || !getStyle(undefined, undefined)) {
        return;
      }

      if (!iframeDOM?.contentWindow?.document.body.contains(e.target as HTMLDivElement) && document.body !== e.target) {
        return;
      }

      const { elements, elementsStyle, variables } = FlatMap.flatAsTemplate(getSchema(), getStyle(), elementSelected);
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
    [elementSelected, baseElementId, getSchema, getStyle, iframeDOM?.contentWindow?.document.body, addToast]
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
        componentDefinitions: componentDefinitions.current,
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

  const throttledSend = useMemo(
    () =>
      throttle((pos: { x: number; y: number }) => {
        subscriptionsPush({
          type: RTEvent.MOUSE,
          payload: { ...pos, zoom, action: 'mouseMove', rootId: baseElementId }
        });
      }, 50),
    [baseElementId, subscriptionsPush, zoom]
  );

  const { bind } = useNormalizedCursor(containerRef, { onMove: throttledSend, enabled: isActive && supportRealTime });

  return (
    <div
      className={clsx(className, {
        'builder--display-component-border display-component-border--black':
          displayBorderComponents === 'black' && !previewMode,
        'builder--display-component-border display-component-border--white':
          displayBorderComponents === 'white' && !previewMode
      })}
      style={{ zoom }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      onClick={handleClickElements}
      ref={containerRef}
      {...bind()}
      {...otherProps}
    >
      {children}
    </div>
  );
};

export default BuilderAreaTracking;
