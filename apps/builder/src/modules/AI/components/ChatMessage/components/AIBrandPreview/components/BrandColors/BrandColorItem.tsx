import { useCallback } from 'react';

import { COLOR_LABELS } from '../../helpers';

export type BrandColorItemProps = {
  role: string;
  hex: string;
  isCopied: boolean;
  onCopy: (hex: string) => void;
};

const BrandColorItem = ({ role, hex, isCopied, onCopy }: BrandColorItemProps) => {
  const handleClick = useCallback(() => onCopy(hex), [hex, onCopy]);

  return (
    <button onClick={handleClick} className="flex cursor-pointer flex-col items-center gap-0.5" title={`Copy ${hex}`}>
      <div
        className="h-6 w-6 rounded-full border border-black/10 shadow-sm dark:border-white/10"
        style={{ backgroundColor: hex }}
      />
      <span className="font-mono text-[9px] text-zinc-500">{COLOR_LABELS[role] ?? role}</span>
      <span className="font-mono text-[8px] text-zinc-400">{isCopied ? '✓' : hex.toUpperCase()}</span>
    </button>
  );
};

export default BrandColorItem;
