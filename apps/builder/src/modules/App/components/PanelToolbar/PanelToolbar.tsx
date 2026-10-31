import Button from '@plitzi/plitzi-ui/Button';

import type { ReactNode } from 'react';

export type PanelAction = {
  /** What it makes, in sentence case: "New variable". */
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Why it is disabled, said on hover. */
  title?: string;
};

export type PanelToolbarProps = {
  /** The panel's search — `PanelSearch` — taking the room left by the action. */
  children?: ReactNode;
  /** The panel's primary action: at the top right of every panel, never pinned below or across the width. */
  action?: PanelAction;
};

/**
 * The top of a sidebar panel: its search and its primary action, in one row — the same place in every panel, so what
 * makes something new is found where it was in the last one. Beside a search the action is its "+" alone, named on
 * hover and to a reader — a narrow panel left the search too short to read; alone, it says its name across the row.
 */
const PanelToolbar = ({ children, action }: PanelToolbarProps) => (
  <div className="flex shrink-0 items-center gap-2">
    {children && <div className="min-w-0 grow">{children}</div>}
    {action && (
      <Button
        size="sm"
        iconPlacement="before"
        className={children ? 'shrink-0' : 'grow'}
        disabled={action.disabled}
        title={action.title ?? (children ? action.label : undefined)}
        aria-label={children ? action.label : undefined}
        onClick={action.onClick}
      >
        <Button.Icon icon="fa-solid fa-plus" />
        {!children && action.label}
      </Button>
    )}
  </div>
);

export default PanelToolbar;
