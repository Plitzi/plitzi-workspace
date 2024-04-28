// Package
import React from 'react';
import noop from 'lodash/noop';
import classNames from 'classnames';

// Alias
import Icons from '@pcomponents/Icons';

/**
 * @param {{
 *   currentPlacement: string;
 *   setCurrentPlacement: (value: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const BorderPlacements = props => {
  const { currentPlacement, setCurrentPlacement = noop } = props;

  const handleClick = (type, partialValue) => () => {
    setCurrentPlacement(partialValue);
  };

  return (
    <div className="mx-auto grid grid-cols-3 grid-rows-3 gap-1">
      <div className="h-6 w-6" />
      <Icons
        type="BorderPlacementTop"
        width={30}
        height={30}
        className={classNames('rounded cursor-pointer hover:bg-white p-1', {
          'bg-white': currentPlacement === 'top'
        })}
        onClick={handleClick('placement', 'top')}
      />
      <div className="h-6 w-6" />
      <Icons
        type="BorderPlacementLeft"
        width={30}
        height={30}
        className={classNames('rounded cursor-pointer hover:bg-white p-1', {
          'bg-white': currentPlacement === 'left'
        })}
        onClick={handleClick('placement', 'left')}
      />
      <Icons
        type="BorderPlacementCenter"
        width={30}
        height={30}
        className={classNames('rounded cursor-pointer hover:bg-white p-1', {
          'bg-white': currentPlacement === 'all'
        })}
        onClick={handleClick('placement', 'all')}
      />
      <Icons
        type="BorderPlacementRight"
        width={30}
        height={30}
        className={classNames('rounded cursor-pointer hover:bg-white p-1', {
          'bg-white': currentPlacement === 'right'
        })}
        onClick={handleClick('placement', 'right')}
      />
      <div className="h-6 w-6" />
      <Icons
        type="BorderPlacementBottom"
        width={30}
        height={30}
        className={classNames('rounded cursor-pointer hover:bg-white p-1', {
          'bg-white': currentPlacement === 'bottom'
        })}
        onClick={handleClick('placement', 'bottom')}
      />
      <div className="h-6 w-6" />
    </div>
  );
};

export default BorderPlacements;
