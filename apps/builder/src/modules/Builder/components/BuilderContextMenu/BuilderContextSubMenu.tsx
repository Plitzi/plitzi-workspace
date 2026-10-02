import Card from '@plitzi/plitzi-ui/Card';
import clsx from 'clsx';
import { useCallback, useRef, useState } from 'react';

import BuilderContextMenuItem from './BuilderContextMenuItem';

import type { MouseEvent } from 'react';

export type BuilderContextSubMenuProps = {
  items?: { key: string; value: string }[];
  width?: number;
  iframeDOM?: HTMLIFrameElement | null;
  onClick?: (e: MouseEvent, id: string) => void;
};

const BuilderContextSubMenu = ({ items, width = 150, iframeDOM, onClick }: BuilderContextSubMenuProps) => {
  const [showMenu, setShowMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseEnter = useCallback(() => {
    if (!ref.current || !iframeDOM) {
      return;
    }

    setShowMenu(true);
  }, [iframeDOM]);

  const handleMouseLeave = useCallback(() => setShowMenu(false), []);

  return (
    <div
      ref={ref}
      className={clsx(
        'hover:bg-primary-50 hover:text-primary-700 dark:hover:bg-primary-400/15 dark:hover:text-primary-200 relative mx-1 flex h-8 cursor-pointer items-center justify-between gap-6 rounded-md px-2.5 text-[13px] text-zinc-800 transition-colors duration-100 select-none dark:text-zinc-200'
      )}
      onMouseLeave={handleMouseLeave}
      onMouseOver={handleMouseEnter}
    >
      <div className="flex items-center">Select Parent Element</div>
      <div className="context-sub-menu__arrow text-[10px] text-zinc-400 dark:text-zinc-500">
        <i className="fas fa-chevron-right" />
      </div>
      {showMenu && items && items.length > 0 && (
        <Card
          className="absolute -top-1 left-full z-99999999 ml-1 flex overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
          style={{ width: `${width}px` }}
          size="custom"
        >
          <Card.Body className="w-full">
            <div className="flex w-full flex-col">
              {items.map(item => (
                <BuilderContextMenuItem key={item.key} id={item.key} title={item.value} onClick={onClick} />
              ))}
            </div>
          </Card.Body>
        </Card>
      )}
    </div>
  );
};

export default BuilderContextSubMenu;
