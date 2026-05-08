import { useCallback } from 'react';

export type ColorStripItemProps = {
  name: string;
  hex: string;
  onCopy: (hex: string) => void;
};

const ColorStripItem = ({ name, hex, onCopy }: ColorStripItemProps) => {
  const handleCopy = useCallback(() => onCopy(hex), [hex, onCopy]);

  return (
    <button
      className="flex-1 cursor-pointer"
      style={{ backgroundColor: hex }}
      onClick={handleCopy}
      title={`Copy ${name}: ${hex}`}
    />
  );
};

export default ColorStripItem;
