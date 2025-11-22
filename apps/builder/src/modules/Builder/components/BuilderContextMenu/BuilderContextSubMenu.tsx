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
        'relative flex cursor-pointer items-center justify-between border-b border-gray-300 px-4 py-1 select-none first:rounded-tl last:border-b-0 hover:bg-blue-100',
        { 'rounded-tr': items?.length === 0 }
      )}
      // onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseOver={handleMouseEnter}
    >
      <div className="flex items-center">Select Parent Element</div>
      <div className="context-sub-menu__arrow">
        <i className="fas fa-chevron-right" />
      </div>
      {showMenu && items && items.length > 0 && (
        <Card
          className="absolute top-0 left-full z-[99999999] flex overflow-hidden rounded-none rounded-l-none rounded-r-sm bg-slate-100 shadow-2xl"
          style={{ width: `${width}px` }}
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
