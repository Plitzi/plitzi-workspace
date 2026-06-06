import { useCallback } from 'react';

export type CodeShowcaseTabProps = {
  id: string;
  label: string;
  isActive: boolean;
  onSelect: (id: string) => void;
};

const CodeShowcaseTab = ({ id, label, isActive, onSelect }: CodeShowcaseTabProps) => {
  const handleClick = useCallback(() => onSelect(id), [id, onSelect]);

  return (
    <button
      onClick={handleClick}
      className={
        isActive
          ? 'rounded-lg bg-brand-600 px-3.5 py-1.5 text-sm font-medium text-white'
          : 'rounded-lg px-3.5 py-1.5 text-sm font-medium text-zinc-400 transition hover:bg-ink-800 hover:text-white'
      }
    >
      {label}
    </button>
  );
};

export default CodeShowcaseTab;
