import { ContainerTabs } from '@plitzi/plitzi-ui';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import clsx from 'clsx';
import { useCallback } from 'react';

import type { ReactNode } from 'react';

const HEADER_CLASS_NAME = {
  // Inside a docked panel, in line with the panel's own padding.
  panel: 'mx-2 mt-2',
  // Over a view that replaces the canvas: the same column as the page under it (`ViewPage`), so tabs, notice and
  // content share one left edge.
  page: 'mx-auto w-full max-w-5xl px-6 pt-5 pb-4'
} as const;

export type PanelSection = {
  id: string;
  label: string;
  content: ReactNode;
};

export type PanelSectionsProps = {
  /** What the open section is remembered under, among the builder's own preferences. */
  name: string;
  sections: [PanelSection, ...PanelSection[]];
  /** `panel` in the sidebar's dock, `page` over a view that takes the canvas' place. */
  variant?: keyof typeof HEADER_CLASS_NAME;
  /** Said once under the tabs, whichever section is open — what holds for all of them. */
  notice?: ReactNode;
  className?: string;
};

/**
 * Several subjects behind one entry of the sidebar: a row of tabs over the one that is open. The open one is
 * remembered, so coming back to the entry finds it where it was left — and a section that no longer exists falls back
 * to the first.
 */
const PanelSections = ({ name, sections, variant = 'panel', notice, className }: PanelSectionsProps) => {
  const [openId, setOpenId] = useStorage<string>(`builder-state.panelSections.${name}`, sections[0].id);
  const open = sections.find(section => section.id === openId) ?? sections[0];

  const handleSelect = useCallback(
    (index: number) => setOpenId(sections.at(index)?.id ?? sections[0].id),
    [sections, setOpenId]
  );

  return (
    // `h-full` where it is a popup's body and `grow` where it is a flex item; the grid stretches the open section to the
    // height left under the tabs, whether or not the section's own root is a flex item.
    <div className={clsx('flex h-full min-h-0 w-full grow basis-0 flex-col', className)}>
      <div className={clsx('flex shrink-0 flex-col gap-3', HEADER_CLASS_NAME[variant])}>
        <ContainerTabs.Tabs items={sections} tabSelected={sections.indexOf(open)} size="xs" onSelect={handleSelect} />
        {notice}
      </div>
      <div className="grid min-h-0 grow basis-0 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)]">
        {open.content}
      </div>
    </div>
  );
};

export default PanelSections;
