import clsx from 'clsx';
import { useCallback } from 'react';

import { useScopeSelector } from '../../scope/useScope';

import type { Orientation } from '../../DevToolsContainer';
import type { ChangeEvent } from 'react';

const TABS = [
  { id: 'logs', label: 'Logs', icon: 'fa-solid fa-terminal' },
  { id: 'store', label: 'Store', icon: 'fa-solid fa-database' },
  { id: 'history', label: 'History', icon: 'fa-solid fa-clock-rotate-left' },
  { id: 'elements', label: 'Elements', icon: 'fa-solid fa-layer-group' },
  { id: 'variables', label: 'Variables', icon: 'fa-solid fa-code' },
  { id: 'plugins', label: 'Plugins', icon: 'fa-solid fa-puzzle-piece' },
  { id: 'tracing', label: 'Tracing', icon: 'fa-solid fa-gauge-high' }
] as const;

export type DevToolsHeaderProps = {
  className?: string;
  tabSelected?: string;
  orientation: Orientation;
  onChangeOrientation?: (orientation: Orientation) => void;
  onTabSelect?: (tabIndex: string) => void;
};

const DevToolsHeader = ({
  tabSelected,
  orientation = 'vertical',
  onChangeOrientation,
  onTabSelect
}: DevToolsHeaderProps) => {
  const { options: scopeOptions, value: scopeValue, onSelect: onSelectScope } = useScopeSelector();

  const handleClickOrientation = useCallback(() => {
    onChangeOrientation?.(orientation === 'horizontal' ? 'vertical' : 'horizontal');
  }, [orientation, onChangeOrientation]);

  const handleClickTab = useCallback((tabId: string) => () => onTabSelect?.(tabId), [onTabSelect]);

  const handleSelectScope = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => onSelectScope(event.target.value),
    [onSelectScope]
  );

  return (
    <div className="flex shrink-0 items-stretch justify-between border-b border-zinc-200 bg-zinc-100 select-none dark:border-zinc-700 dark:bg-zinc-800">
      {/* Tabs */}
      <div className="flex items-stretch overflow-x-auto">
        {TABS.map(tab => {
          const isActive = tabSelected === tab.id;

          return (
            <button
              key={tab.id}
              onClick={handleClickTab(tab.id)}
              className={clsx(
                'flex cursor-pointer items-center gap-1.5 border-b-2 px-3 py-2 font-medium transition-colors',
                {
                  'border-violet-500 text-violet-600 dark:text-violet-400': isActive,
                  'border-transparent text-zinc-500 hover:bg-zinc-200/70 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700/50 dark:hover:text-zinc-100':
                    !isActive
                }
              )}
            >
              <i className={clsx(tab.icon, 'text-[10px]')} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Toolbar right */}
      <div className="flex shrink-0 items-center gap-1 border-l border-zinc-200 px-2 dark:border-zinc-700">
        {scopeOptions.length > 0 && (
          <select
            value={scopeValue ?? ''}
            onChange={handleSelectScope}
            title="Instance / StoreProvider driving the panel"
            className="max-w-52 rounded border border-zinc-300 bg-white px-1 py-0.5 text-[11px] text-zinc-700 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
          >
            {scopeOptions.map(group => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        )}
        <button
          className="flex h-6 w-6 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
          title={orientation === 'horizontal' ? 'Switch to side panel' : 'Switch to bottom panel'}
          onClick={handleClickOrientation}
        >
          <i className={clsx('fa-solid fa-table-columns text-xs', { 'rotate-90': orientation === 'vertical' })} />
        </button>
      </div>
    </div>
  );
};

export default DevToolsHeader;
