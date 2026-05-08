import { COLOR_LABELS } from '../../helpers';

export type BrandColorsProps = {
  colorEntries: [string, string][];
  copied: string | null;
  onCopy: (hex: string) => void;
};

const BrandColors = ({ colorEntries, copied, onCopy }: BrandColorsProps) => (
  <div className="px-3 pt-2">
    <div className="mb-1.5 font-mono text-[10px] tracking-widest text-zinc-400 uppercase dark:text-zinc-600">Colors</div>
    <div className="flex flex-wrap gap-2">
      {colorEntries.map(([role, hex]) => (
        <button
          key={role}
          onClick={() => onCopy(hex)}
          className="flex cursor-pointer flex-col items-center gap-0.5"
          title={`Copy ${hex}`}
        >
          <div
            className="h-6 w-6 rounded-full border border-black/10 shadow-sm dark:border-white/10"
            style={{ backgroundColor: hex }}
          />
          <span className="font-mono text-[9px] text-zinc-500">{COLOR_LABELS[role] ?? role}</span>
          <span className="font-mono text-[8px] text-zinc-400">{copied === hex ? '✓' : hex.toUpperCase()}</span>
        </button>
      ))}
    </div>
  </div>
);

export default BrandColors;
