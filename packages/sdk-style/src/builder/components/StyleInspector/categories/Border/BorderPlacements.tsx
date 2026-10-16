import Icon from '@plitzi/plitzi-ui/Icon';
import BorderPlacementBottom from '@plitzi/plitzi-ui/icons/BorderPlacementBottom';
import BorderPlacementCenter from '@plitzi/plitzi-ui/icons/BorderPlacementCenter';
import BorderPlacementLeft from '@plitzi/plitzi-ui/icons/BorderPlacementLeft';
import BorderPlacementRight from '@plitzi/plitzi-ui/icons/BorderPlacementRight';
import BorderPlacementTop from '@plitzi/plitzi-ui/icons/BorderPlacementTop';
import clsx from 'clsx';
import { useCallback } from 'react';

import CategorySection from '../../components/CategorySection';

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
    <CategorySection label="Side">
      <div className="mx-auto grid grid-cols-3 grid-rows-3 place-items-center gap-1.5">
        <Icon
          size="2xl"
          className={clsx('col-start-2 cursor-pointer rounded p-0.5', {
            'bg-primary-500/15 dark:bg-primary-400/20': currentPlacement === 'top'
          })}
          title="Top border"
          onClick={handleClick('top')}
          active={currentPlacement === 'top'}
        >
          <BorderPlacementTop />
        </Icon>

        <Icon
          size="2xl"
          className={clsx('row-start-2 cursor-pointer rounded p-0.5', {
            'bg-primary-500/15 dark:bg-primary-400/20': currentPlacement === 'left'
          })}
          title="Left border"
          onClick={handleClick('left')}
          active={currentPlacement === 'left'}
        >
          <BorderPlacementLeft />
        </Icon>
        <Icon
          size="2xl"
          className={clsx('row-start-2 grid cursor-pointer grid-cols-3 rounded p-0.5', {
            'bg-primary-500/15 dark:bg-primary-400/20': currentPlacement === 'all'
          })}
          title="All four sides"
          onClick={handleClick('all')}
          active={currentPlacement === 'all'}
        >
          <BorderPlacementCenter />
        </Icon>
        <Icon
          size="2xl"
          className={clsx('row-start-2 cursor-pointer rounded p-0.5', {
            'bg-primary-500/15 dark:bg-primary-400/20': currentPlacement === 'right'
          })}
          title="Right border"
          onClick={handleClick('right')}
          active={currentPlacement === 'right'}
        >
          <BorderPlacementRight />
        </Icon>
        <Icon
          size="2xl"
          className={clsx('col-start-2 row-start-3 cursor-pointer rounded p-0.5', {
            'bg-primary-500/15 dark:bg-primary-400/20': currentPlacement === 'bottom'
          })}
          title="Bottom border"
          onClick={handleClick('bottom')}
          active={currentPlacement === 'bottom'}
        >
          <BorderPlacementBottom />
        </Icon>
      </div>
    </CategorySection>
  );
};

export default BorderPlacements;
