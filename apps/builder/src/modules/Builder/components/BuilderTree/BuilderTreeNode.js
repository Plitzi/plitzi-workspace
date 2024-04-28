// Packages
import React, { memo, useCallback, use, useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';
import get from 'lodash/get';
import camelCase from 'lodash/camelCase';
import usePopup from '@plitzi/plitzi-ui-components/Popup/usePopup';
import Contenteditable from '@plitzi/plitzi-ui-components/ContentEditable';

// Monorepo
import { EventBridgeTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';
import useDataSource from '@plitzi/sdk-data-source/hooks/useDataSource';
import getBindingsDetails from '@plitzi/sdk-data-source/helpers/getBindingsDetails';

// Alias
import BuilderElementTools from '@pmodules/Builder/components/BuilderElementTools';
import BuilderSchemaContext from '@pmodules/Builder/contexts/BuilderSchemaContext';
import BuilderContext from '@pmodules/Builder/BuilderContext';
import { DropDirectionConstants } from '@pmodules/Elements/ElementHelper';

// Relatives
import TreeNodeActionButton from './TreeNodeActionButton';
import useBuilderElement from '../../hooks/useBuilderElement';

const treeNodePadding = 16;

/**
 * @param {{
 *   className?: string;
 *   id?: string;
 *   level?: number;
 *   isOpen?: boolean;
 *   isParent?: boolean;
 *   elementHovered?: boolean;
 *   elementSelected?: boolean;
 *   setOpened?: (id: string, isOpen: boolean) => void;
 *   setDragMetadata?: (metadata: object) => void;
 *   getDragMetadata?: () => object;
 *   resetDragMetadata?: () => void;
 *   setHovered?: (id: string) => void;
 *   setSelected?: (id: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const BuilderTreeNode = props => {
  const {
    className = '',
    id = '',
    level = 0,
    isOpen = false,
    isParent = false,
    elementHovered = false,
    elementSelected = false,
    setOpened = noop,
    setDragMetadata = noop,
    getDragMetadata = noop,
    resetDragMetadata = noop,
    setHovered = noop,
    setSelected = noop
  } = props;
  const { existsPopup, addPopup } = usePopup();
  const {
    builderHandler,
    builderElementPermissions,
    baseContext: { baseElementId }
  } = use(BuilderContext);
  const { builderDropElement, builderSetElementVisibility } = use(BuilderSchemaContext);
  const [dragHovered, setDragHovered] = useState(false);
  const [dragAllowed, setDragAllowed] = useState(false);
  const [dropPosition, setDropPosition] = useState();
  const clientRect = useRef({});
  const ref = useRef(null);
  const element = useBuilderElement(id);
  const { label, parentId, items, canDelete, canDragDrop, theme } = useMemo(() => {
    const {
      definition: { label, parentId, items, initialState }
    } = element;
    const { canDelete = true, canDragDrop = true, overlay } = builderElementPermissions(element);

    return {
      label,
      parentId,
      items,
      canDelete,
      canDragDrop,
      theme: overlay?.theme ?? 'normal',
      isVisible: get(initialState, 'visibility', true)
    };
  }, [element, builderElementPermissions]);

  const dataSource = useDataSource({ id, mode: 'read' });
  const isVisible = useMemo(() => {
    const { attributes, definition } = element;
    const bindingData = getBindingsDetails(dataSource, attributes, definition);

    return get(bindingData, 'definition.initialState.visibility', true);
  }, [element]);

  const parentElement = useBuilderElement(parentId);

  const handleClick = e => {
    e.stopPropagation();
    setOpened(id, !isOpen);
  };

  const handleClickSelect = () => {
    setSelected(id);
  };

  const handleClickTools = e => {
    e.stopPropagation();
    if (!existsPopup('element-tools')) {
      const title = (
        <>
          <i className="fas fa-tools m-1 text-base" />
          Tools
        </>
      );
      addPopup('element-tools', <BuilderElementTools />, {
        resizeHandles: ['se'],
        width: 350,
        title,
        placement: 'POPUP_PLACEMENT_FLOATING'
      });
    }
  };

  const handleClickVisibility = useCallback(() => {
    builderSetElementVisibility(id, !isVisible);
    setHovered(null);
  }, [builderSetElementVisibility, setHovered, id, isVisible]);

  const handleClickDelete = useCallback(
    async e => {
      e.stopPropagation();
      builderHandler(EventBridgeTypes.SCHEMA_REMOVE_ELEMENT, id);
    },
    [builderHandler, id]
  );

  useEffect(() => {
    clientRect.current = ref.current.getBoundingClientRect();
  }, [ref.current]);

  const handleDragStart = e => {
    const offsetX = 0;
    const offsetY = 0;
    setDragMetadata({
      isDragging: true,
      element,
      parentElement,
      elementHoveredId: null,
      dropPosition: null
    });
    setHovered(null);
    setSelected(null);
    e.stopPropagation();
    e.dataTransfer.setDragImage(e.currentTarget, offsetX, offsetY);
  };

  const handleDragEnd = () => {
    resetDragMetadata();
    setDragHovered(false);
    setDropPosition();
    setDragAllowed(true);
  };

  const handleDragOver = e => {
    e.preventDefault();
    const { elementHoveredId } = getDragMetadata();
    let { element } = getDragMetadata();
    if (!element) {
      let type = e.dataTransfer.types[0];
      if (!type) {
        return;
      }

      type = type.split('##');
      if (type.length !== 2 || (type[0] !== 'add' && type[0] !== 'move')) {
        return;
      }

      element = { definition: { type: camelCase(type[1]) } };
      setDragMetadata({ element });
    }

    if (element.id === id) {
      return;
    }

    const offsetY = e.clientY - clientRect.current.top - clientRect.current.height / 2;
    const offsetX = e.clientX - clientRect.current.left - treeNodePadding * 2;
    let newDropPosition;
    if ((offsetX > 0 && !!items) || id === baseElementId) {
      newDropPosition = DropDirectionConstants.DROP_DIRECTION_INSIDE;
    } else if (offsetY > 0) {
      newDropPosition = DropDirectionConstants.DROP_DIRECTION_BOTTOM;
    } else {
      newDropPosition = DropDirectionConstants.DROP_DIRECTION_TOP;
    }

    if (elementHoveredId !== id || dropPosition !== newDropPosition) {
      setDragMetadata({ elementHoveredId: id, dropPosition: newDropPosition });
    }

    if (!dragHovered || dropPosition !== newDropPosition) {
      const {
        definition: { type }
      } = element;
      setDragHovered(true);
      setDropPosition(newDropPosition);
      setDragAllowed(isDragAllowed(type, newDropPosition));
    }
  };

  const handleDragLeave = () => {
    if (dragHovered) {
      setDragHovered(false);
      setDragAllowed(true);
      setDropPosition();
    }
  };

  const isDragAllowed = (dataType, dropPosition) => {
    if (!element) {
      return true;
    }

    let { itemsAllowed, itemsNotAllowed } = builderElementPermissions(element);
    if (itemsNotAllowed && dropPosition !== DropDirectionConstants.DROP_DIRECTION_INSIDE) {
      ({ itemsAllowed, itemsNotAllowed } = builderElementPermissions(parentElement));
    }

    if (itemsAllowed && itemsAllowed.length > 0 && !itemsAllowed.includes(dataType)) {
      return false;
    }

    if (itemsNotAllowed && itemsNotAllowed.includes(dataType)) {
      return false;
    }

    return true;
  };

  const handleDrop = e => {
    e.stopPropagation();
    e.preventDefault();
    const { element, dropPosition } = getDragMetadata();
    const { id: elementId } = element;
    let data = e.dataTransfer.getData(e.dataTransfer.types[0]);
    setDragHovered(false);
    setDragAllowed(true);
    setDropPosition();
    resetDragMetadata();
    if (((elementId && id === elementId) || !elementId) && !data) {
      return;
    }

    const {
      definition: { type }
    } = element;
    if ((elementId && id === elementId) || !elementId) {
      data = JSON.parse(data);
      builderDropElement(`add##${type}`, data, dropPosition, id, baseElementId);
    } else {
      builderDropElement(`move##${type}`, { element, id: element.id }, dropPosition, id, baseElementId);
    }
  };

  const handleMouseLeave = e => {
    e.stopPropagation();
    if (elementHovered) {
      setHovered(null);
    }
  };

  const handleHover = e => {
    e.stopPropagation();
    if (!elementHovered) {
      setHovered(id);
    }
  };

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

  let paddingRight = level * treeNodePadding;
  if (!isParent) {
    paddingRight += 1;
  }

  return (
    <div
      className={classNames('tree__node cursor-pointer pr-1 flex', className, {
        'node--empty': !isParent,
        'bg-blue-100 text-black': elementHovered && !elementSelected,
        'bg-blue-200 text-white': elementSelected,
        'node--dragging': dragHovered
      })}
      data-tree-id={id}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      draggable={canDragDrop}
      onMouseOver={handleHover}
      onMouseLeave={handleMouseLeave}
      onFocus={noop}
      tabIndex={-1}
    >
      <div className="w-full flex" style={{ paddingLeft: `${paddingRight}px` }}>
        {isOpen && isParent && <div className="line" />}
        {isParent && (
          <div
            className={classNames('w-4 flex items-center cursor-pointer', {
              'node--open': isOpen
            })}
            onClick={handleClick}
          >
            {isOpen && <i className="fas fa-caret-down flex" />}
            {!isOpen && <i className="fas fa-caret-right flex" />}
          </div>
        )}
        <div ref={ref} className="flex relative grow basis-0 overflow-hidden" onClick={handleClickSelect}>
          <Contenteditable
            className={classNames(
              'truncate focus-visible:text-clip focus-visible:overflow-auto focus-visible:text-black focus-visible:outline-blue-500',
              {
                'opacity-30': dragHovered
              }
            )}
            value={label}
            onChange={handleChange}
            openMode="doubleClick"
          />
          {dragHovered && (
            <span
              className={classNames('tree__node-drop-indicator p-1', {
                [`drop-indicator--${dropPosition}`]: dropPosition,
                'drop-indicator--not-allowed': !dragAllowed
              })}
            />
          )}
        </div>
        <div
          className={classNames('justify-end', {
            flex: elementSelected || !isVisible || elementHovered,
            hidden: !elementSelected && isVisible && !elementHovered
          })}
        >
          <TreeNodeActionButton
            isVisible={!isVisible || elementSelected || elementHovered}
            title={isVisible ? 'Hide' : 'Unhide'}
            onClick={handleClickVisibility}
            theme={theme}
          >
            {isVisible === true && <i className="fas fa-eye" />}
            {isVisible === false && <i className="fas fa-eye-slash" />}
          </TreeNodeActionButton>
          <TreeNodeActionButton isVisible={elementSelected} title="Tools" onClick={handleClickTools} theme={theme}>
            <i className="fas fa-tools" />
          </TreeNodeActionButton>
          {canDelete && (
            <TreeNodeActionButton isVisible={elementSelected} title="Remove" onClick={handleClickDelete} isRemoving>
              <i className="fas fa-trash-alt" />
            </TreeNodeActionButton>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(BuilderTreeNode);
