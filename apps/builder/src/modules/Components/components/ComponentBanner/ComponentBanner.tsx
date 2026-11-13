import Button from '@plitzi/plitzi-ui/Button';
import Flex from '@plitzi/plitzi-ui/Flex';
import Icon from '@plitzi/plitzi-ui/Icon';
import { useCallback } from 'react';

import { useBuilderStoreSetter } from '@plitzi/sdk-shared/store';
import { REUSE } from '@pmodules/Builder/helpers/reuse';

import { componentLabel } from '../../helpers';

import type { ComponentPlacement } from '../../preview';
import type { SpaceComponent } from '@plitzi/sdk-shared';
import type { ChangeEvent } from 'react';

export type ComponentBannerProps = {
  component: SpaceComponent;
  /** Every place it is drawn: the one it is shown as is picked among them. */
  placements: ComponentPlacement[];
  shownAs?: string;
  onShowAs: (instanceId: string) => void;
};

/**
 * Says the canvas is a component, not a page — every instance of it changes with what is edited here — and which of
 * its instances it is shown as: that one's words, on the ground it sits on.
 */
const ComponentBanner = ({ component, placements, shownAs, onShowAs }: ComponentBannerProps) => {
  const setBuilderStore = useBuilderStoreSetter();

  const handleClose = useCallback(() => setBuilderStore('componentOpen', undefined), [setBuilderStore]);
  const handleShowAs = useCallback((e: ChangeEvent<HTMLSelectElement>) => onShowAs(e.target.value), [onShowAs]);

  return (
    <Flex
      items="center"
      gap={2}
      className="border-b border-gray-200 bg-white px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
    >
      <Icon icon={REUSE.component.icon} intent="primaryActive" />
      <span className="min-w-0 grow truncate text-sm">
        Editing component <b>{componentLabel(component)}</b> — every instance of it changes with what you edit here.
      </span>
      {placements.length > 0 && (
        <label className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          Shown as
          <select
            className="max-w-56 rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            title="Which instance's words and ground the canvas shows it with"
            value={shownAs}
            onChange={handleShowAs}
          >
            {placements.map(({ instanceId, where }) => (
              <option key={instanceId} value={instanceId}>
                {`${where} › ${instanceId}`}
              </option>
            ))}
          </select>
        </label>
      )}
      <Button size="xs" onClick={handleClose} iconPlacement="before">
        <Button.Icon icon="fa-solid fa-arrow-left" />
        Back to the page
      </Button>
    </Flex>
  );
};

export default ComponentBanner;
