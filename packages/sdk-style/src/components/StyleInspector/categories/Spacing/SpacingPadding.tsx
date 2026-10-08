import { useCallback } from 'react';

import SpacingNumber from './SpacingNumber';
import InspectorLabel from '../../components/InspectorLabel';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

const keyValue = ['padding-top', 'padding-left', 'padding-right', 'padding-bottom'] as StyleCategory[];

export type SpacingPaddingProps = {
  fragmentSelected?: StyleCategory;
  values?: {
    'padding-top'?: StyleValue;
    'padding-bottom'?: StyleValue;
    'padding-left'?: StyleValue;
    'padding-right'?: StyleValue;
  };
  isLinked?: boolean;
  onLinkSelected?: () => void;
  onSelectFragment?: (fragment?: StyleCategory) => void;
};

const SpacingPadding = ({
  fragmentSelected,
  values,
  isLinked = false,
  onLinkSelected,
  onSelectFragment
}: SpacingPaddingProps) => {
  const handleClickSelect = useCallback(
    (type?: StyleCategory) => () => {
      if (type === fragmentSelected) {
        onSelectFragment?.(undefined);
      } else {
        onSelectFragment?.(type);
      }
    },
    [onSelectFragment, fragmentSelected]
  );

  const {
    'padding-top': paddingTop,
    'padding-bottom': paddingBottom,
    'padding-left': paddingLeft,
    'padding-right': paddingRight
  } = values ?? {};

  return (
    <div className="relative grow rounded-md border border-gray-300 bg-gray-50 dark:border-zinc-600 dark:bg-zinc-800/70">
      <div className="flex items-center justify-center py-0.5">
        <InspectorLabel
          keyValue={keyValue}
          className="absolute top-0 left-0 overflow-hidden rounded-br-md !p-0 text-[11px]"
          size="custom"
        >
          PADDING
        </InspectorLabel>
        <SpacingNumber
          value={paddingTop}
          active={fragmentSelected === 'padding-top'}
          onClick={handleClickSelect('padding-top')}
        />
      </div>
      <div className="flex items-center justify-center">
        <div className="flex items-center justify-center px-0.5">
          <SpacingNumber
            value={paddingLeft}
            active={fragmentSelected === 'padding-left'}
            onClick={handleClickSelect('padding-left')}
          />
        </div>
        <div
          className="flex grow items-center justify-center rounded border border-gray-300 bg-white py-1 text-zinc-500 hover:text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          title={isLinked ? 'Sides linked: a change applies to all four' : 'Link the four sides'}
          onClick={onLinkSelected}
        >
          {isLinked && <i className="fa-solid fa-link text-sm" />}
          {!isLinked && <i className="fa-solid fa-link-slash text-sm" />}
        </div>
        <div className="flex items-center justify-center px-0.5">
          <SpacingNumber
            value={paddingRight}
            active={fragmentSelected === 'padding-right'}
            onClick={handleClickSelect('padding-right')}
          />
        </div>
      </div>
      <div className="flex items-center justify-center py-0.5">
        <SpacingNumber
          value={paddingBottom}
          active={fragmentSelected === 'padding-bottom'}
          onClick={handleClickSelect('padding-bottom')}
        />
      </div>
    </div>
  );
};

export default SpacingPadding;
