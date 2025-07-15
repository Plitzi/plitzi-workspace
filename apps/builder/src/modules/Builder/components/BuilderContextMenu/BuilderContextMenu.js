// Packages
import React, { memo, useCallback, use, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import get from 'lodash/get';
import noop from 'lodash/noop';
import Card from '@plitzi/plitzi-ui-components/Card';
import usePopup from '@plitzi/plitzi-ui/Popup/usePopup';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';

// Monorepo
import { EventBridgeTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';
import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import BuilderSelectedContext from '@plitzi/sdk-shared/builder/contexts/BuilderSelectedContext';
import BuilderSchemaContext from '@plitzi/sdk-shared/builder/contexts/BuilderSchemaContext';
import BuilderStyleContext from '@plitzi/sdk-shared/builder/contexts/BuilderStyleContext';

// Alias
import TemplateForm from '@pmodules/Templates/Models/TemplateForm';
import TemplatesContext from '@pmodules/Templates/TemplatesContext';
import SegmentsContext from '@pmodules/Segments/SegmentsContext';

// Relatives
import BuilderElementTools from '../BuilderElementTools';
import BuilderContextSubMenu from './BuilderContextSubMenu';
import BuilderContextMenuItem from './BuilderContextMenuItem';

/**
 * @param {{
 *   width?: number;
 *   iframeDOM?: object;
 *   zoom?: number;
 *   getWindow?: () => object;
 * }} props
 * @returns {React.ReactElement}
 */
const BuilderContextMenu = props => {
  const { width = 250, iframeDOM, zoom = 1, getWindow = noop } = props;
  const { showModal } = useModal();
  const { existsPopup, addPopup } = usePopup();
  const ref = useRef(null);
  const [clickPosition, setClickPosition] = useState({ x: 0, y: 0 });
  const [xPos, setXPos] = useState('0px');
  const [yPos, setYPos] = useState('0px');
  const [showMenu, setShowMenu] = useState(false);
  const { builderElementPermissions, builderHandler } = use(BuilderContext);
  const builderTemplatesContext = use(TemplatesContext);
  const builderSegmentsContext = use(SegmentsContext);
  const { elementSelected, setSelected } = use(BuilderSelectedContext);
  const {
    schema,
    schema: { flat }
  } = use(BuilderSchemaContext);
  const { style } = use(BuilderStyleContext);
  const element = useMemo(() => flat[elementSelected], [elementSelected]);
  const componentConfig = useMemo(() => builderElementPermissions(element), [element, builderElementPermissions]);

  const calculatePosition = () => {
    let innerHeight = 0;
    let innerWidth = 0;
    ({ innerHeight, innerWidth } = getWindow());
    let { x, y } = clickPosition;
    const separation = 5;
    if (x + separation + width > innerWidth) {
      x = x - separation - width;
    }

    const height = get(ref.current, 'offsetHeight');
    if (height && y + separation + height > innerHeight) {
      y = y - separation - height;
    }

    if (zoom !== 1) {
      x /= zoom;
      y /= zoom;
    }

    setXPos(`${x}px`);
    setYPos(`${y}px`);
  };

  const handleContextMenu = e => {
    e.preventDefault();
    e.stopPropagation();
    if (showMenu) {
      setShowMenu(false);

      return;
    }

    const closest = e.target.closest('.builder__context-menu');
    if (closest) {
      return;
    }

    setShowMenu(true);
    setClickPosition({ x: e.clientX, y: e.clientY });
  };

  const handleClick = () => setShowMenu(false);

  useEffect(() => {
    if (iframeDOM) {
      iframeDOM.contentWindow.document.addEventListener('click', handleClick);
      iframeDOM.contentWindow.document.addEventListener('contextmenu', handleContextMenu);
    }

    return () => {
      if (iframeDOM && iframeDOM.contentWindow) {
        iframeDOM.contentWindow.document.removeEventListener('click', handleClick);
        iframeDOM.contentWindow.document.removeEventListener('contextmenu', handleContextMenu);
      }
    };
  }, [iframeDOM]);

  useLayoutEffect(() => {
    if (ref.current && showMenu) {
      calculatePosition();
    }
  }, [showMenu]);

  const getPath = (id, reverse = false, skip = 0) => {
    if (!id) {
      return [];
    }

    const element = flat[id];
    if (!element) {
      return [];
    }

    const {
      definition: { parentId }
    } = element;

    if (!parentId) {
      return [id];
    }

    if (skip > 0) {
      return getPath(parentId, reverse, skip - 1);
    }

    if (reverse) {
      return [id, ...getPath(parentId, reverse, skip - 1)];
    }

    return [...getPath(parentId), id, skip - 1];
  };

  const handleClickDelete = () => {
    builderHandler(EventBridgeTypes.SCHEMA_REMOVE_ELEMENT, elementSelected);
    setShowMenu(false);
  };

  const handleClickTools = () => {
    if (!existsPopup('element-tools')) {
      addPopup('element-tools', <BuilderElementTools />, {
        icon: <i className="fas fa-tools text-base" />,
        title: 'Tools',
        resizeHandles: ['se'],
        width: 350,
        placement: 'floating'
      });
    }

    setShowMenu(false);
  };

  const handleClickAsTemplate = async () => {
    const response = await showModal(
      <Modal.Header>
        <h4>Add Template</h4>
      </Modal.Header>,
      ({ onSubmit, onClose }) => (
        <Modal.Body>
          <TemplateForm onSubmit={onSubmit} onClose={onClose} />
        </Modal.Body>
      )
    );

    if (response) {
      const { name, description } = response;
      builderTemplatesContext.elementAsTemplate(schema, style, name, description, element);
    }
  };

  const handleClickAsSegment = async () => {
    const response = await showModal(
      <Modal.Header>
        <h4>Add Template</h4>
      </Modal.Header>,
      ({ onSubmit, onClose }) => (
        <Modal.Body>
          <TemplateForm onSubmit={onSubmit} onClose={onClose} />
        </Modal.Body>
      )
    );

    if (response) {
      const { name, description } = response;
      builderSegmentsContext.elementAsSegment(schema, style, name, description, element);
    }
  };

  const handleClickCopy = useCallback(() => {
    iframeDOM.contentWindow.document.execCommand('copy');
  }, [iframeDOM]);

  const handleClickDuplicate = () => {
    builderHandler(EventBridgeTypes.SCHEMA_CLONE_ELEMENT, elementSelected);
    setShowMenu(false);
  };

  const handleClickParent = parentId => () => {
    setSelected(parentId);
    setShowMenu(false);
  };

  const path = getPath(elementSelected, true, 1);
  const subMenuMemo = useMemo(
    () =>
      path
        .filter(segment => flat[segment] && segment !== elementSelected)
        .map(segment => {
          const {
            definition: { label }
          } = flat[segment];

          return { key: segment, value: label };
        }),
    [path, flat]
  );

  if (!showMenu) {
    return null;
  }

  if (!elementSelected) {
    return (
      <Card
        ref={ref}
        className="builder__context-menu z-[99999999] flex flex-col p-3"
        style={{
          position: 'fixed',
          top: yPos,
          left: xPos,
          width,
          transform: `scale(${1 / zoom})`,
          transformOrigin: 'top left'
        }}
      >
        <div className="flex h-20 items-center justify-center rounded-sm border-2 border-dashed p-3">
          No components selected. Click on a component to select it
        </div>
      </Card>
    );
  }

  const { canDelete = true, canTemplate = true } = componentConfig;
  const items = get(element, 'definition.items');

  return (
    <Card
      ref={ref}
      allowOverflow
      className="builder__context-menu z-[99999999] flex rounded-sm"
      style={{
        position: 'fixed',
        top: yPos,
        left: xPos,
        width,
        transform: `scale(${1 / zoom})`,
        transformOrigin: 'top left'
      }}
    >
      <div className="flex w-full flex-col">
        <BuilderContextSubMenu onClick={handleClickParent} iframeDOM={iframeDOM} parentRef={ref} items={subMenuMemo} />
        <BuilderContextMenuItem title="Copy Element" shortcut="CTRL / CMD + C" onClick={handleClickCopy}>
          <i className="fas fa-copy" />
        </BuilderContextMenuItem>
        <BuilderContextMenuItem title="Open Tools" shortcut="CTRL +" onClick={handleClickTools}>
          <i className="fas fa-tools" />
        </BuilderContextMenuItem>
        {!!items && canTemplate && (
          <BuilderContextMenuItem title="Save As Template" shortcut="CTRL +" onClick={handleClickAsTemplate}>
            <i className="fas fa-cube" />
          </BuilderContextMenuItem>
        )}
        {!!items && canTemplate && (
          <BuilderContextMenuItem title="Save As Segment" shortcut="CTRL +" onClick={handleClickAsSegment}>
            <i className="fas fa-cube" />
          </BuilderContextMenuItem>
        )}
        <BuilderContextMenuItem title="Duplicate Element" shortcut="CTRL +" onClick={handleClickDuplicate}>
          <i className="far fa-clone" />
        </BuilderContextMenuItem>
        {canDelete && (
          <BuilderContextMenuItem title=" Delete Element" shortcut="CTRL +" onClick={handleClickDelete}>
            <i className="fas fa-trash-alt text-red-400" />
          </BuilderContextMenuItem>
        )}
      </div>
    </Card>
  );
};

export default memo(BuilderContextMenu);
