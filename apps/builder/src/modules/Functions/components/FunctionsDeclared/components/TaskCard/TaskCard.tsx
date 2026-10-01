import Button from '@plitzi/plitzi-ui/Button';
import clsx from 'clsx';
import { useCallback } from 'react';

export type TaskCardProps = {
  name: string;
  title: string;
  description?: string;
  /** What it asked for beyond the default, in words — none when it runs with the server's default. */
  limits?: string;
  /** The task Try is set to. */
  selected: boolean;
  onTry: (task: string) => void;
};

/** One task the code declares: what the step is called, what it does, how long it may take — and a click from Try. */
const TaskCard = ({ name, title, description, limits, selected, onTry }: TaskCardProps) => {
  const handleTry = useCallback(() => onTry(name), [name, onTry]);

  return (
    <div
      className={clsx('flex flex-col gap-1 rounded-sm border p-2 text-xs', {
        'border-primary-400 dark:border-primary-500': selected,
        'border-gray-200 dark:border-zinc-700': !selected
      })}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="font-medium">{title}</span>
          <code className="truncate text-[11px] text-gray-500 dark:text-zinc-400">{name}</code>
        </div>
        <Button size="xs" intent="secondary" title={`Try ${name}`} onClick={handleTry}>
          <i className="fa-solid fa-play" />
        </Button>
      </div>
      {description && <span className="text-gray-600 dark:text-zinc-300">{description}</span>}
      <span
        className="text-[11px] text-gray-500 dark:text-zinc-400"
        title="More CPU or time is asked for in the task: limits: { cpuMs, wallMs }"
      >
        <i className="fa-regular fa-clock mr-1" />
        {limits ?? 'Default time'}
      </span>
    </div>
  );
};

export default TaskCard;
