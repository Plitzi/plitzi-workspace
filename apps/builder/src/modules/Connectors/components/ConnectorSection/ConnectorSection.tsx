import ContainerCollapsable from '@plitzi/plitzi-ui/ContainerCollapsable';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import Icon from '@plitzi/plitzi-ui/Icon';
import clsx from 'clsx';
import { useCallback } from 'react';

import ConnectorSectionContext from './ConnectorSectionContext';

import type { MouseEvent, ReactNode } from 'react';

export type ConnectorSectionProps = {
  id: string;
  title: string;
  /** Shown on the collapsed header: what this section currently holds, in a few words. */
  summary: string;
  description?: string;
  /** Marks a collapsed section whose contents were customized, so nothing hides silently. */
  highlight?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
};

/**
 * One collapsible block of the manifest form.
 *
 * A connector has seven areas and a CMS preset fills six of them correctly, so the panel opens with the two an
 * author actually edits and keeps the rest one click away. Each closed header carries a summary of its own value —
 * collapsing that hid the information would only trade scrolling for clicking.
 *
 * The prose for each field is opt-in behind the header's `?`, because an explanation is read once and then becomes
 * the thing standing between the author and the next field.
 */
const ConnectorSection = ({
  id,
  title,
  summary,
  description,
  highlight = false,
  defaultOpen = false,
  children
}: ConnectorSectionProps) => {
  const [isCollapsed, setIsCollapsed] = useStorage(`builder-state.connectors.section.${id}`, !defaultOpen);
  const [showHelp, setShowHelp] = useStorage(`builder-state.connectors.help.${id}`, false);

  const handleToggleHelp = useCallback(
    (e: MouseEvent) => {
      // The whole header toggles the section, so the button has to keep its click to itself.
      e.stopPropagation();
      setShowHelp(state => !state);
    },
    [setShowHelp]
  );

  return (
    <ContainerCollapsable collapsed={isCollapsed} onChange={setIsCollapsed}>
      <ContainerCollapsable.Header
        className={clsx('h-8 px-1', {
          'border-b border-gray-200 hover:bg-slate-100 dark:border-zinc-700 dark:hover:bg-zinc-700/50': isCollapsed,
          'bg-slate-100 dark:bg-zinc-700/50': !isCollapsed
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
      >
        {description && !isCollapsed && (
          <Icon
            className={clsx('cursor-pointer text-xs', {
              'text-blue-500': showHelp,
              'text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300': !showHelp
            })}
            icon="fa-solid fa-circle-question"
            title={showHelp ? 'Hide field help' : 'Show field help'}
            onClick={handleToggleHelp}
          />
        )}
      </ContainerCollapsable.Header>
      <ContainerCollapsable.Content
        className={clsx('flex flex-col gap-2 p-2', {
          'border-b border-gray-200 dark:border-zinc-700': !isCollapsed
        })}
      >
        {showHelp && description && <span className="text-xs text-gray-500 dark:text-zinc-400">{description}</span>}
        <ConnectorSectionContext value={showHelp}>{children}</ConnectorSectionContext>
      </ContainerCollapsable.Content>
    </ContainerCollapsable>
  );
};

export default ConnectorSection;
