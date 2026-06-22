import Card from '@plitzi/plitzi-ui/Card';
import { get } from '@plitzi/plitzi-ui/helpers';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { usePopup } from '@plitzi/plitzi-ui/Popup';
import { memo, useCallback, use, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { createStoreHook } from '@plitzi/nexus/react';
import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import SegmentsContext from '@plitzi/sdk-shared/segments/SegmentsContext';

import TemplateForm from '../../Models/TemplateForm';
import BuilderElementTools from '../BuilderElementTools';
import BuilderContextMenuItem from './BuilderContextMenuItem';
import BuilderContextSubMenu from './BuilderContextSubMenu';

import type { BuilderState, SegmentsContextValue } from '@plitzi/sdk-shared';

export type BuilderContextMenuProps = {
  width?: number;
  iframeDOM?: HTMLIFrameElement | null;
  zoom?: number;
  getWindow?: () => Window | null;
};

const BuilderContextMenu = ({ width = 250, iframeDOM, zoom = 1, getWindow }: BuilderContextMenuProps) => {
  const { useStore, useStoreGetter } = createStoreHook<BuilderState>();
  const [getSchema, getElement, getStyle] = useStoreGetter(['schema', 'schema.flat', 'style']);
  const [[elementSelected, setSelected]] = useStore(['elementSelected', 'setSelected']);
  const [element = undefined] = useStore(`schema.flat.${elementSelected}`);
  const { showModal } = useModal();
  const { existsPopup, addPopup } = usePopup();
  const ref = useRef<HTMLDivElement>(null);
  const [clickPosition, setClickPosition] = useState({ x: 0, y: 0 });
  const [xPos, setXPos] = useState('0px');
  const [yPos, setYPos] = useState('0px');
  const [showMenu, setShowMenu] = useState(false);
  const { builderElementPermissions, builderHandler, elementAsTemplate } = use(BuilderContext);
  const builderSegmentsContext = use(SegmentsContext) as SegmentsContextValue<'builder'>;
  const componentConfig = useMemo(
    () => (element ? builderElementPermissions(element) : {}),
    [element, builderElementPermissions]
  );

  const calculatePosition = useCallback(() => {
    let innerHeight = 0;
    let innerWidth = 0;
    ({ innerHeight, innerWidth } = getWindow?.() ?? { innerHeight: 0, innerWidth: 0 });
    let { x, y } = clickPosition;
    const separation = 5;
    if (x + separation + width > innerWidth) {
      x = x - separation - width;
    }

    const height = get(ref.current, 'offsetHeight', 0);
    if (height && y + separation + height > innerHeight) {
      y = y - separation - height;
    }

    if (zoom !== 1) {
      x /= zoom;
      y /= zoom;
    }

    setXPos(`${x}px`);
    setYPos(`${y}px`);
  }, [clickPosition, getWindow, width, zoom]);

  const handleContextMenu = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const closest = (e.target as HTMLElement).closest('.builder__context-menu');
      if (closest) {
        return;
      }

      setShowMenu(true);
      const iframeRect = iframeDOM?.getBoundingClientRect();
      if (!iframeRect) {
        return;
      }

      setClickPosition({ x: iframeRect.left + e.clientX, y: iframeRect.top + e.clientY });
    },
    [iframeDOM]
  );

  const handleClick = useCallback(() => {
    if (!showMenu) {
      return;
    }

    setShowMenu(false);
  }, [showMenu]);

  useEffect(() => {
    if (iframeDOM && iframeDOM.contentWindow) {
      iframeDOM.contentWindow.document.addEventListener('click', handleClick);
      window.document.addEventListener('click', handleClick);
      iframeDOM.contentWindow.document.addEventListener('contextmenu', handleContextMenu);
    }

    return () => {
      if (iframeDOM && iframeDOM.contentWindow) {
        iframeDOM.contentWindow.document.removeEventListener('click', handleClick);
        window.document.removeEventListener('click', handleClick);
        iframeDOM.contentWindow.document.removeEventListener('contextmenu', handleContextMenu);
      }
    };
  }, [handleClick, handleContextMenu, iframeDOM]);

  useLayoutEffect(() => {
    if (ref.current && showMenu) {
      calculatePosition();
    }
  }, [calculatePosition, showMenu]);

  const getPath = useCallback(
    (id?: string, reverse = false, skip: number = 0): string[] => {
      if (!id) {
        return [];
      }

      const element = getElement(id, undefined);
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
        return [id, ...getPath(parentId, true, skip - 1)];
      }

      return [...getPath(parentId, false, skip - 1), id];
    },
    [getElement]
  );

  const handleClickDelete = () => {
    builderHandler('schemaRemoveElement', elementSelected);
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
    const response = await showModal<{ name: string; description?: string; cdnIdentifier: string }>(
      <Modal.Header>
        <h4>Add Template</h4>
      </Modal.Header>,
      ({ onSubmit, onClose }) => (
        <Modal.Body>
          <TemplateForm onSubmit={onSubmit} onClose={onClose} />
        </Modal.Body>
      )
    );

    if (response && element) {
      const { name, description, cdnIdentifier } = response;
      void elementAsTemplate(cdnIdentifier, getSchema(), getStyle(), name, description ?? '', element);
    }
  };

  const handleClickAsSegment = async () => {
    const response = await showModal<{ name: string; description?: string }>(
      <Modal.Header>
        <h4>Add Template</h4>
      </Modal.Header>,
      ({ onSubmit, onClose }) => (
        <Modal.Body>
          <TemplateForm onSubmit={onSubmit} onClose={onClose} />
        </Modal.Body>
      )
    );

    if (response && element) {
      const { name, description } = response;
      void builderSegmentsContext.elementAsSegment(getSchema(), getStyle(), name, description ?? '', element);
    }
  };

  const handleClickCopy = useCallback(() => {
    iframeDOM?.contentWindow?.document.execCommand('copy');
  }, [iframeDOM]);

  const handleClickDuplicate = useCallback(() => {
    builderHandler('schemaCloneElement', elementSelected);
    setShowMenu(false);
  }, [builderHandler, elementSelected]);

  const handleClickParent = useCallback(
    (e: React.MouseEvent, parentId: string) => {
      e.stopPropagation();
      setSelected(parentId);
      setShowMenu(false);
    },
    [setSelected]
  );

  const path = getPath(elementSelected, true, 1);
  const subMenuMemo = useMemo(
    () =>
      path
        .filter(segment => getElement(segment, undefined) && segment !== elementSelected)
        .map(segment => {
          const {
            definition: { label }
          } = getElement(segment);

          return { key: segment, value: label };
        }),
    [path, getElement, elementSelected]
  );

  if (!showMenu) {
    return undefined;
  }

  if (!elementSelected) {
    return (
      <Card
        ref={ref}
        className="builder__context-menu z-99999999 flex flex-col p-3 shadow-2xl"
        style={{
          position: 'fixed',
          top: yPos,
          left: xPos,
          width,
          transform: `scale(${1 / zoom})`,
          transformOrigin: 'top left'
        }}
        size="custom"
      >
        <Card.Body className="w-full">
          <div className="flex h-20 items-center justify-center rounded-sm border-2 border-dashed p-3">
            No components selected.
          </div>
        </Card.Body>
      </Card>
    );
  }

  const { canDelete = true, canTemplate = true } = componentConfig;
  const items = get(element, 'definition.items');

  return (
    <Card
      ref={ref}
      className="builder__context-menu z-99999999 flex overflow-visible rounded-sm bg-slate-100 shadow-2xl dark:bg-zinc-800"
      style={{
        position: 'fixed',
        top: yPos,
        left: xPos,
        width,
        transform: `scale(${1 / zoom})`,
        transformOrigin: 'top left'
      }}
      size="custom"
    >
      <Card.Body className="w-full">
        <div className="flex w-full flex-col">
          <BuilderContextSubMenu onClick={handleClickParent} iframeDOM={iframeDOM} items={subMenuMemo} />
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
      </Card.Body>
    </Card>
  );
};

export default memo(BuilderContextMenu);
