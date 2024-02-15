// Packages
import React, { useContext, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import throttle from 'lodash/throttle';
import get from 'lodash/get';
import classNames from 'classnames';
import { ComponentContext } from '@plitzi/plitzi-sdk';
import useToast from '@plitzi/plitzi-ui-components/Toast/useToast';

// Monorepo
import { EventBridgeTypes } from '@repo/event-bridge/EventBridgeHelper';

// Alias
import BuilderSubscriptionsContext from '@pmodules/Network/contexts/BuilderSubscriptionsContext';
import { RealTimeEventTypes } from '@pmodules/Network/helpers/EventTypes';
import AppContext from '@pmodules/App/AppContext';
import UndoableContext from '@pmodules/Undoable/UndoableContext';
import FlatMap from '@pmodules/Schema/helpers/FlatMap';
import NetworkContext from '@pmodules/Network/NetworkContext';

// Relatives
import BuilderContext from '../../BuilderContext';
import BuilderHoveredContext from '../../contexts/BuilderHoveredContext';
import BuilderSelectedContext from '../../contexts/BuilderSelectedContext';
import { DISPLAY_BORDER_BLACK, DISPLAY_BORDER_WHITE, processPaste } from '../../BuilderHelper';
import BuilderSchemaContext from '../../contexts/BuilderSchemaContext';
import BuilderStyleContext from '../../contexts/BuilderStyleContext';

const BuilderAreaTracking = props => {
  const {
    children,
    className,
    iframeDOM,
    isActive = false,
    iframeScaleX = 1,
    previewMode = false,
    ...otherProps
  } = props;
  const { supportRealTime, subscriptionsPush } = useContext(BuilderSubscriptionsContext);
  const { elementHovered, setHovered } = useContext(BuilderHoveredContext);
  const { elementSelected, setSelected } = useContext(BuilderSelectedContext);
  const {
    multiPagesMode,
    builderHandler,
    baseContext: { baseElementId },
    baseElementIdOriginal,
    builderSetBaseContext
  } = useContext(BuilderContext);
  const { schema, builderDropElement } = useContext(BuilderSchemaContext);
  const { style } = useContext(BuilderStyleContext);
  const { displayBorderComponents } = useContext(AppContext);
  const { addToast } = useToast();
  const { canRedo, canUndo, undoableRedo, undoableUndo } = useContext(UndoableContext);
  const { mutate } = useContext(NetworkContext);
  const { componentDefinitions } = useContext(ComponentContext);

  const schemaRef = useRef(schema);
  schemaRef.current = schema;
  const styleRef = useRef(style);
  styleRef.current = style;

  const handleMouseEnter = () => {
    if (supportRealTime) {
      subscriptionsPush({ type: RealTimeEventTypes.MOUSE, payload: { action: 'mouseEnter', rootId: baseElementId } });
    }
  };

  const handleMouseLeave = () => {
    if (elementHovered) {
      setHovered(null);
    }

    if (supportRealTime) {
      subscriptionsPush({ type: RealTimeEventTypes.MOUSE, payload: { action: 'mouseLeave', rootId: baseElementId } });
    }
  };

  const callbackPosition = (x, y) => {
    if (isActive && supportRealTime) {
      subscriptionsPush({
        type: RealTimeEventTypes.MOUSE,
        payload: {
          action: 'mouseMove',
          x,
          y,
          rootId: baseElementId
        }
      });
    }
  };

  const handleMouseMove = e => {
    callbackPositionDebounced.current(e.clientX * iframeScaleX, e.clientY * iframeScaleX);
    if (previewMode) {
      return;
    }

    const closest = e.target.closest('.builder__overlay');
    if (closest) {
      return;
    }

    const target = e.target.closest('.plitzi-component');
    if (!target) {
      return;
    }

    const { id } = target.dataset;
    if ((!id && !elementHovered) || id === elementHovered) {
      return;
    }

    setHovered(id);
  };

  const handleClickElements = e => {
    if (previewMode) {
      return;
    }

    const closest = e.target.closest('.plitzi-component');
    if (!closest) {
      return;
    }

    const id = get(closest, 'dataset.id');
    const rootId = get(closest, 'dataset.rootId');
    if ((!id && !elementSelected) || id === elementSelected || rootId !== baseElementId) {
      return;
    }

    setSelected(id, iframeDOM);
  };

  const callbackPositionDebounced = useRef(throttle(callbackPosition, 50));

  useEffect(() => {
    if (supportRealTime) {
      callbackPositionDebounced.current = throttle(callbackPosition, 50);
    }
  }, [subscriptionsPush, baseElementId]);

  const handleKeyDown = useCallback(
    async e => {
      switch (e.key) {
        case 'Delete':
        case 'Backspace': {
          if (
            elementSelected &&
            iframeDOM.contentWindow.document.body.contains(e.target) &&
            elementSelected !== baseElementId &&
            get(schemaRef, `current.flat.${elementSelected}`)
          ) {
            builderHandler(EventBridgeTypes.SCHEMA_REMOVE_ELEMENT, elementSelected);
          }

          break;
        }

        case 'Escape': {
          if (elementSelected) {
            setSelected(null);
          } else if (!elementSelected && baseElementId !== baseElementIdOriginal) {
            builderSetBaseContext(baseElementIdOriginal);
          }

          break;
        }

        case 'Y':
        case 'y': {
          if ((e.ctrlKey || e.metaKey) && iframeDOM.contentWindow.document.body.contains(e.target) && canRedo) {
            if (elementSelected) {
              setSelected(null);
            }

            undoableRedo();

            break;
          }

          break;
        }

        case 'Z':
        case 'z': {
          if ((e.ctrlKey || e.metaKey) && iframeDOM.contentWindow.document.body.contains(e.target) && canUndo) {
            if (elementSelected) {
              setSelected(null);
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
      baseElementIdOriginal,
      builderHandler,
      builderSetBaseContext,
      canRedo,
      canUndo,
      undoableRedo,
      undoableUndo
    ]
  );

  const handleCopy = useCallback(
    e => {
      if (!elementSelected) {
        return;
      }

      if (elementSelected === baseElementId) {
        return;
      }

      if (!iframeDOM.contentWindow.document.body.contains(e.target) && document.body !== e.target) {
        return;
      }

      const { elements, elementsStyle } = FlatMap.flatAsTemplate(
        get(schemaRef, 'current.flat', {}),
        get(styleRef, 'current', { platform: { desktop: {}, tablet: {}, mobile: {} }, cache: '' }),
        elementSelected
      );
      e.clipboardData.setData(
        'application/json',
        JSON.stringify({ type: 'add##plitzi-template', payload: { elements, style: elementsStyle, assets: [] } })
      );

      addToast('Element copied into the clipboard', { appeareance: 'info', autoDismiss: true, placement: 'top-right' });
      e.preventDefault();
    },
    [elementSelected, addToast, baseElementId]
  );

  const handlePaste = useCallback(
    async e => {
      if (!iframeDOM.contentWindow.document.body.contains(e.target) && document.body !== e.target) {
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
        addToast("Can't drop it here. Try another spot!", {
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

  useLayoutEffect(() => {
    if (iframeDOM && !previewMode) {
      iframeDOM.contentWindow.document.addEventListener('copy', handleCopy);
      iframeDOM.contentWindow.document.addEventListener('paste', handlePaste);
    }

    if (!previewMode) {
      window.document.addEventListener('copy', handleCopy);
      window.document.addEventListener('paste', handlePaste);
    }

    return () => {
      if (iframeDOM && !previewMode) {
        iframeDOM.contentWindow.document.removeEventListener('copy', handleCopy);
        iframeDOM.contentWindow.document.removeEventListener('paste', handlePaste);
      }

      if (!previewMode) {
        window.document.removeEventListener('copy', handleCopy);
        window.document.removeEventListener('paste', handlePaste);
      }
    };
  }, [iframeDOM, handleCopy, handlePaste, previewMode]);

  useLayoutEffect(() => {
    if (iframeDOM && !previewMode && !multiPagesMode) {
      iframeDOM.contentWindow.document.addEventListener('keydown', handleKeyDown);
    }

    if (!previewMode && !multiPagesMode) {
      window.document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      if (iframeDOM && !previewMode && !multiPagesMode) {
        iframeDOM.contentWindow.document.removeEventListener('keydown', handleKeyDown);
      }

      if (!previewMode && !multiPagesMode) {
        window.document.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [previewMode, handleKeyDown, iframeDOM]);

  return (
    <div
      className={classNames(className, {
        'builder--display-component-border display-component-border--black':
          displayBorderComponents === DISPLAY_BORDER_BLACK && !previewMode,
        'builder--display-component-border display-component-border--white':
          displayBorderComponents === DISPLAY_BORDER_WHITE && !previewMode
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

BuilderAreaTracking.propTypes = {
  iframeDOM: PropTypes.object,
  children: PropTypes.node,
  className: PropTypes.string,
  iframeScaleX: PropTypes.number,
  isActive: PropTypes.bool,
  previewMode: PropTypes.bool
};

export default BuilderAreaTracking;
