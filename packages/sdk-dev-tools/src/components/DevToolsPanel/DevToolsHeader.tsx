import clsx from 'clsx';
import { useCallback } from 'react';

import { useDevToolsTheme } from '../../DevToolsThemeContext';

import type { Orientation } from '../../DevToolsContainer';

// ─── Tabs config ─────────────────────────────────────────────────────────────

const TABS = [
  { id: 'logs', label: 'Logs', icon: 'fa-solid fa-terminal' },
  { id: 'dataSources', label: 'Sources', icon: 'fa-solid fa-database' },
  { id: 'elements', label: 'Elements', icon: 'fa-solid fa-layer-group' },
  { id: 'variables', label: 'Variables', icon: 'fa-solid fa-code' },
  { id: 'plugins', label: 'Plugins', icon: 'fa-solid fa-puzzle-piece' }
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export type DevToolsHeaderProps = {
  className?: string;
  tabSelected?: string;
  orientation: Orientation;
  onChangeOrientation?: (orientation: Orientation) => void;
  onTabSelect?: (tabIndex: string) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

const DevToolsHeader = ({
  tabSelected,
  orientation = 'vertical',
  onChangeOrientation,
  onTabSelect
}: DevToolsHeaderProps) => {
  const { isDark, toggleTheme } = useDevToolsTheme();

  const handleClickOrientation = useCallback(() => {
    onChangeOrientation?.(orientation === 'horizontal' ? 'vertical' : 'horizontal');
  }, [orientation, onChangeOrientation]);

  const handleClickTab = useCallback((tabId: string) => () => onTabSelect?.(tabId), [onTabSelect]);

  const borderClass = isDark ? 'border-zinc-700' : 'border-zinc-200';
  const bgClass = isDark ? 'bg-zinc-800' : 'bg-zinc-100';
  const iconBtnBase = clsx(
    'flex h-6 w-6 items-center justify-center rounded transition-colors',
    isDark
      ? 'text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100'
      : 'text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900'
  );

  return (
    <div className={clsx('flex shrink-0 items-stretch justify-between border-b', bgClass, borderClass, 'select-none')}>
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
                isActive
                  ? clsx('border-violet-500', isDark ? 'text-violet-400' : 'text-violet-600')
                  : clsx(
                      'border-transparent',
                      isDark
                        ? 'text-zinc-400 hover:bg-zinc-700/50 hover:text-zinc-100'
                        : 'text-zinc-500 hover:bg-zinc-200/70 hover:text-zinc-800'
                    )
              )}
            >
              <i className={clsx(tab.icon, 'text-[10px]')} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Toolbar right */}
      <div className={clsx('flex shrink-0 items-center gap-1 border-l px-2', borderClass)}>
        <button
          className={iconBtnBase}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={toggleTheme}
        >
          <i className={clsx('text-xs', isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon')} />
        </button>
        <button
          className={iconBtnBase}
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
