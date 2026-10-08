import clsx from 'clsx';
import { useCallback } from 'react';

export type FlagPreviewOptionValue = { label: string; value: boolean | undefined; title: string };

export type FlagPreviewOptionProps = {
  name: string;
  option: FlagPreviewOptionValue;
  active: boolean;
  onForce: (name: string, value: boolean | undefined) => void;
};

const FlagPreviewOption = ({ name, option, active, onForce }: FlagPreviewOptionProps) => {
  const handleClick = useCallback(() => onForce(name, option.value), [name, option.value, onForce]);

  return (
    <button
      type="button"
      title={option.title}
      className={clsx('px-1.5 py-0.5 text-[11px] font-medium', {
        'bg-blue-600 text-white': active,
        'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700': !active
      })}
      onClick={handleClick}
    >
      {option.label}
    </button>
  );
};

export default FlagPreviewOption;
