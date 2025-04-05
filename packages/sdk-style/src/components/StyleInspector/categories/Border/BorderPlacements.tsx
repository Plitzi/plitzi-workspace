import Icon from '@plitzi/plitzi-ui/Icon';
import BorderPlacementBottom from '@plitzi/plitzi-ui/icons/BorderPlacementBottom';
import BorderPlacementCenter from '@plitzi/plitzi-ui/icons/BorderPlacementCenter';
import BorderPlacementLeft from '@plitzi/plitzi-ui/icons/BorderPlacementLeft';
import BorderPlacementRight from '@plitzi/plitzi-ui/icons/BorderPlacementRight';
import BorderPlacementTop from '@plitzi/plitzi-ui/icons/BorderPlacementTop';
import classNames from 'classnames';
import { useCallback } from 'react';

export type Placement = 'all' | 'top' | 'bottom' | 'left' | 'right';

export type BorderPlacementsProps = {
  currentPlacement: Placement;
  setCurrentPlacement: (value: Placement) => void;
};

const BorderPlacements = ({ currentPlacement, setCurrentPlacement }: BorderPlacementsProps) => {
  const handleClick = useCallback(
    (partialValue: Placement) => () => setCurrentPlacement(partialValue),
    [setCurrentPlacement]
  );

  return (
    <div className="mx-auto grid grid-cols-3 grid-rows-3 gap-2 place-items-center">
      <Icon
        size="2xl"
        className={classNames('col-start-2 cursor-pointer p-0.5 rounded', {
          'bg-primary-100': currentPlacement === 'top'
        })}
        onClick={handleClick('top')}
        active={currentPlacement === 'top'}
      >
        <BorderPlacementTop />
      </Icon>

      <Icon
        size="2xl"
        className={classNames('row-start-2 cursor-pointer p-0.5 rounded', {
          'bg-primary-100': currentPlacement === 'left'
        })}
        onClick={handleClick('left')}
        active={currentPlacement === 'left'}
      >
        <BorderPlacementLeft />
      </Icon>
      <Icon
        size="2xl"
        className={classNames('row-start-2 grid grid-cols-3 cursor-pointer p-0.5 rounded', {
          'bg-primary-100': currentPlacement === 'all'
        })}
        onClick={handleClick('all')}
        active={currentPlacement === 'all'}
      >
        <BorderPlacementCenter />
      </Icon>
      <Icon
        size="2xl"
        className={classNames('row-start-2 cursor-pointer p-0.5 rounded', {
          'bg-primary-100': currentPlacement === 'right'
        })}
        onClick={handleClick('right')}
        active={currentPlacement === 'right'}
      >
        <BorderPlacementRight />
      </Icon>
      <Icon
        size="2xl"
        className={classNames('col-start-2 row-start-3 cursor-pointer p-0.5 rounded', {
          'bg-primary-100': currentPlacement === 'bottom'
        })}
        onClick={handleClick('bottom')}
        active={currentPlacement === 'bottom'}
      >
        <BorderPlacementBottom />
      </Icon>
    </div>
  );
};

export default BorderPlacements;
