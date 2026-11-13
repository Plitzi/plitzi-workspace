import SpacingBox from './SpacingBox';
import SpacingPadding from './SpacingPadding';

import type { SpacingValues } from './SpacingBox';
import type { StyleCategory } from '@plitzi/sdk-shared';

export type SpacingMarginProps = {
  fragmentSelected?: StyleCategory;
  values?: SpacingValues;
  isLinked?: boolean;
  onLinkSelected?: () => void;
  onSelectFragment?: (fragment?: StyleCategory) => void;
};

const SpacingMargin = ({
  fragmentSelected,
  values,
  isLinked = false,
  onLinkSelected,
  onSelectFragment
}: SpacingMarginProps) => (
  <SpacingBox
    property="margin"
    className="border-ui-line-strong relative flex cursor-pointer flex-col rounded-md border border-dashed select-none"
    values={values}
    fragmentSelected={fragmentSelected}
    onSelectFragment={onSelectFragment}
  >
    <SpacingPadding
      values={values}
      fragmentSelected={fragmentSelected}
      onSelectFragment={onSelectFragment}
      isLinked={isLinked}
      onLinkSelected={onLinkSelected}
    />
  </SpacingBox>
);

export default SpacingMargin;
