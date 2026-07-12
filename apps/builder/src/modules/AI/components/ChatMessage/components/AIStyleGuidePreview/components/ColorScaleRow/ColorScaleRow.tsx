/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import ColorShadeButton from './ColorShadeButton';
import { sortedShades } from '../../helpers';

import type { ColorScale } from '../../../../helpers/toolVisualTypes';

export type ColorScaleRowProps = {
  label: string;
  scale: ColorScale;
  copied: string | null;
  onCopy: (hex: string) => void;
};

const ColorScaleRow = ({ label, scale, copied, onCopy }: ColorScaleRowProps) => {
  const shades = sortedShades(scale);

  return (
    <div className="mb-2">
      <div className="mb-0.5 font-mono text-[10px] text-zinc-500 capitalize">{label}</div>
      <div className="flex gap-px overflow-hidden rounded">
        {shades.map(([shade, hex]) => (
          <ColorShadeButton
            key={shade}
            shade={shade}
            hex={hex}
            label={label}
            isCopied={copied === hex}
            onCopy={onCopy}
          />
        ))}
      </div>
      {shades.length > 0 && (
        <div className="mt-0.5 font-mono text-[9px] text-zinc-400 dark:text-zinc-600">
          500 → {shades.find(([s]) => s === '500')?.[1] ?? shades[Math.floor(shades.length / 2)]?.[1] ?? ''}
        </div>
      )}
    </div>
  );
};

export default ColorScaleRow;
