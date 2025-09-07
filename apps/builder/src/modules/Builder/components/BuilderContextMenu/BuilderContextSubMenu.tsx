import Card from '@plitzi/plitzi-ui/Card';
import classNames from 'classnames';
import { useRef, useState } from 'react';

import BuilderContextMenuItem from './BuilderContextMenuItem';

import type { RefObject } from 'react';

const itemsDefault = [];

export type BuilderContextSubMenuProps = {
  items?: { key: string; value: string }[];
  width?: number;
  iframeDOM?: HTMLIFrameElement | null;
  parentRef?: RefObject<HTMLDivElement | null>;
  onClick?: (key: string) => () => void;
};

const BuilderContextSubMenu = ({
  items = itemsDefault,
  width = 150,
  iframeDOM,
  parentRef,
  onClick
}: BuilderContextSubMenuProps) => {
  const [showMenu, setShowMenu] = useState(false);
  const [top, setTop] = useState('0px');
  const [left, setLeft] = useState('0px');
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (!ref.current) {
      return;
    }

    let { innerWidth } = window;
    if (!iframeDOM) {
      return;
    }

    innerWidth = iframeDOM.contentWindow?.innerWidth ?? 0;
    const { offsetTop, offsetWidth, offsetLeft } = ref.current;
    const { offsetLeft: parentOffsetLeft } = parentRef?.current ?? { offsetLeft: 0 };
    let left = offsetLeft + offsetWidth;
    if (parentOffsetLeft + offsetWidth + width > innerWidth) {
      left = offsetLeft - width;
    }

    setShowMenu(true);
    setTop(`${offsetTop}px`);
    setLeft(`${left}px`);
  };

  const handleMouseLeave = () => setShowMenu(false);

  return (
    <div
      ref={ref}
      className={classNames(
        'flex cursor-pointer items-center justify-between border-b border-gray-300 px-4 py-1 select-none first:rounded-tl last:border-b-0 hover:bg-blue-100',
        { 'rounded-tr': items.length === 0 }
      )}
      // onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseOver={handleMouseEnter}
    >
      <div className="flex items-center">
        {/* <i className="" /> */}
        Select Parent Element
        {showMenu && items.length > 0 && (
          <Card
            className="absolute z-[99999999] flex rounded-tl-none rounded-bl-none shadow-2xl"
            style={{ position: 'absolute', top, left, width: `${width}px` }}
          >
            <Card.Body className="w-full">
              <div className="flex w-full flex-col">
                {items.map(item => (
                  <BuilderContextMenuItem key={item.key} title={item.value} onClick={onClick?.(item.key)} />
                ))}
              </div>
            </Card.Body>
          </Card>
        )}
      </div>
      <div className="context-sub-menu__arrow">
        <i className="fas fa-chevron-right" />
      </div>
    </div>
  );
};

export default BuilderContextSubMenu;
