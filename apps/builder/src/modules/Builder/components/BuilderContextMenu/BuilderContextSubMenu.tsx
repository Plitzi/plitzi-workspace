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
        'hover:bg-primary-50 hover:text-primary-700 dark:hover:bg-primary-400/15 dark:hover:text-primary-200 text-ui-fg relative mx-1 flex h-8 cursor-pointer items-center justify-between gap-6 rounded-md px-2.5 text-[13px] transition-colors duration-100 select-none'
      )}
      onMouseLeave={handleMouseLeave}
      onMouseOver={handleMouseEnter}
    >
      <div className="flex items-center">Select Parent Element</div>
      <div className="context-sub-menu__arrow text-ui-fg-subtle text-[11px]">
        <i className="fas fa-chevron-right" />
      </div>
      {showMenu && items && items.length > 0 && (
        <Card
          className="border-ui-line bg-ui-overlay absolute -top-1 left-full z-99999999 ml-1 flex overflow-hidden rounded-lg border py-1 shadow-xl"
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
