import ContainerCollapsable from '@plitzi/plitzi-ui/ContainerCollapsable';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import Icon from '@plitzi/plitzi-ui/Icon';
import clsx from 'clsx';

import type { ReactNode } from 'react';

export type SettingsSectionProps = {
  /** Where its open or closed state is kept, one segment: `page-access`. */
  id: string;
  title: string;
  /** What it holds, said on its header whether it is open or not: closing it hides no setting. */
  summary: string;
  /** A summary worth seeing — a setting that changes who gets the page — drawn in the accent. */
  highlight?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
};

/**
 * One block of an element's settings, the builder's own collapsible section (its connectors' form): a header that
 * says what the block holds in a few words, and the fields under it. A long form opens with what an author touches and
 * keeps the rest one click away — each closed header carrying its value, so nothing is set where nobody sees it.
 */
const SettingsSection = ({
  id,
  title,
  summary,
  highlight = false,
  defaultOpen = false,
  children
}: SettingsSectionProps) => {
  // One segment per section: `useStorage` reads a dot as a path into one shared blob. Synced off: no other tab needs
  // a section's state, and on it every toggle re-renders every section.
  const [isCollapsed, setIsCollapsed] = useStorage(
    `builder-state.elementSettings.${id.replace(/[^a-zA-Z0-9_-]/g, '-')}`,
    !defaultOpen,
    'localStorage',
    false
  );

  return (
    <ContainerCollapsable collapsed={isCollapsed} onChange={setIsCollapsed}>
      <ContainerCollapsable.Header
        className={clsx('h-8 bg-slate-100 px-1 hover:bg-slate-200/70 dark:bg-zinc-700/50 dark:hover:bg-zinc-700/60', {
          'border-b border-gray-200 dark:border-zinc-700': isCollapsed
        })}
        title={
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="text-xs font-medium whitespace-nowrap">{title}</span>
            <span
              className={clsx('truncate text-xs', {
                'text-primary-500': highlight,
                'text-gray-400 dark:text-zinc-500': !highlight
              })}
              title={summary}
            >
              {summary}
            </span>
          </div>
        }
        placement="right"
        iconCollapsed={<Icon icon="fa-solid fa-angle-down" />}
        iconExpanded={<Icon icon="fa-solid fa-angle-up" />}
      />
      <ContainerCollapsable.Content
        className={clsx('flex flex-col gap-3 px-1 py-2', {
          'border-b border-gray-200 dark:border-zinc-700': !isCollapsed
        })}
      >
        {children}
      </ContainerCollapsable.Content>
    </ContainerCollapsable>
  );
};

export default SettingsSection;
