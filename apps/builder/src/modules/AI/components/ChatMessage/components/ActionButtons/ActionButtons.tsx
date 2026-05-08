import clsx from 'clsx';

import type { AiMessageAction } from '../../../../types';

export type ActionButtonsProps = { actions: AiMessageAction[] };

const ActionButtons = ({ actions }: ActionButtonsProps) => (
  <div className="flex gap-2 pt-1 pl-2">
    {actions.map(action => (
      <button
        key={action.id}
        className={clsx('rounded px-3 py-1 font-mono text-xs font-medium transition-colors', {
          'bg-violet-600 text-white hover:bg-violet-500': action.variant === 'primary',
          'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50':
            action.variant === 'danger',
          'border border-gray-200 text-zinc-600 hover:bg-gray-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800':
            action.variant !== 'primary' && action.variant !== 'danger'
        })}
      >
        {action.label}
      </button>
    ))}
  </div>
);

export default ActionButtons;
