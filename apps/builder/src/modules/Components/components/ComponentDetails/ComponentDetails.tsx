import { useMemo } from 'react';

import { groupByTree, UsageTreeGroup, useUsageIndex } from '@pmodules/Usages';

import ComponentPreview from '../ComponentPreview';

import type { SpaceComponent } from '@plitzi/sdk-shared';

export type ComponentDetailsProps = {
  component: SpaceComponent;
};

/** Past this many places, each page starts folded: the list reads as the pages it is on, each opened at will. */
const UNFOLDED_UP_TO = 8;

/**
 * A component opened in the list: what it looks like, and every place it is drawn — each a link that takes you there,
 * opening its page, layout or component and selecting the instance.
 */
const ComponentDetails = ({ component }: ComponentDetailsProps) => {
  const index = useUsageIndex();
  const groups = useMemo(() => {
    const item = index.components.find(each => each.key === `component:${component.id}`);

    return groupByTree(item?.elements ?? []);
  }, [index, component.id]);
  const total = groups.reduce((sum, group) => sum + group.elements.length, 0);

  return (
    <div className="flex flex-col gap-2 pt-1 pb-2 pl-6">
      <ComponentPreview component={component} />
      <span className="text-ui-fg-subtle text-[11px] tracking-wider uppercase">Used in</span>
      {groups.length === 0 && (
        <span className="text-ui-fg-subtle text-[11px]">Nothing places it yet: drag it onto a page to place it.</span>
      )}
      {groups.map(group => (
        <UsageTreeGroup
          key={`${group.tree.kind}:${group.tree.id}`}
          group={group}
          defaultOpen={groups.length === 1 || total <= UNFOLDED_UP_TO}
        />
      ))}
    </div>
  );
};

export default ComponentDetails;
