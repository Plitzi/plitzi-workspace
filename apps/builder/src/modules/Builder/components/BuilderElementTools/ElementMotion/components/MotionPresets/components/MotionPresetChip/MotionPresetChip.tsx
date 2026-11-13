import clsx from 'clsx';
import { useCallback } from 'react';

export type MotionPresetChipProps = {
  /** The preset, or `''` for none. */
  value: string;
  label: string;
  selected: boolean;
  onSelect: (value: string) => void;
  /** The pointer or the focus came to it: the section's stage shows it. */
  onLook: (value: string) => void;
  onLookAway: () => void;
};

const MotionPresetChip = ({ value, label, selected, onSelect, onLook, onLookAway }: MotionPresetChipProps) => {
  const handleSelect = useCallback(() => onSelect(value), [onSelect, value]);
  const handleLook = useCallback(() => onLook(value), [onLook, value]);

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={clsx('h-7 min-w-0 cursor-pointer truncate rounded border px-2 text-xs transition-colors', {
        'border-primary-400 bg-primary-500/10 text-ui-fg font-medium': selected,
        'border-ui-line text-ui-fg-muted hover:border-ui-line-strong hover:text-ui-fg': !selected
      })}
      onClick={handleSelect}
      onPointerEnter={handleLook}
      onPointerLeave={onLookAway}
      onFocus={handleLook}
      onBlur={onLookAway}
    >
      {label}
    </button>
  );
};

export default MotionPresetChip;
