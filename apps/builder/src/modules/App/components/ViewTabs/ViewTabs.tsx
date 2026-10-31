import useTheme from '@plitzi/plitzi-ui/hooks/useTheme';

import type { ReactNode } from 'react';

export type ViewTab<T extends string> = {
  id: T;
  label: string;
  /** Said beside the label: what in the tab needs a look. */
  mark?: ReactNode;
};

export type ViewTabsProps<T extends string> = {
  tabs: readonly ViewTab<T>[];
  selected: T;
  onSelect: (id: T) => void;
  size?: 'xs' | 'sm';
};

type TabButtonProps = { active: boolean; size: 'xs' | 'sm'; onClick: () => void; children: ReactNode };

/** One tab: a button a keyboard reaches and a reader names, drawn with `ContainerTabs`' own theme. */
const TabButton = ({ active, size, onClick, children }: TabButtonProps) => {
  const className = useTheme('ContainerTabs', { componentKey: 'tab', variants: { active, size } });

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`${className} focus-visible:outline-primary-500 focus-visible:outline-2`}
      onClick={onClick}
    >
      {children}
    </button>
  );
};

/**
 * The builder's tabs — the segmented row of `ContainerTabs`, with its theme — as buttons with a tab's role, and room
 * beside a label for what the tab holds that needs a look.
 */
const ViewTabs = <T extends string>({ tabs, selected, onSelect, size = 'xs' }: ViewTabsProps<T>) => {
  const className = useTheme('ContainerTabs', { componentKey: 'tabs', variants: { size } });

  return (
    <div className={className} role="tablist">
      {tabs.map(tab => (
        <TabButton key={tab.id} active={tab.id === selected} size={size} onClick={() => onSelect(tab.id)}>
          {tab.mark ? (
            <span className="inline-flex items-center gap-1.5">
              {tab.label}
              {tab.mark}
            </span>
          ) : (
            tab.label
          )}
        </TabButton>
      ))}
    </div>
  );
};

export default ViewTabs;
