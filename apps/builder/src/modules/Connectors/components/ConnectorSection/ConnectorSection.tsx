import ContainerCollapsable from '@plitzi/plitzi-ui/ContainerCollapsable';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import Icon from '@plitzi/plitzi-ui/Icon';
import clsx from 'clsx';
import { use, useCallback, useMemo } from 'react';

import ConnectorSectionContext from './ConnectorSectionContext';

import type { ConnectorSectionContextValue } from './ConnectorSectionContext';
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
 * Depth cues.
 *
 * A rail running down the whole nested block — header and content together — is what says which parent a section
 * belongs to; indentation alone reads as ambiguous once two siblings are collapsed next to each other. The tint
 * fades with depth so the outermost header stays the heaviest thing on screen.
 */
const RAILS = [
  '',
  'border-l-2 border-l-slate-300 pl-1 dark:border-l-zinc-600',
  'border-l-2 border-l-slate-200 pl-1 dark:border-l-zinc-700'
];

const HEADER_TINTS = ['bg-slate-100 dark:bg-zinc-700/50', 'bg-slate-50 dark:bg-zinc-800/50', 'bg-transparent'];

/**
 * Flattens an id into a single storage segment.
 *
 * `useStorage` treats everything after the first dot as a lodash path into one shared blob, so a section keyed
 * `read.list` writes a boolean where a section keyed `read.list.response` needs an object. Each toggle then
 * overwrote the other, and the loser read back `undefined` and collapsed — which is every nested section closing at
 * once. One segment per section keeps them independent leaves.
 */
const toStorageKey = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, '-');

/**
 * One collapsible block of the manifest form.
 *
 * A connector has more areas than anyone edits at once and a preset fills most of them correctly, so the panel
 * opens with the ones an author actually touches and keeps the rest one click away. Each closed header carries a
 * summary of its own value — collapsing that hid the information would only trade scrolling for clicking.
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
  const { depth } = use(ConnectorSectionContext);
  const storageKey = toStorageKey(id);
  // Synced off: every section shares the `builder-state` root, so with it on one toggle notifies all of them and
  // they all re-read and re-render. Nobody needs a collapsed section to follow along in another tab.
  const [isCollapsed, setIsCollapsed] = useStorage(
    `builder-state.connectors.section.${storageKey}`,
    !defaultOpen,
    'localStorage',
    false
  );
  const [showHelp, setShowHelp] = useStorage(
    `builder-state.connectors.help.${storageKey}`,
    false,
    'localStorage',
    false
  );

  const value = useMemo<ConnectorSectionContextValue>(() => ({ showHelp, depth: depth + 1 }), [showHelp, depth]);
  const rail = RAILS[Math.min(depth, RAILS.length - 1)];
  const tint = HEADER_TINTS[Math.min(depth, HEADER_TINTS.length - 1)];

  const handleToggleHelp = useCallback(
    (e: MouseEvent) => {
      // The whole header toggles the section, so the button has to keep its click to itself.
      e.stopPropagation();
      setShowHelp(state => !state);
    },
    [setShowHelp]
  );

  return (
    <ContainerCollapsable className={rail} collapsed={isCollapsed} onChange={setIsCollapsed}>
      <ContainerCollapsable.Header
        className={clsx('h-8 px-1', tint, {
          'border-b border-gray-200 hover:bg-slate-100 dark:border-zinc-700 dark:hover:bg-zinc-700/50': isCollapsed,
          'bg-transparent': isCollapsed && depth > 0
        })}
        title={
          <div className="flex min-w-0 items-baseline gap-2">
            <span
              className={clsx('whitespace-nowrap', {
                'text-xs font-medium': depth === 0,
                'text-xs': depth > 0
              })}
            >
              {title}
            </span>
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
          'border-b border-gray-200 dark:border-zinc-700': !isCollapsed && depth === 0
        })}
      >
        {showHelp && description && <span className="text-xs text-gray-500 dark:text-zinc-400">{description}</span>}
        <ConnectorSectionContext value={value}>{children}</ConnectorSectionContext>
      </ContainerCollapsable.Content>
    </ContainerCollapsable>
  );
};

export default ConnectorSection;
