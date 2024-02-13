// Packages
import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import Card from '@plitzi/plitzi-ui-components/Card';
import classNames from 'classnames';

// Alias

// Relatives
import BuilderContextMenuItem from './BuilderContextMenuItem';

const itemsDefault = [];

const BuilderContextSubMenu = props => {
  const { items = itemsDefault, width = 250, iframeDOM, parentRef, onClick = noop } = props;
  const [showMenu, setShowMenu] = useState(false);
  const [top, setTop] = useState('0px');
  const [left, setLeft] = useState('0px');
  const ref = useRef(null);

  const handleMouseEnter = () => {
    if (!ref.current) {
      return;
    }

    let { innerWidth } = window;
    if (!iframeDOM) {
      return;
    }

    innerWidth = iframeDOM.contentWindow.innerWidth;
    const { offsetTop, offsetWidth, offsetLeft } = ref.current;
    const { offsetLeft: parentOffsetLeft } = parentRef.current;
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
        'flex items-center first:rounded-tl justify-between border-b border-gray-300 select-none py-1 px-4 hover:bg-blue-100 cursor-pointer last:border-b-0',
        { 'rounded-tr': items.length === 0 }
      )}
      // onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseOver={handleMouseEnter}
      onFocus={noop}
    >
      <div className="flex items-center">
        {/* <i className="" /> */}
        Select Parent Element
        {showMenu && items.length > 0 && (
          <Card
            className="z-[99999999] flex rounded-bl-none rounded-tl-none"
            style={{ position: 'absolute', top, left, width: `${width}px` }}
          >
            <div className="w-full flex flex-col">
              {items.map(item => (
                <BuilderContextMenuItem key={item.key} title={item.value} onClick={onClick(item.key)} />
              ))}
            </div>
          </Card>
        )}
      </div>
      <div className="context-sub-menu__arrow">
        <i className="fas fa-chevron-right" />
      </div>
    </div>
  );
};

BuilderContextSubMenu.propTypes = {
  iframeDOM: PropTypes.object,
  parentRef: PropTypes.object,
  items: PropTypes.array,
  width: PropTypes.number,
  onClick: PropTypes.func
};

export default BuilderContextSubMenu;
