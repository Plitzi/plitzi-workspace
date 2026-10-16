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
    className="relative grow rounded-md border border-gray-300 bg-gray-50 dark:border-zinc-600 dark:bg-zinc-800/70"
    values={values}
    fragmentSelected={fragmentSelected}
    onSelectFragment={onSelectFragment}
  >
    <div
      className="flex grow items-center justify-center rounded border border-gray-300 bg-white py-1 text-zinc-500 hover:text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      title={isLinked ? 'Sides linked: a change applies to all four' : 'Link the four sides'}
      onClick={onLinkSelected}
    >
      {isLinked && <i className="fa-solid fa-link text-sm" />}
      {!isLinked && <i className="fa-solid fa-link-slash text-sm" />}
    </div>
  </SpacingBox>
);

export default SpacingPadding;
