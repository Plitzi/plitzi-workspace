import { useCallback } from 'react';

import { needsWhiteText } from '../../helpers';

export type ColorShadeButtonProps = {
  shade: string;
  hex: string;
  label: string;
  isCopied: boolean;
  onCopy: (hex: string) => void;
};

const ColorShadeButton = ({ shade, hex, label, isCopied, onCopy }: ColorShadeButtonProps) => {
  const handleClick = useCallback(() => onCopy(hex), [hex, onCopy]);
  const white = needsWhiteText(hex);

  return (
    <button
      onClick={handleClick}
      className="group relative flex-1 cursor-pointer"
      style={{ backgroundColor: hex, height: 24 }}
      title={`${label}-${shade}: ${hex}`}
    >
      <div
        className="absolute inset-0 flex flex-col items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
        style={{ color: white ? '#fff' : '#000' }}
      >
        <span className="text-[8px]">{isCopied ? '✓' : shade}</span>
      </div>
    </button>
  );
};

export default ColorShadeButton;
