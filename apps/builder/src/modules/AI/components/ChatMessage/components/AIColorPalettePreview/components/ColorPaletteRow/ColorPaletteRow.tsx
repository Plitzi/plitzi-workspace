import { useCallback } from 'react';

import type { ColorItem } from '../../../../helpers/toolVisualTypes';

export type ColorPaletteRowProps = {
  item: ColorItem;
  hex: string;
  isCopied: boolean;
  onCopy: (hex: string) => void;
};

const ColorPaletteRow = ({ item, hex, isCopied, onCopy }: ColorPaletteRowProps) => {
  const handleCopy = useCallback(() => onCopy(hex), [hex, onCopy]);

  return (
    <div className="flex items-center gap-2 px-3 py-1">
      <button
        onClick={handleCopy}
        className="h-4 w-4 shrink-0 cursor-pointer rounded-full border border-black/10 transition-transform hover:scale-110 dark:border-white/10"
        style={{ backgroundColor: hex }}
        title={`Copy ${hex}`}
      />
      <span className="flex-1 font-medium text-zinc-700 dark:text-zinc-300">{item.name}</span>
      {item.role && <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-600">{item.role}</span>}
      <button
        onClick={handleCopy}
        className="font-mono text-[10px] text-zinc-400 hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400"
      >
        {hex.toUpperCase()}
      </button>
      <button
        onClick={handleCopy}
        className="w-3 shrink-0 text-center text-zinc-300 hover:text-zinc-500 dark:text-zinc-700 dark:hover:text-zinc-500"
      >
        {isCopied && <i className="fa-solid fa-check text-[10px] text-emerald-500" />}
        {!isCopied && <i className="fa-regular fa-copy text-[10px]" />}
      </button>
    </div>
  );
};

export default ColorPaletteRow;
