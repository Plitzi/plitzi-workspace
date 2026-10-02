import Button from '@plitzi/plitzi-ui/Button';
import Flex from '@plitzi/plitzi-ui/Flex';
import Icon from '@plitzi/plitzi-ui/Icon';
import { useCallback } from 'react';

import { useBuilderStoreSetter } from '@plitzi/sdk-shared/store';
import { REUSE } from '@pmodules/Builder/helpers/reuse';

import { componentLabel } from '../../helpers';

import type { SpaceComponent } from '@plitzi/sdk-shared';

export type ComponentBannerProps = {
  component: SpaceComponent;
};

/** Says the canvas is a component, not a page — every instance of it changes with what is edited here. */
const ComponentBanner = ({ component }: ComponentBannerProps) => {
  const setBuilderStore = useBuilderStoreSetter();

  const handleClose = useCallback(() => setBuilderStore('componentOpen', undefined), [setBuilderStore]);

  return (
    <Flex
      items="center"
      gap={2}
      className="border-b border-gray-200 bg-white px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
    >
      <Icon icon={REUSE.component.icon} intent="primaryActive" />
      <span className="grow truncate text-sm">
        Editing component <b>{componentLabel(component)}</b> — every instance of it changes with what you edit here.
      </span>
      <Button size="xs" onClick={handleClose} iconPlacement="before">
        <Button.Icon icon="fa-solid fa-arrow-left" />
        Back to the page
      </Button>
    </Flex>
  );
};

export default ComponentBanner;
