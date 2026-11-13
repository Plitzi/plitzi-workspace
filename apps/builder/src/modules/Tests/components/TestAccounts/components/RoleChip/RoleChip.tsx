import clsx from 'clsx';
import { useCallback } from 'react';

export type RoleChipProps = {
  role: string;
  /** The space no longer declares it: said, in amber. */
  gone: boolean;
  /** Takes it off the account, where it can be. */
  onRemove?: (role: string) => void;
};

/** One role of a test account — amber when the space has removed it since. */
const RoleChip = ({ role, gone, onRemove }: RoleChipProps) => {
  const handleRemove = useCallback(() => onRemove?.(role), [onRemove, role]);

  return (
    <span
      title={gone ? `The space has no role "${role}" now: a journey plays without it` : undefined}
      className={clsx('inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px]', {
        'bg-ui-raised text-ui-fg': !gone,
        'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300': gone
      })}
    >
      {gone && <i className="fa-solid fa-triangle-exclamation text-[10px]" />}
      {role}
      {onRemove && (
        <button
          type="button"
          title={`Take ${role} off`}
          className="text-ui-fg-subtle hover:text-ui-fg cursor-pointer"
          onClick={handleRemove}
        >
          <i className="fa-solid fa-xmark text-[10px]" />
        </button>
      )}
    </span>
  );
};

export default RoleChip;
