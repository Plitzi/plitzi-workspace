import Card from '@plitzi/plitzi-ui/Card';
import { get } from '@plitzi/plitzi-ui/helpers';
import { usePopup } from '@plitzi/plitzi-ui/Popup';
import { memo, useCallback, use, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import { elementOf } from '@plitzi/sdk-shared/helpers/eventTarget';
import { useBuilderStore, useBuilderStoreGetter } from '@plitzi/sdk-shared/store';
import useSaveAsComponent from '@pmodules/Components/useSaveAsComponent';
import { deleteKey, withModifier } from '@pmodules/Keyboard';

import { REUSE } from '../../helpers/reuse';
import useSaveAsSnippet from '../../hooks/useSaveAsSnippet';
import BuilderElementTools from '../BuilderElementTools';
import BuilderContextMenuItem from './BuilderContextMenuItem';
import BuilderContextSubMenu from './BuilderContextSubMenu';

export type BuilderContextMenuProps = {
  width?: number;
  iframeDOM?: HTMLIFrameElement | null;
  zoom?: number;
  getWindow?: () => Window | null;
};

const BuilderContextMenu = ({ width = 250, iframeDOM, zoom = 1, getWindow }: BuilderContextMenuProps) => {
  const [getElement] = useBuilderStoreGetter(['schema.flat']);
  const [[elementSelected, setSelected]] = useBuilderStore(['elementSelected', 'setSelected']);
  const [element = undefined] = useBuilderStore(`schema.flat.${elementSelected}`);
  const { existsPopup, addPopup } = usePopup();
  const ref = useRef<HTMLDivElement>(null);
  const [clickPosition, setClickPosition] = useState({ x: 0, y: 0 });
  const [xPos, setXPos] = useState('0px');
  const [yPos, setYPos] = useState('0px');
  const [showMenu, setShowMenu] = useState(false);
  const { builderElementPermissions, builderHandler } = use(BuilderContext);
  const saveAsComponent = useSaveAsComponent();
  const saveAsSnippet = useSaveAsSnippet();
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

      const closest = elementOf(e.target)?.closest('.builder__context-menu');
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

  const handleClickAsComponent = async () => {
    setShowMenu(false);
    if (element) {
      await saveAsComponent(element);
    }
  };

  const handleClickAsSnippet = async () => {
    setShowMenu(false);
    if (element) {
      await saveAsSnippet(element);
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
        className="builder__context-menu z-99999999 flex flex-col rounded-lg border border-gray-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
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
          <div className="flex h-16 items-center justify-center text-center text-xs text-gray-500 dark:text-zinc-400">
            Select an element to see what you can do with it.
          </div>
        </Card.Body>
      </Card>
    );
  }

  const { canDelete = true, canSnippet = true } = componentConfig;
  const items = get(element, 'definition.items');

  return (
    <Card
      ref={ref}
      className="builder__context-menu z-99999999 flex overflow-visible rounded-lg border border-gray-200 bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
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
          <div className="my-1 h-px bg-gray-200 dark:bg-zinc-700" />
          <BuilderContextMenuItem title="Copy Element" shortcut={withModifier('C')} onClick={handleClickCopy}>
            <i className="fas fa-copy" />
          </BuilderContextMenuItem>
          <BuilderContextMenuItem title="Duplicate Element" onClick={handleClickDuplicate}>
            <i className="far fa-clone" />
          </BuilderContextMenuItem>
          <BuilderContextMenuItem title="Open Tools" onClick={handleClickTools}>
            <i className="fas fa-tools" />
          </BuilderContextMenuItem>
          {((!!items && canSnippet) || (canDelete && !!element?.definition.parentId)) && (
            <div className="my-1 h-px bg-gray-200 dark:bg-zinc-700" />
          )}
          {!!items && canSnippet && (
            <BuilderContextMenuItem title="Save As Snippet" hint={REUSE.snippet.hint} onClick={handleClickAsSnippet}>
              <i className={REUSE.snippet.icon} />
            </BuilderContextMenuItem>
          )}
          {canDelete && !!element?.definition.parentId && (
            <BuilderContextMenuItem
              title="Save As Component"
              hint={REUSE.component.hint}
              onClick={handleClickAsComponent}
            >
              <i className={REUSE.component.icon} />
            </BuilderContextMenuItem>
          )}
          {canDelete && (
            <>
              <div className="my-1 h-px bg-gray-200 dark:bg-zinc-700" />
              <BuilderContextMenuItem
                title="Delete Element"
                intent="danger"
                shortcut={deleteKey}
                onClick={handleClickDelete}
              >
                <i className="fas fa-trash-alt" />
              </BuilderContextMenuItem>
            </>
          )}
        </div>
      </Card.Body>
    </Card>
  );
};

export default memo(BuilderContextMenu);
