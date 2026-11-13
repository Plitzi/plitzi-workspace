import SpacingBox from './SpacingBox';

import type { SpacingValues } from './SpacingBox';
import type { StyleCategory } from '@plitzi/sdk-shared';

export type SpacingPaddingProps = {
  fragmentSelected?: StyleCategory;
  values?: SpacingValues;
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
}: SpacingPaddingProps) => (
  <SpacingBox
    property="padding"
    className="border-ui-line-strong bg-ui-raised relative grow rounded-md border"
    values={values}
    fragmentSelected={fragmentSelected}
    onSelectFragment={onSelectFragment}
  >
    <div
      className="border-ui-line-strong bg-ui-panel text-ui-fg-subtle hover:text-ui-fg flex grow items-center justify-center rounded border py-1"
      title={isLinked ? 'Sides linked: a change applies to all four' : 'Link the four sides'}
      onClick={onLinkSelected}
    >
      {isLinked && <i className="fa-solid fa-link text-sm" />}
      {!isLinked && <i className="fa-solid fa-link-slash text-sm" />}
    </div>
  </SpacingBox>
);

export default SpacingPadding;
