import { useCallback } from 'react';

export type SegmentedButtonProps = {
  id: string;
  label: string;
  isActive: boolean;
  onSelect: (id: string) => void;
};

const SegmentedButton = ({ id, label, isActive, onSelect }: SegmentedButtonProps) => {
  const handleClick = useCallback(() => onSelect(id), [id, onSelect]);

  return (
    <button
      onClick={handleClick}
      aria-pressed={isActive}
      className={
        isActive
          ? 'rounded-lg bg-brand-600 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm'
          : 'rounded-lg px-3.5 py-1.5 text-sm font-medium text-zinc-400 transition hover:bg-ink-800 hover:text-white'
      }
    >
      {label}
    </button>
  );
};

export default SegmentedButton;
